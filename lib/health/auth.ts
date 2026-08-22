import { getCurrentUser } from "@/lib/supabase/server";

export const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Returns the authenticated user's UUID from their session.
 * Falls back to DEV_USER_ID when auth bypass is enabled (local dev).
 *
 * Goes through getCurrentUser() so this shares the one cached auth round-trip
 * per request. These two helpers each used to call supabase.auth.getUser()
 * themselves, which meant a health page calling both — under a layout that also
 * needed the user — paid for three separate trips to verify one JWT.
 */
export async function getCurrentUserId(): Promise<string> {
  if (process.env.NEXT_PUBLIC_AUTH_BYPASS === "true") {
    return DEV_USER_ID;
  }
  try {
    const user = await getCurrentUser();
    if (user?.id) return user.id;
  } catch { /* ignore */ }
  return DEV_USER_ID;
}

export async function getCurrentUserName(): Promise<string | null> {
  if (process.env.NEXT_PUBLIC_AUTH_BYPASS === "true") {
    return null;
  }
  try {
    const user = await getCurrentUser();
    if (user) {
      const meta = user.user_metadata ?? {};
      return meta.full_name ?? meta.name ?? user.email?.split("@")[0] ?? null;
    }
  } catch { /* ignore */ }
  return null;
}
