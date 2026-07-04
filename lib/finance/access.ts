import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";

export interface FinanceMenuUser {
  name: string | null;
  email: string | null | undefined;
  avatarUrl: string | null;
  isAdmin: boolean;
}

/**
 * Gate a finance page on auth + per-app access.
 * Redirects to "/" if not signed in, "/no-access" if missing finance access.
 * Admins always pass. Legacy users with no app_access array also pass.
 */
export async function requireFinanceAccess(): Promise<{
  user: NonNullable<Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]>>["data"]["user"]>;
  isAdmin: boolean;
  menuUser: FinanceMenuUser;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const [{ data }, prefs] = await Promise.all([
    service.from("profiles").select("role, app_access").eq("id", user.id).maybeSingle(),
    getPreferences(user.id),
  ]);
  const profile = data as { role?: string; app_access?: string[] } | null;
  const isAdmin = profile?.role === "admin";
  const profileAccess = profile?.app_access;
  const prefsAccess = prefs.app_access;

  // Access is the union of the legacy profiles list and the modern preferences
  // list (onboarding writes preferences.app_access, not profiles.app_access).
  const hasFinance =
    isAdmin ||
    !Array.isArray(profileAccess) || // legacy account with no explicit list → allow
    profileAccess.includes("finance") ||
    (Array.isArray(prefsAccess) && prefsAccess.includes("finance"));

  if (!hasFinance) redirect("/finance/no-access");

  return {
    user,
    isAdmin,
    menuUser: {
      name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      email: user.email,
      avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
      isAdmin,
    },
  };
}
