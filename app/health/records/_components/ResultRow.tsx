import Link from "next/link";
import {
  evaluateResult,
  formatRange,
  rangePosition,
  STATUS_COLOR,
  STATUS_LABEL,
  BIOMARKER_BY_KEY,
  type ResultStatus,
} from "@/lib/health/biomarkers";

export interface LabResultRow {
  id: string;
  biomarker_key: string | null;
  name: string;
  panel: string | null;
  collected_on: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  flag: string | null;
  note: string | null;
}

/** Small colored pill naming the status. Only rendered when we know one. */
export function StatusBadge({ status }: { status: ResultStatus }) {
  if (status === "unknown") return null;
  const color = STATUS_COLOR[status];
  return (
    <span
      className="ios-caption"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
        borderRadius: 999,
        padding: "2px 8px",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * Where this value sits inside its reference range. The band is the normal
 * range; the dot is the reading. Out-of-range values clamp to the ends and
 * take the status color, so a glance says "outside, and which side".
 */
export function RangeBar({
  value,
  refLow,
  refHigh,
  status,
}: {
  value: number;
  refLow: number | null;
  refHigh: number | null;
  status: ResultStatus;
}) {
  const pos = rangePosition(value, refLow, refHigh);
  if (pos == null) return null;
  const color = STATUS_COLOR[status];
  // Normal band occupies the middle 70% when both bounds are known, so an
  // out-of-range dot still has somewhere to sit.
  const bothBounds = refLow != null && refHigh != null;
  const bandLeft = bothBounds ? 15 : 0;
  const bandWidth = bothBounds ? 70 : 85;
  const dotPct = bandLeft + pos * bandWidth;

  return (
    <div
      style={{ position: "relative", height: 6, borderRadius: 999, background: "var(--ios-fill, rgba(120,120,128,0.12))", marginTop: 8 }}
      aria-hidden
    >
      <div
        style={{
          position: "absolute",
          left: `${bandLeft}%`,
          width: `${bandWidth}%`,
          top: 0,
          bottom: 0,
          borderRadius: 999,
          background: "color-mix(in srgb, var(--ios-green) 22%, transparent)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `calc(${Math.max(0, Math.min(100, dotPct))}% - 4px)`,
          top: -2,
          width: 10,
          height: 10,
          borderRadius: 999,
          background: color,
          boxShadow: "0 0 0 2px var(--ios-cell)",
        }}
      />
    </div>
  );
}

/**
 * One analyte on a report. Rows for catalog biomarkers link through to that
 * marker's history — the point of storing labs over time is being able to
 * ask "and what was it last year?"
 */
export function ResultRow({ result, showRangeBar = true }: { result: LabResultRow; showRangeBar?: boolean }) {
  const marker = result.biomarker_key ? BIOMARKER_BY_KEY[result.biomarker_key] : undefined;
  const status = evaluateResult({
    value: result.value,
    refLow: result.ref_low,
    refHigh: result.ref_high,
    refText: result.ref_text,
    biomarkerKey: result.biomarker_key,
    labFlag: result.flag,
  });

  const refLow = result.ref_low ?? marker?.refLow ?? null;
  const refHigh = result.ref_high ?? marker?.refHigh ?? null;
  const range = formatRange(result.ref_low, result.ref_high, result.ref_text, result.unit);
  const displayValue =
    result.value != null ? `${result.value}` : (result.value_text ?? "—");

  const body = (
    <>
      <span className="ios-cell-body">
        <span className="ios-cell-title">{marker?.name ?? result.name}</span>
        <span className="ios-cell-sub">{range ? `Ref ${range}` : result.panel ?? ""}</span>
        {showRangeBar && result.value != null && (refLow != null || refHigh != null) && (
          <RangeBar value={result.value} refLow={refLow} refHigh={refHigh} status={status} />
        )}
      </span>
      <span className="ios-cell-trail" style={{ flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
        <span
          className="ios-num"
          style={{ fontWeight: 600, color: status === "normal" || status === "unknown" ? "var(--ios-label)" : STATUS_COLOR[status] }}
        >
          {displayValue}
          {result.unit && result.value != null && (
            <span className="ios-caption" style={{ color: "var(--ios-label-2)", fontWeight: 400 }}> {result.unit}</span>
          )}
        </span>
        <StatusBadge status={status} />
      </span>
    </>
  );

  if (result.biomarker_key) {
    return (
      <Link href={`/health/records/marker/${result.biomarker_key}`} className="ios-cell">
        {body}
      </Link>
    );
  }
  return <div className="ios-cell">{body}</div>;
}
