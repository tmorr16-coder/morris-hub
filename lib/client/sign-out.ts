import { createClient } from "@/lib/supabase/client";

// Signing out of a shared family device.
//
// Several screens keep the signed-in person's own data in this browser:
// the health profile, the medication log, advisor and Ask threads, a
// workout in progress, the Bible reading session, the finance PIN unlock.
// Sign-out used to end the session and leave all of it behind, so the next
// person to sign in on the family iPad could open Health and find someone
// else's profile, or Money already unlocked.
//
// Everything this origin stored goes, except a few settings that belong to
// the device rather than to a person.

const DEVICE_PREFERENCES = new Set([
  "ios-theme", "ios-scheme", "morris:navMode", "morris-mode", "buddy-voice", "buddy-rate",
]);

export function clearPersonalBrowserData(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!DEVICE_PREFERENCES.has(key)) localStorage.removeItem(key);
    }
  } catch { /* storage blocked: nothing was kept */ }
  try { sessionStorage.clear(); } catch { /* as above */ }
}

/** End the session and clear this person's data from the browser. Navigation is the caller's. */
export async function signOutOfDevice(): Promise<void> {
  clearPersonalBrowserData();
  try { await createClient().auth.signOut(); } catch { /* local data is already gone; the cookie expires */ }
}
