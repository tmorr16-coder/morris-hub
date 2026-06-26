export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import MedicationsClient, { type Med } from "./_components/MedicationsClient";


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
    <div style={{ padding: "20px 20px 0" }}>

      {/* Eyebrow */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
          marginBottom: 6,
        }}
      >
        Health
      </div>

      {/* Display title */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 36,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          color: "var(--color-ink)",
          marginBottom: 24,
        }}
      >
        Your daily
        <br />
        baseline.
      </div>

      {/* Medications list */}
      <MedicationsClient initialMeds={meds} />

    </div>
  );
}
