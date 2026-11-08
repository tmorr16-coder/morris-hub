# Morris Hub security tracker

Admin module: `/home/admin/security`. Only an authenticated profile with the admin role can open it. All security tables and RPCs are restricted to the server service role; ordinary users cannot read findings through the Data API.

## Reviews and fixes

`.github/workflows/security-review.yml` runs on pushes to main, manually from GitHub Actions, and through an admin-configurable daily or weekly schedule (default 7:17 a.m. America/Indiana/Indianapolis). Scheduled Actions can be delayed by GitHub. The review uses CodeQL's extended JavaScript/TypeScript security queries and an npm lockfile audit. Dependabot also checks npm daily and GitHub Actions weekly.

The remediation job runs `npm audit fix --package-lock-only --ignore-scripts`, without `--force`. If the lockfile changes, it installs without lifecycle scripts and runs security, narration, and workout tests plus the production build. Only a passing candidate can open/update `security/compatible-dependency-fixes`. GitHub must allow Actions to create pull requests (repository Settings → Actions → General → Workflow permissions). A denied PR write is recorded as a remediation failure and emailed.

Compatible lockfile-only PRs merge automatically after validation if both main and the PR head still match the tested candidate and repository policy allows it. The merge uses an expected head SHA and does not bypass protection. A new review is explicitly dispatched after merging to confirm resolution. If publication, merging or follow-up scheduling fails, the issue is emailed and left for manual review. CodeQL code changes, unsupported fixes, and major dependency upgrades require manual review; this workflow does not claim to autonomously fix arbitrary application code. Findings close only when a later successful review no longer reports them. The tracker preserves findings from failed sources and ignores reports older than the latest run. A fix PR is never equivalent to a resolved vulnerability.

## Reporting and email

The report job uses a short-lived GitHub OIDC token rather than a stored production secret. The API verifies GitHub's signing keys, issuer, audience, immutable repository ID, exact main-branch workflow, event type, run ID, attempt, and commit SHA. PR workflows cannot report or alter findings. Reports are bounded and external links are restricted to this repository or GitHub advisories.

Alerts go to the owner-approved recipient **tmorr16@gmail.com** using the existing Resend account and verified `RESEND_FROM_EMAIL`. Alerts include medium/high/critical findings (including pending fix PRs), incomplete scans, failed fix validation or PR publication, and reports older than 36 hours. Unresolved issues receive daily reminders. Resend acceptance is recorded, not a claim of inbox delivery. A persisted queue, database claims and provider idempotency keys protect retries and concurrent jobs; failed sends remain visible in the admin module.

`/api/cron/security-alerts` runs daily at 14:47 UTC to retry pending messages and check report freshness independently of Actions. It fails closed unless `CRON_SECRET` is configured. The existing production `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and Supabase service-role configuration are required. If the entire site or email provider is unavailable, no system hosted solely on that site can guarantee email; check GitHub Actions failure notifications as a separate channel.

## Verification

- `npm run test:security`: signed-run authorization boundaries, payload limits, URL restrictions, audit/SARIF normalization, incomplete scans, cron authentication, notification retries and deduplication.
- Database transaction fixture verifies privileges, initial ingestion, failed-source retention, stale-run rejection, and resolution on a completed clean scan; fixture is rolled back.
- `npm run test:voice`, `npm run test:workout`, `npm run build`.

These automated reviews cover dependency advisories and statically detected code issues. They do not replace runtime testing or a full security assessment.

## Ad hoc scans and configurable scheduling

Admins use **Scan now** in the tracker to enqueue a full review. The same page edits daily/weekly frequency, local Eastern time, weekday, or pauses scheduled reviews. It shows queued/running/completed/failed requests and links each claimed request to its GitHub run. Pending requests refresh every 30 seconds.

The trusted workflow checks the private queue every five minutes, using GitHub OIDC rather than a long-lived GitHub token in the app. GitHub may delay a poll. Empty polls skip scanning. An ad hoc request runs even while the schedule is paused; pushes still trigger reviews. A new main SHA is also detected by polls, so coalesced GitHub push runs are recovered. Requests are deduplicated and claimed transactionally. Reports mark their request completed or failed; abandoned claims expire after two hours. Saving uses a version check to avoid overwriting another admin's schedule.

The watchdog respects weekly and paused schedules and flags stalled ad hoc requests or runs. Eastern scheduling follows actual local minutes across DST; a time that does not exist on a spring-forward day runs at its next valid occurrence.

## SimpleFIN recovery

Manual Money sync now includes both active and errored connections, remains owner-scoped, and reports partial failures. Account reads have a 40-second deadline instead of 15 seconds. Recurring sync uses the previous successful sync minus a five-day overlap, capped at 90 days for first sync/recovery. The daily cron moves away from the top of the hour to 09:23 UTC, and the sync handler has a 300-second runtime budget. Partial provider/account-save failures retain the last full-success time and remain visible. No access URLs or credentials are exposed.

## Cyber agent / Fix now

The Security page includes **Fix now** for each open finding and a batch control. Admin authorization is checked for every request. Repairs use the same private, transactional queue as ad hoc scans; a repair request upgrades a queued scan and multiple different targets coalesce to a batch. Requests remain visible until the signed worker reports completion.

The worker attempts compatible dependency fixes and, for code findings, matches the open GitHub code-scanning alert by source location. Ambiguous matches are not patched. GitHub Copilot Autofix generates supported code changes. Feature/license/permission errors, unsupported queries, generation still pending, changed main branches and scope violations remain visible as blocked or pending outcomes. A request attempts at most three new code generations, with bounded polling. Existing open fix PRs are reused rather than duplicated.

Generated changes are restricted to application JavaScript/TypeScript under app, lib, components or hooks; changes to workflows, dependency manifests, scripts, tests or infrastructure are not executed. Candidate commits run in separate read-only GitHub jobs without app secrets or an OIDC permission. Install lifecycle scripts are disabled; security, narration, workout, bank-sync tests and the production build run. Mixed/failed validation is never labeled passed. Sensitive or unverified application code PRs require human review; the risk policy below governs low-risk automatic changes. A subsequent main scan must confirm resolution.

The tracker shows the latest repair outcome and fix PR link for each finding, with outcome history retained in review records. Blocked repairs and failed validation are included in security email alerts. GitHub Copilot Autofix must be available for the repository and the specific alert; this module does not claim arbitrary vulnerabilities are automatically fixable or that passing tests proves the platform is secure.

## In-platform PR review and merge

**Security → Review fixes** lists security-agent and dependency-bot PRs with prominent internal review buttons and visible check states. The admin-only PR page shows the description, escaped file diffs, additions/removals, last reported checks and a **Merge after checks** action. Incomplete/binary diffs require full GitHub review instead; stale snapshots require a refresh. Refreshes and merge requests are authenticated server actions, not browser access to GitHub credentials.

The trusted worker refreshes metadata roughly every ten minutes and on scans or explicit requests. Targeted refreshes retain the foreign key to already tracked PRs. An unknown PR requests a general discovery refresh. GitHub checks commands every five minutes and may delay jobs. SQL deduplicates requests, claims them transactionally and binds results to the signed worker run. Review snapshots and commands remain service-role only.

Merge requests contain the exact reviewed PR head and actual main SHA. The worker checks those against GitHub, creates an isolated temporary merge-preview branch from the reviewed main, and validates the resulting immutable commit in a read-only job without OIDC or application secrets. It supports both merge commits and fast-forward previews. The PR API's cached base metadata is not used as the current main reference. After tests and build pass, the trusted merge job rechecks versions, uses GitHub's expected-head merge parameter, respects repository rules and dispatches a follow-up security scan. Temporary refs are removed only if still pointing at the tested candidate. Failed/blocked merges remain visible and feed security email alerts. Opening the page never authorizes a merge. Signed worker metadata can enqueue only changes allowed by the explicitly enabled risk policy below.

Tests cover stale/changed heads and main, preview ancestry and tree binding, failed validation, fork/draft/conflict rejection, admin-only actions, bounded snapshots, SQL dedup/run ownership and responsive escaped diff rendering.


## Risk-based autopilot

Security defaults to one **Protect now** action and a **Needs your review** queue. Protect now enables automatic remediation and queues a fresh scan/repair batch atomically. Scheduled and push reviews attempt repairs while automation is enabled. Findings, schedules, per-finding actions and audit logs remain under expandable details. Human PRs show why judgment is needed and sort by the source alert severity; unassociated maintenance upgrades sort last.

Policy v1 is deterministic and fail-closed. It reads complete files from immutable main/head SHAs rather than accepting the PR description as a risk assessment. Low risk currently means either (a) lockfile-only compatible version updates with the same package set/root requirements, no major upgrades (or zero-major minor changes), downgrades, install hooks or non-registry sources; or (b) at most two modified stateless presentation components and 60 changed lines tied to an open source alert, unchanged imports, no state/I/O/security/navigation APIs, and no protected paths. Larger, sensitive, unknown, conflicting and failed changes require review. Vulnerability urgency and regression risk are separate: critical urgency never bypasses the patch-risk gate.

All automatic requests use the existing exact-head/main merge-preview tests and production build. Automatic code changes additionally run CodeQL security-extended with uploads disabled; missing/incomplete reports or any finding in the changed files blocks merge. Candidate jobs retain read-only credentials without application secrets or OIDC. The policy script is checked out from the trusted workflow SHA after candidate execution. Privileged prepare/apply stages never execute the candidate. The worker re-assesses risk and checks service-side current authorization before both prepare and apply. GitHub repository rules still apply.

Automatic merges serialize one at a time. Failed versions are not retried automatically (except a changed main or an administrator pause); users can explicitly review/retry. Automatic/manual provenance and results remain in the command log. Pause stops queued automatic merges and fails current automatic authorization checks; an already submitted GitHub merge can finish. Pausing repairs does not pause monitoring. Compatible dependency fixes enter the same risk queue, replacing the older direct lockfile merge path. No force upgrades or security-rule bypasses are used. A subsequent scan must confirm a finding resolved.
