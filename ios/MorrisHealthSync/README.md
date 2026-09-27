# Morris Health Sync

A small iPhone app that sends Apple Health data to morrisai.family as it
arrives, instead of waiting for someone to tap Export.

## How it works

- **HealthKit background delivery.** The app registers an observer for each
  type it reads (steps, energy, distance, exercise and stand time, heart rate,
  resting heart rate, HRV, respiratory rate, blood oxygen, workouts). iOS wakes
  the app when the watch or phone writes new samples.
- **Hourly buckets, only what changed.** Each run re-reads the last 48 hours
  in hourly totals or averages and uploads only the buckets whose value moved.
  The server replaces a bucket it already has, so the current hour fills in
  through the day and a missed wake-up costs nothing.
- **Its own token.** Pairing trades a ten-minute, single-use code for a device
  token kept in the Keychain. The server stores only a hash and the phone can
  be revoked from the integrations page.

## The limit nobody can remove

Apple encrypts Health data while the iPhone is locked. If a workout ends while
the phone is in a pocket, the app is woken, finds Health unreadable, and sends
the moment the phone is next unlocked. "Near real time" here means within
moments of the next unlock, which in practice is minutes, not days.

## Build it

This has to happen on a Mac. Xcode does not run in a Codespace or on Linux.

1. Get the code onto the Mac. In Xcode: **Integrate → Clone…** (called
   **Source Control → Clone…** in older versions), sign in to GitHub when
   asked, and choose `tmorr16-coder/morris-hub`. Then open
   `ios/MorrisHealthSync/MorrisHealthSync.xcodeproj` from the folder it
   saved. The project file is committed; nothing needs installing first.

2. In Xcode select the **MorrisHealthSync** target → **Signing & Capabilities**.
   - Choose your **Team**.
   - Confirm **HealthKit** is listed with **Background Delivery** ticked. If
     it is not, press **+ Capability**, add HealthKit, and tick it.
   - If the bundle identifier `family.morrisai.healthsync` is taken, change it
     to anything unique.
3. Plug in the iPhone, pick it as the run destination, press **Run**.
   HealthKit does not work in the Simulator for real data; use the phone.

### After adding or removing a source file

The project lists its files by name, so regenerate it:

```
gem install xcodeproj
ruby generate-project.rb
```

That script runs on Linux too. `project.yml` describes the same project for
anyone who prefers XcodeGen.

## First run

1. Run the server migration `supabase/migrations/20260927_health_devices.sql`.
2. On the iPhone, open morrisai.family → Health → Settings → Integrations →
   **Pair an iPhone**, then **Open in Morris Health**. Or type the code shown.
3. In the app, **Allow access to Apple Health** and turn every category on.
4. Watch the integrations page: the phone appears with a "last seen" time.

Once it is sending, turn Health Auto Export's automation off so the two do not
both upload. Nothing breaks if they overlap; the server keeps one row per hour
and one workout per start time.

## Keeping it alive

An app distributed from Xcode with a paid developer account runs for a year
before it needs re-installing. TestFlight builds last 90 days and update
themselves; that is the easier way to put it on a second phone.
