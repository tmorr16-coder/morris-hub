"use client";

export interface RecurringRow {
  merchant: string;
  cadence: "Weekly" | "Biweekly" | "Monthly" | "Quarterly" | "Annual";
  amount: number;
  monthlyCost: number;
  lastCharged: string;
  occurrences: number;
  category: string;
  key: string;
  accountSource: string | null;
  // Optional, from the insight engine: what changed.
  variable?: boolean;
  isNew?: boolean;
  priceChange?: number | null;
  status?: "active" | "overdue" | "lapsed";
  nextExpected?: string;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function relativeDays(dateStr: string): string {
  const days = Math.floor((new Date().getTime() - new Date(dateStr + "T12:00:00").getTime()) / 86400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function fmtDay(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="ios-caption" style={{ color, border: "1px solid currentColor", borderRadius: 999, padding: "1px 7px", fontWeight: 700, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export default function RecurringCharges({ rows }: { rows: RecurringRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="ios-list" style={{ margin: 0, padding: "18px 16px" }} id="recurring">
        <h2 className="ios-title-3">Recurring</h2>
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", textAlign: "center", padding: "20px 0" }}>
          No recurring charges detected yet
        </p>
      </div>
    );
  }

  const live = rows.filter((r) => r.status !== "lapsed");
  const lapsed = rows.filter((r) => r.status === "lapsed");
  const monthly = live.reduce((s, r) => s + r.monthlyCost, 0);

  const row = (r: RecurringRow, idx: number, dim = false) => (
    <div
      key={r.key}
      style={{
        display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: "12px 0", alignItems: "center",
        borderTop: idx === 0 ? undefined : "1px solid var(--ios-separator)", opacity: dim ? 0.6 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span className="ios-callout" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.merchant}</span>
          {r.isNew && <Tag color="var(--ios-tint)">New</Tag>}
          {r.priceChange != null && r.priceChange > 0 && <Tag color="var(--ios-red)">↑ {fmtMoney(r.priceChange)}</Tag>}
          {r.priceChange != null && r.priceChange < 0 && <Tag color="var(--ios-green)">↓ {fmtMoney(-r.priceChange)}</Tag>}
          {r.variable && <Tag color="var(--ios-label-3)">Varies</Tag>}
          {r.status === "overdue" && <Tag color="var(--ios-orange)">Late</Tag>}
          {r.status === "lapsed" && <Tag color="var(--ios-label-3)">Stopped</Tag>}
        </div>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
          {r.cadence} · <span className="ios-num">{r.occurrences}×</span> · last {relativeDays(r.lastCharged)}
          {r.status === "active" && r.nextExpected && <span> · next ~{fmtDay(r.nextExpected)}</span>}
          {r.accountSource && <span style={{ color: "var(--ios-label-3)" }}> · {r.accountSource}</span>}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="ios-num ios-callout" style={{ color: "var(--ios-finance)", fontWeight: 600 }}>
          {r.variable ? "~" : ""}{fmtMoney(r.amount)}
        </div>
        {r.cadence !== "Monthly" && (
          <div className="ios-num ios-caption" style={{ color: "var(--ios-label-3)" }}>≈{fmtMoney(r.monthlyCost)}/mo</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="ios-list" style={{ margin: 0, padding: "18px 16px" }} id="recurring">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, gap: 10 }}>
        <h2 className="ios-title-3">Recurring</h2>
        <span className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)" }}>
          {live.length} · {fmtMoney(monthly)}/mo
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {live.map((r, i) => row(r, i))}
      </div>
      {lapsed.length > 0 && (
        <>
          <div className="ios-caption" style={{ color: "var(--ios-label-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, margin: "16px 0 2px" }}>
            Stopped charging
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {lapsed.map((r, i) => row(r, i, true))}
          </div>
        </>
      )}
    </div>
  );
}
