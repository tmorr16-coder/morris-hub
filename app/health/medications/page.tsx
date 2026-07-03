export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import MedicationsClient, { type Med } from "./_components/MedicationsClient";
import { LargeTitle } from "@/components/ios";


export default async function MedicationsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();

  const { data: medsData, error: medsError } = await db
    .from("medications")
    .select("id, name, dose, schedule")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: true });

  const meds: Med[] = medsError ? [] : (medsData ?? []);

  return (
    <div className="ios-scroll">
      <LargeTitle title="Medications" subtitle="Your daily baseline" />
      <div style={{ padding: "0 16px" }}>
        <MedicationsClient initialMeds={meds} />
      </div>
    </div>
  );
}
