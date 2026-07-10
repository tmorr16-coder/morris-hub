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

  if (rows.length === 0) {
    return (
      <div className="ios-list" style={{ margin: 0, padding: "18px 16px" }}>
        <h2 className="ios-title-3">Top merchants</h2>
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", textAlign: "center", padding: "20px 0" }}>
          No transactions in the last 30 days
        </p>
      </div>
    );
  }

  return (
    <div className="ios-list" style={{ margin: 0, padding: "18px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="ios-title-3">Top merchants</h2>
        <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>Last 30 days</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.map((r, idx) => {
          const widthPct = (r.total / maxTotal) * 100;
          return (
            <div key={r.merchant + idx} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <span className="ios-subhead" style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.merchant}
                </span>
                <span className="ios-subhead ios-num" style={{ color: "var(--ios-label)", fontWeight: 600, flexShrink: 0 }}>
                  {fmtMoney(r.total)}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "var(--ios-fill)", overflow: "hidden" }}>
                <div style={{ width: `${Math.max(widthPct, 3)}%`, height: "100%", borderRadius: 4, background: "var(--ios-finance)" }} />
              </div>
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span>{r.category}</span>
                <span>·</span>
                <span className="ios-num">{r.count}×</span>
                {r.accountSource && (
                  <>
                    <span>·</span>
                    <span style={{ color: "var(--ios-label-3)" }}>{r.accountSource}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
