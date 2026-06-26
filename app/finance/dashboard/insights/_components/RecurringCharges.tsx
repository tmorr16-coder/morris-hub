"use client";

export interface RecurringRow {
  merchant: string;
  cadence: "Weekly" | "Biweekly" | "Monthly" | "Quarterly";
  amount: number;
  monthlyCost: number;
  lastCharged: string;
  occurrences: number;
  category: string;
  key: string;
  accountSource: string | null;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function relativeDays(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr + "T12:00:00").getTime()) / 86400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export default function RecurringCharges({ rows }: { rows: RecurringRow[] }) {
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 20 }}>Recurring</h2>
        <span style={{ fontSize: 11, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {rows.length} detected
        </span>
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "20px 0", textAlign: "center" }}>
          No recurring charges detected yet
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((r, idx) => (
            <div
              key={r.key}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 8,
                padding: "11px 0",
                borderTop: idx === 0 ? undefined : "1px solid var(--color-rule-soft)",
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--color-ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.merchant}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2 }}>
                  {r.cadence} · {r.occurrences}× · last {relativeDays(r.lastCharged)}
                  {r.accountSource && <span style={{ color: "var(--color-ink-4)" }}> · {r.accountSource}</span>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 14, color: "var(--color-ink)" }}>
                  {fmtMoney(r.amount)}
                </div>
                {r.cadence !== "Monthly" && (
                  <div className="mono" style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
                    ≈{fmtMoney(r.monthlyCost)}/mo
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-paper-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: 12,
  padding: "20px 24px",
  boxShadow: "var(--shadow-card)",
};
