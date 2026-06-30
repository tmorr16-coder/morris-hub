import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/health/auth";
import PlatformMenu from "@/components/PlatformMenu";
// Health-specific BottomNav removed — platform BottomNav (in PlatformMenu) handles mobile nav

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let menuUser = null;

  // Skip approval check in local dev bypass mode
  if (process.env.NEXT_PUBLIC_AUTH_BYPASS !== "true") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;
    const userId = await getCurrentUserId();
    const { data } = await db
      .from("profiles")
      .select("status, role, app_access")
      .eq("id", userId)
      .maybeSingle();
    const profile = data as { status?: string; role?: string; app_access?: string[] } | null;
    const status = profile?.status;

    if (status === "pending") redirect("/pending-approval");
    if (status === "rejected") redirect("/?error=account_rejected");

    // Per-app access gate. Admins always pass; legacy users without an
    // app_access array also pass (treated as full-access until backfilled).
    const isAdmin = profile?.role === "admin";
    const appAccess = profile?.app_access;
    if (!isAdmin && Array.isArray(appAccess) && !appAccess.includes("health")) {
      redirect("/");
    }

    // Build menuUser from auth for the PlatformMenu
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      menuUser = {
        name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        email: user.email,
        avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
        isAdmin,
      };
    }
  }

  return (
    <>
      <PlatformMenu currentApp="health" user={menuUser} />
      <div data-section="health" style={{ paddingBottom: 100 }}>
        {children}
      </div>
    </>
  );
}
