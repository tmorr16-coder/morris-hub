import { createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";

/**
 * Whether a user may access a module, resilient to the dual-source app_access
 * split. Access is the union of the two stores that can legitimately diverge:
 *  - public.profiles.app_access — written by admin approve/grant flows
 *  - hub.preferences.app_access — written by onboarding, read by getPreferences()
 * Admins always pass; a legacy account with no explicit profiles list passes.
 * Mirrors lib/finance/access.ts so every module gate agrees.
 */
export async function hasModuleAccess(userId: string, moduleKey: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const [{ data }, prefs] = await Promise.all([
    service.from("profiles").select("role, app_access").eq("id", userId).maybeSingle(),
    getPreferences(userId),
  ]);
  const profile = data as { role?: string; app_access?: string[] } | null;
  if (profile?.role === "admin") return true;
  const profileAccess = profile?.app_access;
  if (!Array.isArray(profileAccess)) return true; // legacy account with no explicit list
  const prefsAccess = prefs.app_access;
  return profileAccess.includes(moduleKey) || (Array.isArray(prefsAccess) && prefsAccess.includes(moduleKey));
}
