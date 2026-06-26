"use client";

export interface MerchantRow {
  merchant: string;
  total: number;
  count: number;
  category: string;
  accountSource: string | null;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

export default function TopMerchants({ rows }: { rows: MerchantRow[] }) {
  const maxTotal = Math.max(...rows.map((r) => r.total), 1);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 20 }}>Top merchants</h2>
        <span style={{ fontSize: 11, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          This month
        </span>
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "20px 0", textAlign: "center" }}>
          No spending this month yet
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((r, idx) => {
            const widthPct = (r.total / maxTotal) * 100;
            return (
              <div
                key={r.merchant + idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  padding: "10px 0",
                  borderTop: idx === 0 ? undefined : "1px solid var(--color-rule-soft)",
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0, position: "relative" }}>
                  {/* Background bar showing relative spend */}
                  <div
                    style={{
                      position: "absolute",
                      top: -3,
                      bottom: -3,
                      left: -8,
                      width: `calc(${widthPct}% + 8px)`,
                      background: "rgba(139, 106, 71, 0.08)",
                      borderRadius: 4,
                      zIndex: 0,
                    }}
                  />
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div style={{ fontSize: 13, color: "var(--color-ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.merchant}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span>{r.category}</span>
                      <span>·</span>
                      <span>{r.count}×</span>
                      {r.accountSource && (
                        <>
                          <span>·</span>
                          <span style={{ color: "var(--color-ink-4)" }}>{r.accountSource}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mono" style={{ textAlign: "right", fontSize: 14, color: "var(--color-ink)", position: "relative", zIndex: 1 }}>
                  {fmtMoney(r.total)}
                </div>
              </div>
            );
          })}
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
