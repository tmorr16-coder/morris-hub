export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { LargeTitle } from "@/components/ios";
import VitalsClient, { type VitalsRecord } from "./_components/VitalsClient";

export default async function VitalsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();

  const { data } = await db
    .from("health_vitals")
    .select(
      "id, measured_on, systolic, diastolic, pulse_bpm, temperature_f, spo2_pct, respiratory_rate, weight_lbs, waist_in, context, notes"
    )
    .eq("user_id", userId)
    .order("measured_on", { ascending: false })
    .limit(60);

  const readings: VitalsRecord[] = data ?? [];

  return (
    <div className="ios-scroll">
      <LargeTitle title="Vitals" subtitle="Blood pressure, pulse and other readings" />
      <VitalsClient initial={readings} />
      <div style={{ padding: "18px 16px 0" }}>
        <Link href="/health/records" style={{ color: "var(--ios-tint)", fontSize: 15, textDecoration: "none" }}>
          ← All records
        </Link>
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}
