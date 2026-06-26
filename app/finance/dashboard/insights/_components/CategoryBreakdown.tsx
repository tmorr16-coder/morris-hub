"use client";

import { useState } from "react";

export interface TxSummary {
  id: string;
  date: string;
  merchant: string;
  amount: number;
}

export interface CategoryDetailRow {
  subcategory: string;
  current: number;
  previous: number;
  txns?: TxSummary[];
}

export interface CategoryRow {
  category: string;
  current: number;
  previous: number;
  details?: CategoryDetailRow[];
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtMoneyExact(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CategoryBreakdown({ rows }: { rows: CategoryRow[] }) {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  function toggleCat(cat: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) { next.delete(cat); } else { next.add(cat); }
      return next;
    });
  }

  function toggleSub(key: string) {
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <div style={card}>
        <h2 className="serif" style={{ fontSize: 20, marginBottom: 10 }}>Category breakdown</h2>
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", textAlign: "center", padding: "20px 0" }}>
          No spending this month yet
        </p>
      </div>
    );
  }

  const maxVal = Math.max(...rows.map((r) => Math.max(r.current, r.previous)), 1);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
        <h2 className="serif" style={{ fontSize: 20 }}>Category breakdown</h2>
        <div style={{ display: "flex", gap: 14, fontSize: 11 }}>
          <span style={{ color: "var(--color-ink-3)", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, background: "var(--color-bronze)", borderRadius: 2 }} />
            This month
          </span>
          <span style={{ color: "var(--color-ink-3)", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, background: "var(--color-paper-deep)", borderRadius: 2 }} />
            Last month
          </span>
          <span style={{ color: "var(--color-ink-4)", fontStyle: "italic" }}>click to expand</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r) => {
          const delta = r.previous > 0 ? ((r.current - r.previous) / r.previous) * 100 : null;
          const currentPct = (r.current / maxVal) * 100;
          const previousPct = (r.previous / maxVal) * 100;
          const catExpanded = expandedCats.has(r.category);
          const hasDetails = (r.details?.length ?? 0) > 0;

          return (
            <div key={r.category} style={{ borderRadius: 8, overflow: "hidden", border: catExpanded ? "1px solid var(--color-rule)" : "none" }}>
              {/* Category row */}
              <button
                onClick={() => hasDetails && toggleCat(r.category)}
                disabled={!hasDetails}
                style={{ width: "100%", textAlign: "left", background: catExpanded ? "var(--color-paper-deep)" : "transparent", border: "none", padding: catExpanded ? "10px 12px 8px" : "0", cursor: hasDetails ? "pointer" : "default", fontFamily: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, color: "var(--color-ink)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                    {hasDetails && (
                      <span style={{ fontSize: 9, color: "var(--color-ink-4)", transform: catExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms", display: "inline-block" }}>▶</span>
                    )}
                    {r.category}
                  </span>
                  <span style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <span className="mono" style={{ fontSize: 13, color: "var(--color-ink)" }}>{fmtMoney(r.current)}</span>
                    {delta != null && Math.abs(delta) >= 1 && (
                      <span style={{ fontSize: 10, color: delta > 0 ? "var(--color-red)" : "var(--color-green)" }}>
                        {delta > 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(0)}%
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ height: 18, background: "var(--color-paper)", borderRadius: 3, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${previousPct}%`, background: "var(--color-paper-deep)", borderRadius: 3 }} />
                  <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${currentPct}%`, background: "var(--color-bronze)", borderRadius: 3, transition: "width 0.4s" }} />
                </div>
              </button>

              {/* Subcategory drill-down */}
              {catExpanded && hasDetails && (
                <div style={{ padding: "4px 12px 10px 24px" }}>
                  {r.details!.map((d) => {
                    const subKey = `${r.category}::${d.subcategory}`;
                    const subExpanded = expandedSubs.has(subKey);
                    const dDelta = d.previous > 0 ? ((d.current - d.previous) / d.previous) * 100 : null;
                    const dCurrentPct = (d.current / maxVal) * 100;
                    const dPreviousPct = (d.previous / maxVal) * 100;
                    const hasTxns = (d.txns?.length ?? 0) > 0;

                    return (
                      <div key={d.subcategory} style={{ borderTop: "1px solid var(--color-rule-soft)", paddingTop: 6, marginTop: 6 }}>
                        <button
                          onClick={() => hasTxns && toggleSub(subKey)}
                          disabled={!hasTxns}
                          style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: hasTxns ? "pointer" : "default", fontFamily: "inherit" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: "var(--color-ink-2)", display: "flex", alignItems: "center", gap: 5 }}>
                              {hasTxns && (
                                <span style={{ fontSize: 8, color: "var(--color-ink-4)", transform: subExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms", display: "inline-block" }}>▶</span>
                              )}
                              {d.subcategory}
                              {hasTxns && <span style={{ fontSize: 9, color: "var(--color-ink-4)" }}>· {d.txns!.length}×</span>}
                            </span>
                            <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                              <span className="mono" style={{ fontSize: 12, color: "var(--color-ink-2)" }}>{fmtMoney(d.current)}</span>
                              {dDelta != null && Math.abs(dDelta) >= 5 && (
                                <span style={{ fontSize: 9, color: dDelta > 0 ? "var(--color-red)" : "var(--color-green)" }}>
                                  {dDelta > 0 ? "↑" : "↓"} {Math.abs(dDelta).toFixed(0)}%
                                </span>
                              )}
                            </span>
                          </div>
                          <div style={{ height: 10, background: "var(--color-paper)", borderRadius: 2, position: "relative", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${dPreviousPct}%`, background: "var(--color-paper-deep)", borderRadius: 2 }} />
                            <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${dCurrentPct}%`, background: "var(--color-bronze)", opacity: 0.7, borderRadius: 2 }} />
                          </div>
                        </button>

                        {/* Individual transactions */}
                        {subExpanded && hasTxns && (
                          <div style={{ marginTop: 6, paddingLeft: 12, borderLeft: "2px solid var(--color-bronze)", opacity: 0.9 }}>
                            {d.txns!.map((tx) => (
                              <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--color-rule-soft)" }}>
                                <div>
                                  <div style={{ fontSize: 12, color: "var(--color-ink)", fontWeight: 500 }}>{tx.merchant}</div>
                                  <div className="mono" style={{ fontSize: 10, color: "var(--color-ink-4)" }}>{fmtDate(tx.date)}</div>
                                </div>
                                <span className="mono" style={{ fontSize: 12, color: "var(--color-ink-2)", fontWeight: 500 }}>{fmtMoneyExact(tx.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
