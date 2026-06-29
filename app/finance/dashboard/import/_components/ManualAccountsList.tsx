"use client";

import { useState, useTransition } from "react";
import { deleteManualAccount, toggleManualAccountSharing } from "../actions";

interface Holding { name: string; value: number; pct: number | null }

interface ManualAccount {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  balance: number | null;
  as_of_date: string | null;
  currency: string;
  holdings: Holding[] | null;
  source: string;
  created_at: string;
  visible_to_family: boolean;
}

function fmtMoney(n: number | null, currency = "USD"): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

const TYPE_LABEL: Record<string, string> = {
  "401k": "401(k)", roth_ira: "Roth IRA", traditional_ira: "Traditional IRA",
  hsa: "HSA", brokerage: "Brokerage", pension: "Pension", other_investment: "Investment",
};

export default function ManualAccountsList({ initialAccounts }: { initialAccounts: ManualAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sharingPending, setSharingPending] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleShare(id: string, current: boolean) {
    setSharingPending((prev) => new Set(prev).add(id));
    setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, visible_to_family: !current } : a));
    startTransition(async () => {
      await toggleManualAccountSharing(id, !current);
      setSharingPending((prev) => { const next = new Set(prev); next.delete(id); return next; });
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this imported account?")) return;
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    startTransition(async () => {
      await deleteManualAccount(id);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {accounts.map((a) => (
        <div key={a.id} style={{ background: "var(--color-paper-card)", border: "1px solid var(--color-rule)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
                <span className="serif" style={{ fontSize: 18, color: "var(--color-ink)" }}>{a.name}</span>
                <span style={{ fontSize: 10, color: "var(--color-bronze-dark)", background: "rgba(139,106,71,0.1)", padding: "2px 8px", borderRadius: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {TYPE_LABEL[a.account_type] ?? a.account_type}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--color-ink-3)" }}>
                {a.institution && <span>{a.institution} · </span>}
                {a.as_of_date && <span>as of {new Date(a.as_of_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · </span>}
                <span>imported {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--color-ink)" }}>
                {fmtMoney(a.balance, a.currency)}
              </span>
              {(a.holdings?.length ?? 0) > 0 && (
                <button
                  onClick={() => toggle(a.id)}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", cursor: "pointer", fontFamily: "inherit" }}
                >
                  {expanded.has(a.id) ? "Hide holdings" : `${a.holdings!.length} holdings`}
                </button>
              )}
              <button
                onClick={() => toggleShare(a.id, a.visible_to_family)}
                disabled={sharingPending.has(a.id)}
                title={a.visible_to_family ? "Shared with family — click to hide" : "Share with family"}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8,
                  border: `1px solid ${a.visible_to_family ? "var(--color-green)" : "var(--color-bronze)"}`,
                  background: a.visible_to_family ? "rgba(77,107,58,0.1)" : "rgba(139,106,71,0.08)",
                  color: a.visible_to_family ? "var(--color-green)" : "var(--color-bronze-dark)",
                  cursor: sharingPending.has(a.id) ? "wait" : "pointer",
                  fontFamily: "inherit", opacity: sharingPending.has(a.id) ? 0.6 : 1,
                  whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                {a.visible_to_family ? "👥 Shared" : "👥 Share"}
              </button>
              <button
                onClick={() => remove(a.id)}
                style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-4)", cursor: "pointer", fontFamily: "inherit" }}
                title="Remove"
              >✕</button>
            </div>
          </div>

          {/* History / Holdings table */}
          {expanded.has(a.id) && a.holdings && a.holdings.length > 0 && (
            <div style={{ borderTop: "1px solid var(--color-rule)" }}>
              {/* Detect if this is balance history (source=manual, name looks like a date) or fund holdings */}
              {a.source === "manual" && /^\d{4}-\d{2}-\d{2}/.test(a.holdings[0]?.name ?? "") ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px", padding: "8px 18px", background: "var(--color-paper-deep)", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>
                    <div>Month</div>
                    <div style={{ textAlign: "right" }}>Balance</div>
                    <div style={{ textAlign: "right" }}>Return</div>
                  </div>
                  {a.holdings.map((h, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px", padding: "9px 18px", borderTop: "1px solid var(--color-rule-soft)", alignItems: "center" }}>
                      <div className="mono" style={{ fontSize: 12, color: "var(--color-ink-3)" }}>{h.name}</div>
                      <div className="mono" style={{ fontSize: 13, color: "var(--color-ink-2)", textAlign: "right" }}>{fmtMoney(h.value)}</div>
                      <div style={{ fontSize: 12, textAlign: "right", color: h.pct == null ? "var(--color-ink-4)" : h.pct >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                        {h.pct != null ? `${h.pct > 0 ? "+" : ""}${h.pct.toFixed(2)}%` : "—"}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px", padding: "8px 18px", background: "var(--color-paper-deep)", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>
                    <div>Fund</div>
                    <div style={{ textAlign: "right" }}>Value</div>
                    <div style={{ textAlign: "right" }}>Alloc %</div>
                  </div>
                  {a.holdings.map((h, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px", padding: "10px 18px", borderTop: "1px solid var(--color-rule-soft)", alignItems: "center" }}>
                      <div style={{ fontSize: 13, color: "var(--color-ink)" }}>{h.name}</div>
                      <div className="mono" style={{ fontSize: 13, color: "var(--color-ink-2)", textAlign: "right" }}>{fmtMoney(h.value)}</div>
                      <div className="mono" style={{ fontSize: 12, color: "var(--color-ink-3)", textAlign: "right" }}>
                        {h.pct != null ? `${h.pct.toFixed(1)}%` : "—"}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
