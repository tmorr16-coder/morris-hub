// Medical records change only when the user imports one, but an import
// must show up immediately — render fresh rather than serving a stale cache.
export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { LargeTitle, Group, Cell, IconBadge, Icons, Sparkline } from "@/components/ios";
import {
  BIOMARKER_BY_KEY,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  HEADLINE_MARKERS,
  evaluateResult,
  formatRange,
  isImprovement,
  STATUS_COLOR,
  type BiomarkerCategory,
  type ResultStatus,
} from "@/lib/health/biomarkers";
import { ResultRow, StatusBadge, type LabResultRow } from "./_components/ResultRow";

interface DocumentRow {
  id: string;
  kind: string;
  title: string;
  source: string | null;
  performed_on: string;
  provider: string | null;
  facility: string | null;
  summary: string | null;
  file_path: string | null;
}

interface BodyCompRow {
  id: string;
  measured_on: string;
  device: string | null;
  weight_lbs: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  body_fat_mass_lbs: number | null;
  skeletal_muscle_lbs: number | null;
  lean_body_mass_lbs: number | null;
  visceral_fat_area: number | null;
  bmr_kcal: number | null;
}

interface VitalsRow {
  id: string;
  measured_on: string;
  systolic: number | null;
  diastolic: number | null;
  pulse_bpm: number | null;
  weight_lbs: number | null;
  context: string | null;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function statusOf(r: LabResultRow): ResultStatus {
  return evaluateResult({
    value: r.value,
    refLow: r.ref_low,
    refHigh: r.ref_high,
    refText: r.ref_text,
    biomarkerKey: r.biomarker_key,
    labFlag: r.flag,
  });
}

export default async function HealthRecordsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();

  const [{ data: docRows }, { data: resultRows }, { data: bodyCompRows }, { data: vitalsRows }] =
    await Promise.all([
      db
        .from("health_record_documents")
        .select("id, kind, title, source, performed_on, provider, facility, summary, file_path")
        .eq("user_id", userId)
        .order("performed_on", { ascending: false })
        .limit(50),
      // Every result in one pass: latest values, per-marker history and the
      // trend deltas below are all derived from this in memory, which is far
      // cheaper than a query per marker.
      db
        .from("health_lab_results")
        .select(
          "id, biomarker_key, name, panel, collected_on, value, value_text, unit, ref_low, ref_high, ref_text, flag, note, document_id"
        )
        .eq("user_id", userId)
        .order("collected_on", { ascending: false })
        .limit(2000),
      db
        .from("health_body_composition")
        .select(
          "id, measured_on, device, weight_lbs, bmi, body_fat_pct, body_fat_mass_lbs, skeletal_muscle_lbs, lean_body_mass_lbs, visceral_fat_area, bmr_kcal"
        )
        .eq("user_id", userId)
        .order("measured_on", { ascending: false })
        .limit(24),
      db
        .from("health_vitals")
        .select("id, measured_on, systolic, diastolic, pulse_bpm, weight_lbs, context")
        .eq("user_id", userId)
        .order("measured_on", { ascending: false })
        .limit(12),
    ]);

  const documents: DocumentRow[] = docRows ?? [];
  const results: (LabResultRow & { document_id: string | null })[] = resultRows ?? [];
  const bodyComps: BodyCompRow[] = bodyCompRows ?? [];
  const vitals: VitalsRow[] = vitalsRows ?? [];

  const hasAnything =
    documents.length > 0 || results.length > 0 || bodyComps.length > 0 || vitals.length > 0;

  // ── Per-marker history, newest first ────────────────────────────────────
  const byMarker = new Map<string, LabResultRow[]>();
  for (const r of results) {
    if (!r.biomarker_key) continue;
    const list = byMarker.get(r.biomarker_key) ?? [];
    list.push(r);
    byMarker.set(r.biomarker_key, list);
  }

  // ── The most recent draw ────────────────────────────────────────────────
  const latestDate = results[0]?.collected_on ?? null;
  const latestPanel = latestDate ? results.filter((r) => r.collected_on === latestDate) : [];
  const latestDoc = documents.find((d) => d.performed_on === latestDate && d.kind === "lab_panel");

  const attention = latestPanel
    .map((r) => ({ r, s: statusOf(r) }))
    .filter(({ s }) => s === "high" || s === "low")
    .sort((a, b) => a.r.name.localeCompare(b.r.name));
  const watch = latestPanel
    .map((r) => ({ r, s: statusOf(r) }))
    .filter(({ s }) => s === "borderline");
  const inRange = latestPanel.filter((r) => statusOf(r) === "normal").length;

  // ── Key markers, with the change since the previous draw ────────────────
  const headline = HEADLINE_MARKERS.map((key) => {
    const history = byMarker.get(key);
    if (!history?.length) return null;
    const latest = history[0];
    if (latest.value == null) return null;
    const prior = history.slice(1).find((h) => h.value != null) ?? null;
    const delta = prior?.value != null ? latest.value - prior.value : null;
    return {
      key,
      marker: BIOMARKER_BY_KEY[key],
      latest,
      status: statusOf(latest),
      delta,
      // Oldest-first for the sparkline, capped so one long history doesn't
      // squash a short one.
      series: history
        .filter((h) => h.value != null)
        .slice(0, 12)
        .reverse()
        .map((h) => h.value as number),
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  // ── Categories present, for browsing the whole panel ────────────────────
  const categoriesPresent = new Set<BiomarkerCategory>();
  for (const key of byMarker.keys()) {
    const m = BIOMARKER_BY_KEY[key];
    if (m) categoriesPresent.add(m.category);
  }
  const categories = CATEGORY_ORDER.filter((c) => categoriesPresent.has(c));

  const latestBody = bodyComps[0] ?? null;
  const priorBody = bodyComps[1] ?? null;
  const latestVitals = vitals[0] ?? null;

  return (
    <div className="ios-scroll">
      <LargeTitle
        title="Health Records"
        subtitle={
          latestDate
            ? `Last results ${formatDate(latestDate)}${latestDoc?.source ? ` · ${latestDoc.source}` : ""}`
            : "Labs, scans and vitals in one place"
        }
      />

      {!hasAnything && (
        <div className="ios-list" style={{ margin: "8px 16px 0", padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <IconBadge color="var(--ios-tint)"><Icons.ChecklistIcon /></IconBadge>
            <div className="ios-headline">Add your first record</div>
          </div>
          <div className="ios-subhead" style={{ color: "var(--ios-label-2)", lineHeight: 1.5, marginBottom: 12 }}>
            Upload a lab report, a body-composition scan or a visit summary — a photo or PDF works.
            Every value is read off the document, checked against its reference range, and tracked
            so you can see which way it&apos;s moving.
          </div>
          <Link
            href="/health/records/import"
            style={{ display: "inline-block", padding: "10px 16px", borderRadius: 10, background: "var(--ios-tint)", color: "var(--ios-on-tint)", fontWeight: 600, fontSize: 15, textDecoration: "none" }}
          >
            Add a record →
          </Link>
        </div>
      )}

      {/* Standing of the most recent draw, in one line of counts. */}
      {latestPanel.length > 0 && (
        <div className="ios-list" style={{ margin: "8px 16px 0", padding: "16px 18px" }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 10 }}>
            {formatDate(latestDate!)} · {latestPanel.length} results
          </div>
          <div style={{ display: "flex", gap: 22 }}>
            {[
              { n: inRange, label: "in range", color: "var(--ios-green)" },
              { n: watch.length, label: "to watch", color: "var(--ios-yellow, #FFCC00)" },
              { n: attention.length, label: "out of range", color: "var(--ios-red)" },
            ].map((s) => (
              <div key={s.label}>
                <div className="ios-num" style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1.1 }}>
                  {s.n}
                </div>
                <div className="ios-caption" style={{ color: "var(--ios-label-2)" }}>{s.label}</div>
              </div>
            ))}
          </div>
          {latestDoc?.summary && (
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5, marginTop: 12 }}>
              {latestDoc.summary}
            </div>
          )}
        </div>
      )}

      {attention.length > 0 && (
        <Group header="Out of range" footer="Flagged by the lab or outside its reference range. Discuss with your physician.">
          {attention.map(({ r }) => (
            <ResultRow key={r.id} result={r} />
          ))}
        </Group>
      )}

      {watch.length > 0 && (
        <Group header="Worth watching" footer="Inside the lab's reference range, but outside the tighter optimal target.">
          {watch.map(({ r }) => (
            <ResultRow key={r.id} result={r} />
          ))}
        </Group>
      )}

      {headline.length > 0 && (
        <Group header="Key markers" footer="Change is measured against your previous result for that marker.">
          {headline.map((h) => {
            const improving = isImprovement(h.key, h.delta ?? 0);
            const deltaColor =
              improving === null ? "var(--ios-label-2)" : improving ? "var(--ios-green)" : "var(--ios-red)";
            const r1 = (n: number) => Math.round(n * 100) / 100;
            return (
              <Link key={h.key} href={`/health/records/marker/${h.key}`} className="ios-cell">
                <span className="ios-cell-body">
                  <span className="ios-cell-title">{h.marker.name}</span>
                  <span className="ios-cell-sub" style={{ color: h.delta != null ? deltaColor : undefined }}>
                    {h.delta != null && h.delta !== 0
                      ? `${h.delta > 0 ? "▲" : "▼"} ${Math.abs(r1(h.delta))} since last draw`
                      : formatRange(h.latest.ref_low, h.latest.ref_high, h.latest.ref_text, h.latest.unit) ?? ""}
                  </span>
                </span>
                {h.series.length >= 2 && <Sparkline points={h.series} color="var(--ios-tint)" width={78} height={30} />}
                <span className="ios-cell-trail" style={{ flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                  <span
                    className="ios-num"
                    style={{ fontWeight: 600, color: h.status === "normal" ? "var(--ios-label)" : STATUS_COLOR[h.status] }}
                  >
                    {h.latest.value}
                  </span>
                  <StatusBadge status={h.status} />
                </span>
              </Link>
            );
          })}
        </Group>
      )}

      {latestBody && (
        <Group
          header="Body composition"
          footer={`${latestBody.device ?? "Scan"} · ${formatDate(latestBody.measured_on)}`}
        >
          {(
            [
              { label: "Weight", value: latestBody.weight_lbs, unit: "lbs", prior: priorBody?.weight_lbs, lowerBetter: true },
              { label: "Body fat", value: latestBody.body_fat_pct, unit: "%", prior: priorBody?.body_fat_pct, lowerBetter: true },
              { label: "Skeletal muscle", value: latestBody.skeletal_muscle_lbs, unit: "lbs", prior: priorBody?.skeletal_muscle_lbs, lowerBetter: false },
              { label: "Visceral fat area", value: latestBody.visceral_fat_area, unit: "cm²", prior: priorBody?.visceral_fat_area, lowerBetter: true },
              { label: "BMI", value: latestBody.bmi, unit: "", prior: priorBody?.bmi, lowerBetter: true },
              { label: "Basal metabolic rate", value: latestBody.bmr_kcal, unit: "kcal", prior: priorBody?.bmr_kcal, lowerBetter: false },
            ] as const
          )
            .filter((m) => m.value != null)
            .map((m) => {
              const delta = m.prior != null && m.value != null ? m.value - m.prior : null;
              const improving = delta == null || delta === 0 ? null : m.lowerBetter ? delta < 0 : delta > 0;
              return (
                <Cell
                  key={m.label}
                  chevron={false}
                  title={m.label}
                  subtitle={
                    delta != null && delta !== 0 ? (
                      <span style={{ color: improving ? "var(--ios-green)" : "var(--ios-red)" }}>
                        {delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta * 10) / 10)} since last scan
                      </span>
                    ) : undefined
                  }
                  trailing={
                    <span className="ios-num" style={{ fontWeight: 600, color: "var(--ios-label)" }}>
                      {m.value}
                      {m.unit && <span className="ios-caption" style={{ color: "var(--ios-label-2)", fontWeight: 400 }}> {m.unit}</span>}
                    </span>
                  }
                />
              );
            })}
        </Group>
      )}

      {latestVitals && (
        <Group header="Latest vitals" footer={formatDate(latestVitals.measured_on)}>
          {latestVitals.systolic != null && latestVitals.diastolic != null && (
            <Cell
              chevron={false}
              lead={<IconBadge color="#FA114F"><Icons.HeartIcon /></IconBadge>}
              title="Blood pressure"
              subtitle={latestVitals.context ?? undefined}
              trailing={<span className="ios-num" style={{ fontWeight: 600 }}>{latestVitals.systolic}/{latestVitals.diastolic}</span>}
            />
          )}
          {latestVitals.pulse_bpm != null && (
            <Cell chevron={false} title="Pulse" trailing={<span className="ios-num" style={{ fontWeight: 600 }}>{latestVitals.pulse_bpm} bpm</span>} />
          )}
          {latestVitals.weight_lbs != null && (
            <Cell chevron={false} title="Weight" trailing={<span className="ios-num" style={{ fontWeight: 600 }}>{latestVitals.weight_lbs} lbs</span>} />
          )}
        </Group>
      )}

      {categories.length > 0 && (
        <Group header="Browse by panel">
          {categories.map((c) => {
            const keys = [...byMarker.keys()].filter((k) => BIOMARKER_BY_KEY[k]?.category === c);
            return (
              <Cell
                key={c}
                href={`/health/records/category/${c}`}
                title={CATEGORY_LABELS[c]}
                trailing={<span className="ios-num">{keys.length}</span>}
              />
            );
          })}
        </Group>
      )}

      {documents.length > 0 && (
        <Group header="Reports">
          {documents.map((d) => (
            <Cell
              key={d.id}
              href={`/health/records/${d.id}`}
              lead={<IconBadge color="var(--ios-tint)"><Icons.BookIcon /></IconBadge>}
              title={d.title}
              subtitle={`${formatDate(d.performed_on)}${d.source ? ` · ${d.source}` : ""}`}
            />
          ))}
        </Group>
      )}

      <div style={{ display: "flex", gap: 10, padding: "18px 16px 0" }}>
        {[
          { href: "/health/records/import", label: "Add record", icon: <Icons.PlusIcon /> },
          { href: "/health/records/vitals", label: "Log vitals", icon: <Icons.HeartIcon /> },
        ].map((q) => (
          <Link
            key={q.label}
            href={q.href}
            className="ios-list"
            style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, margin: 0, color: "var(--ios-tint)" }}
          >
            <span style={{ display: "flex", width: 22, height: 22 }}>{q.icon}</span>
            <span className="ios-caption" style={{ color: "var(--ios-label)" }}>{q.label}</span>
          </Link>
        ))}
      </div>

      <p className="ios-caption" style={{ color: "var(--ios-label-2)", padding: "18px 16px 0", lineHeight: 1.5 }}>
        Your records are private to your account and are never shared with family members.
        Reference ranges come from the report itself where printed. This is a record-keeping
        tool, not medical advice — talk to your physician about what these results mean.
      </p>

      <div style={{ height: 12 }} />
    </div>
  );
}
