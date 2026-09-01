export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { LargeTitle, Group, Cell } from "@/components/ios";
import { evaluateResult, type ResultStatus } from "@/lib/health/biomarkers";
import { ResultRow, type LabResultRow } from "../_components/ResultRow";
import DocumentActions from "../_components/DocumentActions";

interface Doc {
  id: string;
  kind: string;
  title: string;
  source: string | null;
  performed_on: string;
  reported_on: string | null;
  provider: string | null;
  facility: string | null;
  accession: string | null;
  summary: string | null;
  notes: string | null;
  file_name: string | null;
  file_path: string | null;
  entry_method: string;
}

interface BodyComp {
  measured_on: string;
  device: string | null;
  weight_lbs: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  body_fat_mass_lbs: number | null;
  lean_body_mass_lbs: number | null;
  skeletal_muscle_lbs: number | null;
  dry_lean_mass_lbs: number | null;
  total_body_water_lbs: number | null;
  intracellular_water_lbs: number | null;
  extracellular_water_lbs: number | null;
  ecw_tbw: number | null;
  visceral_fat_area: number | null;
  bmr_kcal: number | null;
  smi: number | null;
  leg_lean_mass_lbs: number | null;
  phase_angle: number | null;
  segmental_lean: Record<string, number> | null;
  segmental_fat: Record<string, number> | null;
  fat_mass_control_lbs: number | null;
  lean_mass_control_lbs: number | null;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const SEGMENT_LABELS: Record<string, string> = {
  right_arm: "Right arm",
  left_arm: "Left arm",
  trunk: "Trunk",
  right_leg: "Right leg",
  left_leg: "Left leg",
};

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();
  const { documentId } = await params;

  const { data: doc } = await db
    .from("health_record_documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!doc) notFound();
  const record = doc as Doc;

  const [{ data: resultRows }, { data: bodyCompRows }, { data: vitalsRows }] = await Promise.all([
    db
      .from("health_lab_results")
      .select(
        "id, biomarker_key, name, panel, collected_on, value, value_text, unit, ref_low, ref_high, ref_text, flag, note"
      )
      .eq("user_id", userId)
      .eq("document_id", documentId)
      .order("name", { ascending: true }),
    db
      .from("health_body_composition")
      .select("*")
      .eq("user_id", userId)
      .eq("document_id", documentId)
      .maybeSingle(),
    db
      .from("health_vitals")
      .select("*")
      .eq("user_id", userId)
      .eq("document_id", documentId)
      .maybeSingle(),
  ]);

  const results: LabResultRow[] = resultRows ?? [];
  const bodyComp = bodyCompRows as BodyComp | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vitals = vitalsRows as Record<string, any> | null;

  const statusOf = (r: LabResultRow): ResultStatus =>
    evaluateResult({
      value: r.value,
      refLow: r.ref_low,
      refHigh: r.ref_high,
      refText: r.ref_text,
      biomarkerKey: r.biomarker_key,
      labFlag: r.flag,
    });

  const outOfRange = results.filter((r) => {
    const s = statusOf(r);
    return s === "high" || s === "low";
  });

  // Group by the panel heading the lab printed, preserving report order.
  const panels = new Map<string, LabResultRow[]>();
  for (const r of results) {
    const key = r.panel?.trim() || "Results";
    const list = panels.get(key) ?? [];
    list.push(r);
    panels.set(key, list);
  }

  const meta = [
    record.source && `Source: ${record.source}`,
    record.provider && `Ordered by ${record.provider}`,
    record.facility && `Performed at ${record.facility}`,
    record.reported_on && `Reported ${fmtDate(record.reported_on)}`,
    record.accession && `Accession ${record.accession}`,
  ].filter(Boolean) as string[];

  return (
    <div className="ios-scroll">
      <LargeTitle title={record.title} subtitle={fmtDate(record.performed_on)} />

      {(record.summary || meta.length > 0) && (
        <div className="ios-list" style={{ margin: "8px 16px 0", padding: 16 }}>
          {record.summary && (
            <div className="ios-subhead" style={{ lineHeight: 1.5, marginBottom: meta.length ? 12 : 0 }}>
              {record.summary}
            </div>
          )}
          {meta.map((m) => (
            <div key={m} className="ios-caption" style={{ color: "var(--ios-label-2)", lineHeight: 1.6 }}>
              {m}
            </div>
          ))}
          {results.length > 0 && (
            <div className="ios-caption" style={{ color: "var(--ios-label-2)", lineHeight: 1.6, marginTop: 8 }}>
              {results.length} results · {outOfRange.length} outside the reference range
            </div>
          )}
        </div>
      )}

      {bodyComp && (
        <>
          <Group header="Body composition" footer={bodyComp.device ?? undefined}>
            {(
              [
                ["Weight", bodyComp.weight_lbs, "lbs"],
                ["BMI", bodyComp.bmi, ""],
                ["Percent body fat", bodyComp.body_fat_pct, "%"],
                ["Body fat mass", bodyComp.body_fat_mass_lbs, "lbs"],
                ["Lean body mass", bodyComp.lean_body_mass_lbs, "lbs"],
                ["Skeletal muscle mass", bodyComp.skeletal_muscle_lbs, "lbs"],
                ["Dry lean mass", bodyComp.dry_lean_mass_lbs, "lbs"],
                ["Total body water", bodyComp.total_body_water_lbs, "lbs"],
                ["Intracellular water", bodyComp.intracellular_water_lbs, "lbs"],
                ["Extracellular water", bodyComp.extracellular_water_lbs, "lbs"],
                ["ECW/TBW", bodyComp.ecw_tbw, ""],
                ["Visceral fat area", bodyComp.visceral_fat_area, "cm²"],
                ["Basal metabolic rate", bodyComp.bmr_kcal, "kcal"],
                ["Skeletal muscle index", bodyComp.smi, "kg/m²"],
                ["Leg lean mass", bodyComp.leg_lean_mass_lbs, "lbs"],
                ["Phase angle", bodyComp.phase_angle, "°"],
                ["Body fat to lose", bodyComp.fat_mass_control_lbs, "lbs"],
                ["Lean mass to gain", bodyComp.lean_mass_control_lbs, "lbs"],
              ] as [string, number | null, string][]
            )
              .filter(([, v]) => v != null)
              .map(([label, v, unit]) => (
                <Cell
                  key={label}
                  chevron={false}
                  title={label}
                  trailing={
                    <span className="ios-num" style={{ fontWeight: 600, color: "var(--ios-label)" }}>
                      {v}
                      {unit && <span className="ios-caption" style={{ color: "var(--ios-label-2)", fontWeight: 400 }}> {unit}</span>}
                    </span>
                  }
                />
              ))}
          </Group>

          {(["segmental_lean", "segmental_fat"] as const).map((field) => {
            const seg = bodyComp[field];
            if (!seg || Object.keys(seg).length === 0) return null;
            return (
              <Group key={field} header={field === "segmental_lean" ? "Segmental lean mass" : "Segmental fat mass"}>
                {Object.entries(seg).map(([k, v]) => (
                  <Cell
                    key={k}
                    chevron={false}
                    title={SEGMENT_LABELS[k] ?? k}
                    trailing={
                      <span className="ios-num" style={{ fontWeight: 600, color: "var(--ios-label)" }}>
                        {v}
                        <span className="ios-caption" style={{ color: "var(--ios-label-2)", fontWeight: 400 }}> lbs</span>
                      </span>
                    }
                  />
                ))}
              </Group>
            );
          })}
        </>
      )}

      {vitals && (
        <Group header="Vitals">
          {(
            [
              ["Blood pressure", vitals.systolic != null && vitals.diastolic != null ? `${vitals.systolic}/${vitals.diastolic}` : null, "mmHg"],
              ["Pulse", vitals.pulse_bpm, "bpm"],
              ["Temperature", vitals.temperature_f, "°F"],
              ["SpO₂", vitals.spo2_pct, "%"],
              ["Respiratory rate", vitals.respiratory_rate, "/min"],
              ["Weight", vitals.weight_lbs, "lbs"],
              ["Height", vitals.height_in, "in"],
              ["Waist", vitals.waist_in, "in"],
            ] as [string, string | number | null, string][]
          )
            .filter(([, v]) => v != null)
            .map(([label, v, unit]) => (
              <Cell
                key={label}
                chevron={false}
                title={label}
                trailing={
                  <span className="ios-num" style={{ fontWeight: 600, color: "var(--ios-label)" }}>
                    {v} <span className="ios-caption" style={{ color: "var(--ios-label-2)", fontWeight: 400 }}>{unit}</span>
                  </span>
                }
              />
            ))}
        </Group>
      )}

      {outOfRange.length > 0 && (
        <Group header="Outside the reference range">
          {outOfRange.map((r) => (
            <ResultRow key={r.id} result={r} />
          ))}
        </Group>
      )}

      {[...panels.entries()].map(([panel, rows]) => (
        <Group key={panel} header={panel}>
          {rows.map((r) => (
            <ResultRow key={r.id} result={r} />
          ))}
        </Group>
      ))}

      {record.notes && (
        <Group header="Notes">
          <Cell chevron={false} title={record.notes} />
        </Group>
      )}

      <DocumentActions
        documentId={record.id}
        title={record.title}
        hasFile={!!record.file_path}
        fileName={record.file_name}
      />

      <div style={{ height: 24 }} />
    </div>
  );
}
