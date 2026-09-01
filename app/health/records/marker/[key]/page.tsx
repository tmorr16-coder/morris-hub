export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { LargeTitle, Group, Cell, Sparkline } from "@/components/ios";
import {
  BIOMARKER_BY_KEY,
  CATEGORY_LABELS,
  evaluateResult,
  formatRange,
  isImprovement,
  STATUS_COLOR,
  STATUS_LABEL,
} from "@/lib/health/biomarkers";
import { RangeBar, StatusBadge, type LabResultRow } from "../../_components/ResultRow";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function MarkerHistoryPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();
  const { key } = await params;

  const marker = BIOMARKER_BY_KEY[key];
  if (!marker) notFound();

  const { data: rows } = await db
    .from("health_lab_results")
    .select(
      "id, biomarker_key, name, panel, collected_on, value, value_text, unit, ref_low, ref_high, ref_text, flag, note, document_id"
    )
    .eq("user_id", userId)
    .eq("biomarker_key", key)
    .order("collected_on", { ascending: false })
    .limit(100);

  const history: (LabResultRow & { document_id: string | null })[] = rows ?? [];
  if (history.length === 0) notFound();

  const latest = history[0];
  const status = evaluateResult({
    value: latest.value,
    refLow: latest.ref_low,
    refHigh: latest.ref_high,
    refText: latest.ref_text,
    biomarkerKey: key,
    labFlag: latest.flag,
  });

  const numeric = history.filter((h) => h.value != null);
  const prior = numeric[1] ?? null;
  const delta = latest.value != null && prior?.value != null ? latest.value - prior.value : null;
  const improving = delta != null ? isImprovement(key, delta) : null;
  const deltaColor =
    improving === null ? "var(--ios-label-2)" : improving ? "var(--ios-green)" : "var(--ios-red)";

  // Sparkline reads left-to-right in time order.
  const series = numeric.slice(0, 24).reverse().map((h) => h.value as number);

  const refLow = latest.ref_low ?? marker.refLow ?? null;
  const refHigh = latest.ref_high ?? marker.refHigh ?? null;
  const range = formatRange(latest.ref_low, latest.ref_high, latest.ref_text, latest.unit ?? marker.unit);
  const optimal = formatRange(marker.optimalLow, marker.optimalHigh, null, marker.unit);

  return (
    <div className="ios-scroll">
      <LargeTitle title={marker.name} subtitle={CATEGORY_LABELS[marker.category]} />

      <div className="ios-list" style={{ margin: "8px 16px 0", padding: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div
              className="ios-num"
              style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.05, color: status === "normal" ? "var(--ios-label)" : STATUS_COLOR[status] }}
            >
              {latest.value ?? latest.value_text ?? "—"}
              {latest.unit && (
                <span className="ios-subhead" style={{ color: "var(--ios-label-2)", fontWeight: 400 }}> {latest.unit}</span>
              )}
            </div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>
              {fmtDate(latest.collected_on)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <StatusBadge status={status} />
            {delta != null && delta !== 0 && (
              <div className="ios-footnote" style={{ color: deltaColor, marginTop: 6 }}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta * 100) / 100)} since {fmtDate(prior!.collected_on)}
              </div>
            )}
          </div>
        </div>

        {latest.value != null && (refLow != null || refHigh != null) && (
          <RangeBar value={latest.value} refLow={refLow} refHigh={refHigh} status={status} />
        )}

        {series.length >= 2 && (
          <div style={{ marginTop: 16 }}>
            <Sparkline points={series} color="var(--ios-tint)" width={320} height={70} />
          </div>
        )}

        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.6, marginTop: 14 }}>
          {range && <div>Reference range {range}</div>}
          {optimal && <div>Optimal {optimal}</div>}
          {status === "borderline" && (
            <div style={{ color: "var(--ios-label)" }}>
              Inside the lab&apos;s reference range, but outside the tighter optimal target.
            </div>
          )}
        </div>

        {marker.about && (
          <div className="ios-subhead" style={{ color: "var(--ios-label-2)", lineHeight: 1.5, marginTop: 12 }}>
            {marker.about}
          </div>
        )}
      </div>

      <Group header="History" footer={`${history.length} result${history.length === 1 ? "" : "s"} on file.`}>
        {history.map((h) => {
          const s = evaluateResult({
            value: h.value,
            refLow: h.ref_low,
            refHigh: h.ref_high,
            refText: h.ref_text,
            biomarkerKey: key,
            labFlag: h.flag,
          });
          const row = (
            <>
              <span className="ios-cell-body">
                <span className="ios-cell-title">{fmtDate(h.collected_on)}</span>
                <span className="ios-cell-sub">{STATUS_LABEL[s]}{h.panel ? ` · ${h.panel}` : ""}</span>
              </span>
              <span className="ios-cell-trail">
                <span
                  className="ios-num"
                  style={{ fontWeight: 600, color: s === "normal" || s === "unknown" ? "var(--ios-label)" : STATUS_COLOR[s] }}
                >
                  {h.value ?? h.value_text ?? "—"}
                  {h.unit && h.value != null && (
                    <span className="ios-caption" style={{ color: "var(--ios-label-2)", fontWeight: 400 }}> {h.unit}</span>
                  )}
                </span>
              </span>
            </>
          );
          return h.document_id ? (
            <Link key={h.id} href={`/health/records/${h.document_id}`} className="ios-cell">
              {row}
            </Link>
          ) : (
            <div key={h.id} className="ios-cell">{row}</div>
          );
        })}
      </Group>

      {latest.note && (
        <Group header="From the report">
          <Cell chevron={false} title={<span style={{ fontSize: 15, lineHeight: 1.5 }}>{latest.note}</span>} />
        </Group>
      )}

      <div style={{ padding: "18px 16px 0" }}>
        <Link href="/health/records" style={{ color: "var(--ios-tint)", fontSize: 15, textDecoration: "none" }}>
          ← All records
        </Link>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}
