# Persistent workouts and community sharing

Implemented locally in the Morris Hub checkout, following the UX review and shared Buddy voice work. No production deployment, Facebook post, or GitHub upload is included.

## Active workout recovery

- A platform-wide return bar remains visible when the user leaves an active workout. It links back to the same session and shows logged sets, elapsed time, and paused/unfinished-summary status.
- Recovery is scoped to the signed-in account on the current browser. Older snapshots are adopted only after a server check verifies ownership of the unfinished session.
- Workout progress is written before paint and flushed when the page is hidden or closed. It includes the exercise and set position, logged sets, rest deadline, paused rest, pause duration, draft repetitions/weight/RPE, circuit rest settings, and an unfinished completion summary.
- Time is calculated from timestamps and excludes paused periods; it does not depend on a foreground-only interval. “Pause & leave” now actually pauses and saves before navigating.
- Recovery changes notify other open screens immediately. Focus and storage events refresh the return bar.
- Storage failures are visible. The workout is kept open rather than claiming it has a durable recovery copy.
- Exercise IDs now move with their exercises when the session is reordered.
- Exercises with no previous session use the planned starting values instead of crashing the tracker.

## Saving

Final save waits for pending set requests, reconciles all locally logged sets against the account's session exercises, and updates existing rows when retried. Network failures keep the recovery copy and offer retry. The session and recovery copy are cleared only after the session save succeeds. Cardio/stretching extras have a saved checkpoint to avoid replaying successful saves on normal retries.

This is recovery on the current browser/origin, not cross-device or cross-subdomain synchronization. The subdomain rollout in the UX review still requires a state migration. The local snapshot is not a distributed lock for simultaneous trackers on multiple devices.

## Facebook sharing

The completed-workout summary has a **Share workout on Facebook** action. It opens an editable preview with duration, completed exercises, logged sets, repetitions, and optional total lifting volume. The user can add a short community message.

**Continue to Facebook** opens Facebook's URL-sharing composer; it does not publish automatically or prefill the user's Facebook comment. The user selects the audience and submits the post in Facebook. Copy-link and native sharing options are also provided.

The shared URL points to a public, sign-in-free summary card with a generated 1200 × 630 PNG for social previews. Its payload is strictly limited to the displayed summary fields. It contains no account ID, workout session ID, private tracker URL, body measurements, medication information, or other account data. Unknown payload fields are discarded. Malformed or oversized summaries return a safe unavailable state.

Sharing captures a fixed public summary in the URL; these links have no database-backed revocation mechanism. The pages request no search indexing. Editing the preview produces a different link. Facebook's final preview rendering, audience selection, and posting must be verified after the routes are deployed publicly; localhost URLs cannot be fetched by Facebook.

The default narration/UX patch remains part of the combined review package. This update does not post to Facebook, deploy the app, or configure production domains.

## Validation

- Eight focused workout tests cover recovery data, ownership, legacy migration, cancellation of stale restoration, corrupt snapshots, pause-aware timing, share payload filtering, retrying logged sets, and failed/missing-session saves.
- The local Chromium browser test uses fixture workouts and the existing development auth bypass. It verifies draft input restoration at a non-first exercise/set, navigation to another app page and back, reload, paused state, the same session ID, an unfinished summary, editing a Facebook preview, hiding volume, public summary rendering, and an actual PNG response. It never clicks the external Facebook link or submits a post.
- All 22 focused workout and voice tests passed. The full production build passed, including TypeScript and generation of 146 static pages.
- Run `npm run test:workout`, `npm run test:voice`, and `npm run build`.
- Browser test: start the local development server with the existing development bypass, then run `npm run test:workout:browser`. Set `WORKOUT_TEST_ORIGIN` for a different local port and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when using an environment-provided Chromium.
- Database writes were exercised through mocked query contracts, not against production. Actual Facebook posting, installed-app background behavior on iPhone/iPad, and live production database writes remain unverified.

Reference checked for native sharing behavior: [MDN Navigator.share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share). Meta's sharing documentation returned HTTP 429 during this session; the implementation uses a URL-only Facebook share link and leaves posting to the user's own composer.
