export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import ProfileClient from "./_components/ProfileClient";

export default async function ProfilePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();

  const [{ data: weightRow }, { data: profileRow }] = await Promise.all([
    db.from("apple_health_metrics")
      .select("value")
      .eq("user_id", userId)
      .eq("source", "withings")
      .eq("metric_name", "weight")
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("profiles").select("role").eq("id", userId).maybeSingle(),
  ]);

  const withingsWeightLbs: number | null = weightRow?.value ?? null;
  const isAdmin = (profileRow as { role: string } | null)?.role === "admin";

  return (
    <div className="ios-scroll">
      <ProfileClient withingsWeightLbs={withingsWeightLbs} isAdmin={isAdmin} />
    </div>
  );
}
