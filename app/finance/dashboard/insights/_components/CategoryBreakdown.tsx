"use client";

import { useState } from "react";
import { Icons } from "@/components/ios";

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

function Caret({ open, size = 11 }: { open: boolean; size?: number }) {
  return (
    <Icons.ChevronRight
      style={{
        width: size,
        height: size,
        color: "var(--ios-label-3)",
        flexShrink: 0,
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 150ms",
      }}
    />
  );
}

function Delta({ delta, threshold, size }: { delta: number | null; threshold: number; size: number }) {
  if (delta == null || Math.abs(delta) < threshold) return null;
  return (
    <span className="ios-num" style={{ fontSize: size, color: delta > 0 ? "var(--ios-red)" : "var(--ios-green)" }}>
      {delta > 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(0)}%
    </span>
  );
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
      <div className="ios-list" style={{ margin: 0, padding: "18px 16px" }}>
        <h2 className="ios-title-3">Category breakdown</h2>
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", textAlign: "center", padding: "20px 0" }}>
          No spending this month yet
        </p>
      </div>
    );
  }

  const maxVal = Math.max(...rows.map((r) => Math.max(r.current, r.previous)), 1);

  return (
    <div className="ios-list" style={{ margin: 0, padding: "18px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <h2 className="ios-title-3">Category breakdown</h2>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, background: "var(--ios-finance)", borderRadius: 3 }} />
            Last 30
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, background: "var(--ios-fill)", borderRadius: 3 }} />
            Prior 30
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((r) => {
          const delta = r.previous > 0 ? ((r.current - r.previous) / r.previous) * 100 : null;
          const currentPct = (r.current / maxVal) * 100;
          const previousPct = (r.previous / maxVal) * 100;
          const catExpanded = expandedCats.has(r.category);
          const hasDetails = (r.details?.length ?? 0) > 0;

          return (
            <div key={r.category} style={{ borderRadius: 10, overflow: "hidden", background: catExpanded ? "var(--ios-fill-2)" : "transparent" }}>
              {/* Category row */}
              <button
                onClick={() => hasDetails && toggleCat(r.category)}
                disabled={!hasDetails}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: catExpanded ? "10px 12px 8px" : "8px 0", cursor: hasDetails ? "pointer" : "default", fontFamily: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span className="ios-subhead" style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                    {hasDetails && <Caret open={catExpanded} size={11} />}
                    {r.category}
                  </span>
                  <span style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <span className="ios-num ios-subhead" style={{ color: "var(--ios-label)", fontWeight: 600 }}>{fmtMoney(r.current)}</span>
                    <Delta delta={delta} threshold={1} size={11} />
                  </span>
                </div>
                <div style={{ height: 8, background: "var(--ios-fill)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${previousPct}%`, background: "var(--ios-fill-2)", borderRadius: 4 }} />
                  <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${currentPct}%`, background: "var(--ios-finance)", borderRadius: 4, transition: "width 0.4s" }} />
                </div>
              </button>

              {/* Subcategory drill-down */}
              {catExpanded && hasDetails && (
                <div style={{ padding: "2px 12px 10px 24px" }}>
                  {r.details!.map((d) => {
                    const subKey = `${r.category}::${d.subcategory}`;
                    const subExpanded = expandedSubs.has(subKey);
                    const dDelta = d.previous > 0 ? ((d.current - d.previous) / d.previous) * 100 : null;
                    const dCurrentPct = (d.current / maxVal) * 100;
                    const dPreviousPct = (d.previous / maxVal) * 100;
                    const hasTxns = (d.txns?.length ?? 0) > 0;

                    return (
                      <div key={d.subcategory} style={{ borderTop: "1px solid var(--ios-separator)", paddingTop: 8, marginTop: 8 }}>
                        <button
                          onClick={() => hasTxns && toggleSub(subKey)}
                          disabled={!hasTxns}
                          style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: hasTxns ? "pointer" : "default", fontFamily: "inherit" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                            <span className="ios-footnote" style={{ color: "var(--ios-label-2)", display: "flex", alignItems: "center", gap: 5 }}>
                              {hasTxns && <Caret open={subExpanded} size={9} />}
                              {d.subcategory}
                              {hasTxns && <span className="ios-num" style={{ color: "var(--ios-label-3)" }}>· {d.txns!.length}×</span>}
                            </span>
                            <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                              <span className="ios-num ios-footnote" style={{ color: "var(--ios-label-2)" }}>{fmtMoney(d.current)}</span>
                              <Delta delta={dDelta} threshold={5} size={9} />
                            </span>
                          </div>
                          <div style={{ height: 6, background: "var(--ios-fill)", borderRadius: 3, position: "relative", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${dPreviousPct}%`, background: "var(--ios-fill-2)", borderRadius: 3 }} />
                            <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${dCurrentPct}%`, background: "var(--ios-finance)", opacity: 0.7, borderRadius: 3 }} />
                          </div>
                        </button>

                        {/* Individual transactions */}
                        {subExpanded && hasTxns && (
                          <div style={{ marginTop: 6, paddingLeft: 12, borderLeft: "2px solid var(--ios-finance)" }}>
                            {d.txns!.map((tx) => (
                              <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--ios-separator)" }}>
                                <div>
                                  <div className="ios-footnote" style={{ color: "var(--ios-label)", fontWeight: 500 }}>{tx.merchant}</div>
                                  <div className="ios-num ios-caption" style={{ color: "var(--ios-label-3)" }}>{fmtDate(tx.date)}</div>
                                </div>
                                <span className="ios-num ios-footnote" style={{ color: "var(--ios-label-2)", fontWeight: 600 }}>{fmtMoneyExact(tx.amount)}</span>
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
