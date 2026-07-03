import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/health/auth";
import { TabBar } from "@/components/ios";

export default async function HealthLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Skip approval/access gate in local dev bypass mode
  if (process.env.NEXT_PUBLIC_AUTH_BYPASS !== "true") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;
    const userId = await getCurrentUserId();
    const { data } = await db.from("profiles").select("status, role, app_access").eq("id", userId).maybeSingle();
    const profile = data as { status?: string; role?: string; app_access?: string[] } | null;
    if (profile?.status === "pending") redirect("/pending-approval");
    if (profile?.status === "rejected") redirect("/?error=account_rejected");
    const isAdmin = profile?.role === "admin";
    const appAccess = profile?.app_access;
    if (!isAdmin && Array.isArray(appAccess) && !appAccess.includes("health")) redirect("/");
  }

  return (
    <div data-ui="ios">
      {children}
      <TabBar current="health" currentUserId={user?.id} sourceApp="health" />
    </div>
  );
}
