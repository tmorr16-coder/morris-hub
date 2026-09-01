export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser, createServiceClient } from "@/lib/supabase/server";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import LabsClient, { type PanelSummary } from "./_components/LabsClient";

export default async function LabsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  let panels: PanelSummary[] = [];
  let tableMissing = false;
  try {
    const { data: panelRows, error } = await db
      .from("lab_panels")
      .select("id, collected_on, panel_name, lab_name")
      .eq("user_id", user.id)
      .order("collected_on", { ascending: false })
      .limit(50);
    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (panelRows ?? []) as any[];
    if (rows.length) {
      const { data: resultRows } = await db
        .from("lab_results")
        .select("panel_id, analyte, value_num, value_text, unit, ref_low, ref_high, ref_text, flag")
        .eq("user_id", user.id)
        .in("panel_id", rows.map((p) => p.id));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byPanel = new Map<string, any[]>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of ((resultRows ?? []) as any[])) {
        if (!byPanel.has(r.panel_id)) byPanel.set(r.panel_id, []);
        byPanel.get(r.panel_id)!.push(r);
      }

      panels = rows.map((p) => {
        const rs = byPanel.get(p.id) ?? [];
        return {
          id: p.id as string,
          collectedOn: String(p.collected_on),
          panelName: String(p.panel_name),
          labName: (p.lab_name ?? null) as string | null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          results: rs.map((r: any) => ({
            analyte: String(r.analyte),
            value: typeof r.value_num === "number" ? r.value_num : null,
            valueText: (r.value_text ?? null) as string | null,
            unit: (r.unit ?? null) as string | null,
            refLow: typeof r.ref_low === "number" ? r.ref_low : null,
            refHigh: typeof r.ref_high === "number" ? r.ref_high : null,
            refText: (r.ref_text ?? null) as string | null,
            flag: String(r.flag ?? "unknown"),
          })),
        };
      });
    }
  } catch {
    tableMissing = true;
  }

  return (
    <IOSScreen>
      <LargeTitle brand title="Labs" subtitle="Bloodwork, and what moved between draws" />
      <div style={{ padding: "0 16px" }}>
        <LabsClient panels={panels} tableMissing={tableMissing} />
      </div>
      <div style={{ height: 12 }} />
      <TabBar current="health" currentUserId={user.id} sourceApp="health" />
    </IOSScreen>
  );
}
