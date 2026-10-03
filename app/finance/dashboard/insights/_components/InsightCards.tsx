import type { Insight, InsightLevel } from "@/lib/finance/insights";

// What matters, as a list.
//
// Each row is one computed fact with its dollar figure, ranked: things to act
// on, then things to watch, then things going right, then context. The level
// is a colour and a word, not a score — a parent glancing at this between two
// other things needs to know which rows are the ones to tap.

const LEVEL: Record<InsightLevel, { label: string; color: string }> = {
  alert: { label: "Act", color: "var(--ios-red)" },
  watch: { label: "Watch", color: "var(--ios-orange)" },
  good: { label: "Good", color: "var(--ios-green)" },
  info: { label: "Note", color: "var(--ios-label-3)" },
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function InsightCards({ insights, max = 8 }: { insights: Insight[]; max?: number }) {
  const shown = insights.slice(0, max);
  const rest = insights.length - shown.length;
  if (shown.length === 0) {
    return (
      <div className="ios-list" style={{ margin: 0, padding: "18px 16px" }}>
        <h2 className="ios-title-3">What matters</h2>
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", textAlign: "center", padding: "20px 0" }}>
          Nothing stands out yet. This fills in as a second month of history arrives.
        </p>
      </div>
    );
  }
  return (
    <div className="ios-list" style={{ margin: 0, overflow: "hidden" }} id="matters">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "14px 16px 6px" }}>
        <h2 className="ios-title-3" style={{ margin: 0 }}>What matters</h2>
        <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
          {insights.filter((i) => i.level === "alert").length} to act on
        </span>
      </div>
      {shown.map((i, idx) => {
        const lv = LEVEL[i.level];
        const inner = (
          <>
            <span aria-hidden style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: lv.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="ios-caption" style={{ color: lv.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>{lv.label}</span>
                <span className="ios-callout" style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{i.title}</span>
              </span>
              <span className="ios-footnote" style={{ display: "block", color: "var(--ios-label-2)", marginTop: 2, lineHeight: 1.45 }}>{i.detail}</span>
            </span>
            {i.delta != null && i.delta !== 0 && (
              <span className="ios-num ios-footnote" style={{ color: i.delta > 0 ? "var(--ios-red)" : "var(--ios-green)", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                {i.delta > 0 ? "+" : "−"}{fmt(Math.abs(i.delta))}
              </span>
            )}
          </>
        );
        const style: React.CSSProperties = {
          display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 16px", textDecoration: "none", color: "inherit",
          boxShadow: idx === 0 ? undefined : "inset 0 0.5px 0 0 var(--ios-separator)",
        };
        return i.anchor
          ? <a key={i.id} href={`#${i.anchor}`} style={style}>{inner}</a>
          : <div key={i.id} style={style}>{inner}</div>;
      })}
      {rest > 0 && (
        <div className="ios-footnote" style={{ color: "var(--ios-label-3)", padding: "10px 16px 14px", boxShadow: "inset 0 0.5px 0 0 var(--ios-separator)" }}>
          {rest} more below the line — quieter notes about one-off charges and merchants seen for the first time.
        </div>
      )}
    </div>
  );
}
