"use client";

import { useState } from "react";
import type { Insight, InsightLevel } from "@/lib/finance/insights";

// What matters, as a list — and, one tap in, why.
//
// Each row is a computed fact. Tap it and it opens into the analysis: how the
// figure was worked out, and the transactions it rests on, largest first. Tap
// again and it closes. A claim about money should be checkable in place, by
// the person whose money it is, without leaving the screen.

export interface EvidenceTx {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string;
  account: string | null;
}

const LEVEL: Record<InsightLevel, { label: string; color: string }> = {
  alert: { label: "Act", color: "var(--ios-red)" },
  watch: { label: "Watch", color: "var(--ios-orange)" },
  good: { label: "Good", color: "var(--ios-green)" },
  info: { label: "Note", color: "var(--ios-label-3)" },
};

const ANCHOR_LABEL: Record<string, string> = {
  recurring: "Recurring charges", categories: "Categories", merchants: "Top merchants", trend: "Monthly trend", budgets: "Budgets",
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function fmt2(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}
function fmtDay(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function InsightCards({ insights, evidence, initial = 8 }: { insights: Insight[]; evidence: Record<string, EvidenceTx[]>; initial?: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [fullEvidence, setFullEvidence] = useState<Set<string>>(new Set());

  if (insights.length === 0) {
    return (
      <div className="ios-list" style={{ margin: 0, padding: "18px 16px" }} id="matters">
        <h2 className="ios-title-3">What matters</h2>
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", textAlign: "center", padding: "20px 0" }}>
          Nothing stands out yet. This fills in as a second month of history arrives.
        </p>
      </div>
    );
  }

  const shown = showAll ? insights : insights.slice(0, initial);
  const hidden = insights.length - shown.length;

  return (
    <div className="ios-list" style={{ margin: 0, overflow: "hidden" }} id="matters">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "14px 16px 6px" }}>
        <h2 className="ios-title-3" style={{ margin: 0 }}>What matters</h2>
        <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
          {insights.filter((i) => i.level === "alert").length} to act on · tap a row for the analysis
        </span>
      </div>

      {shown.map((i, idx) => {
        const lv = LEVEL[i.level];
        const open = openId === i.id;
        const rows = evidence[i.id] ?? [];
        const all = fullEvidence.has(i.id);
        const visible = all ? rows : rows.slice(0, 8);
        const total = rows.reduce((s, t) => s + t.amount, 0);
        return (
          <div key={i.id} style={{ boxShadow: idx === 0 ? undefined : "inset 0 0.5px 0 0 var(--ios-separator)" }}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : i.id)}
              aria-expanded={open}
              style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 16px", width: "100%", textAlign: "left", background: open ? "var(--ios-fill-2)" : "none", border: "none", color: "inherit", cursor: "pointer" }}
            >
              <span aria-hidden style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: lv.color, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className="ios-caption" style={{ color: lv.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>{lv.label}</span>
                  <span className="ios-callout" style={{ fontWeight: 600 }}>{i.title}</span>
                </span>
                <span className="ios-footnote" style={{ display: "block", color: "var(--ios-label-2)", marginTop: 2, lineHeight: 1.45 }}>{i.detail}</span>
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                {i.delta != null && i.delta !== 0 && (
                  <span className="ios-num ios-footnote" style={{ color: i.delta > 0 ? "var(--ios-red)" : "var(--ios-green)", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {i.delta > 0 ? "+" : "−"}{fmt(Math.abs(i.delta))}
                  </span>
                )}
                <span aria-hidden className="ios-caption" style={{ color: "var(--ios-label-3)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s ease", display: "inline-block" }}>▶</span>
              </span>
            </button>

            {open && (
              <div style={{ padding: "0 16px 14px 32px", background: "var(--ios-fill-2)" }}>
                <div className="ios-caption" style={{ color: "var(--ios-label-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, margin: "4px 0 4px" }}>How this was worked out</div>
                <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: 0, lineHeight: 1.5 }}>{i.method}</p>

                {rows.length > 0 && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "12px 0 4px" }}>
                      <span className="ios-caption" style={{ color: "var(--ios-label-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                        The transactions behind it
                      </span>
                      <span className="ios-caption ios-num" style={{ color: "var(--ios-label-3)" }}>{rows.length} · {fmt2(total)}</span>
                    </div>
                    <div className="ios-list" style={{ margin: 0 }}>
                      {visible.map((t, k) => (
                        <div key={t.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "baseline", padding: "8px 12px", boxShadow: k === 0 ? undefined : "inset 0 0.5px 0 0 var(--ios-separator)" }}>
                          <span className="ios-caption ios-num" style={{ color: "var(--ios-label-3)", whiteSpace: "nowrap" }}>{fmtDay(t.date)}</span>
                          <span style={{ minWidth: 0 }}>
                            <span className="ios-footnote" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.merchant}</span>
                            <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>{t.category}{t.account ? ` · ${t.account}` : ""}</span>
                          </span>
                          <span className="ios-footnote ios-num" style={{ fontWeight: 600, whiteSpace: "nowrap", color: t.amount < 0 ? "var(--ios-green)" : "inherit" }}>{fmt2(Math.abs(t.amount))}</span>
                        </div>
                      ))}
                    </div>
                    {rows.length > visible.length && (
                      <button type="button" className="ios-btn--plain" onClick={() => setFullEvidence((s) => new Set(s).add(i.id))} style={{ color: "var(--ios-tint)", fontSize: 13, fontWeight: 600, marginTop: 8 }}>
                        Show all {rows.length}
                      </button>
                    )}
                  </>
                )}

                {i.anchor && (
                  <a href={`#${i.anchor}`} className="ios-footnote" style={{ display: "inline-block", color: "var(--ios-tint)", fontWeight: 600, marginTop: 12, textDecoration: "none" }}>
                    Go to {ANCHOR_LABEL[i.anchor] ?? i.anchor} ↓
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}

      {hidden > 0 && (
        <button type="button" onClick={() => setShowAll(true)} className="ios-btn--plain" style={{ width: "100%", textAlign: "left", color: "var(--ios-tint)", fontWeight: 600, fontSize: 14, padding: "12px 16px", boxShadow: "inset 0 0.5px 0 0 var(--ios-separator)" }}>
          Show {hidden} more — one-off charges, merchants seen for the first time, charges that stopped
        </button>
      )}
      {showAll && insights.length > initial && (
        <button type="button" onClick={() => setShowAll(false)} className="ios-btn--plain" style={{ width: "100%", textAlign: "left", color: "var(--ios-label-3)", fontSize: 13, padding: "10px 16px", boxShadow: "inset 0 0.5px 0 0 var(--ios-separator)" }}>
          Show fewer
        </button>
      )}
    </div>
  );
}
