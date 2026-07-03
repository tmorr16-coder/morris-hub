export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import WellnessClient, { type WellnessEntry } from "./_components/WellnessClient";
import { LargeTitle } from "@/components/ios";

export default async function WellnessPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();

  const { data } = await db
    .from("wellness_entries")
    .select("id, date, mood, notes, created_at")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(30);

  const entries: WellnessEntry[] = (data as WellnessEntry[] | null) ?? [];

  return (
    <div className="ios-scroll">
      <LargeTitle title="Wellness" subtitle="Private mood check-in" />
      <WellnessClient initialEntries={entries} userId={userId} />
    </div>
  );
}
