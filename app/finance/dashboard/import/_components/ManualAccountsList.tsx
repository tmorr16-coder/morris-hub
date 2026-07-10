"use client";

import { useState, useTransition } from "react";
import { Chip, Icons } from "@/components/ios";
import { deleteManualAccount } from "../actions";
import ShareAccountModal from "./ShareAccountModal";

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
  const [sharingModal, setSharingModal] = useState<{ id: string; name: string } | null>(null);
  const [, startTransition] = useTransition();

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this imported account?")) return;
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    startTransition(async () => {
      await deleteManualAccount(id);
    });
  }

  const headerCellStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
    textTransform: "uppercase", color: "var(--ios-label-2)",
  };

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {accounts.map((a) => (
        <div key={a.id} style={{ background: "var(--ios-fill-2)", borderRadius: 12, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span className="ios-headline" style={{ color: "var(--ios-label)" }}>{a.name}</span>
                  <Chip small>{TYPE_LABEL[a.account_type] ?? a.account_type}</Chip>
                </div>
                <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>
                  {a.institution && <span>{a.institution} · </span>}
                  {a.as_of_date && <span>as of {new Date(a.as_of_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · </span>}
                  <span>imported {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
              </div>
              <button
                onClick={() => remove(a.id)}
                title="Remove"
                aria-label="Remove account"
                style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 999, border: "none", background: "var(--ios-fill)", color: "var(--ios-label-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden style={{ width: 14, height: 14 }}>
                  <path d="M6 6 18 18M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="ios-num ios-title-3" style={{ fontWeight: 600, color: "var(--ios-label)", marginTop: 10 }}>
              {fmtMoney(a.balance, a.currency)}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
              {(a.holdings?.length ?? 0) > 0 && (
                <Chip small selected={expanded.has(a.id)} onClick={() => toggle(a.id)}>
                  {expanded.has(a.id) ? "Hide holdings" : `${a.holdings!.length} holdings`}
                </Chip>
              )}
              <button
                onClick={() => setSharingModal({ id: a.id, name: a.name })}
                title="Share with family circle"
                className="ios-chip ios-chip--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}
              >
                <Icons.PeopleIcon style={{ width: 15, height: 15 }} />
                Share
              </button>
            </div>
          </div>

          {/* History / Holdings table */}
          {expanded.has(a.id) && a.holdings && a.holdings.length > 0 && (
            <div style={{ borderTop: "var(--ios-hair) solid var(--ios-separator)" }}>
              {/* Detect if this is balance history (source=manual, name looks like a date) or fund holdings */}
              {a.source === "manual" && /^\d{4}-\d{2}-\d{2}/.test(a.holdings[0]?.name ?? "") ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px", padding: "9px 14px", ...headerCellStyle }}>
                    <div>Month</div>
                    <div style={{ textAlign: "right" }}>Balance</div>
                    <div style={{ textAlign: "right" }}>Return</div>
                  </div>
                  {a.holdings.map((h, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px", padding: "10px 14px", borderTop: "var(--ios-hair) solid var(--ios-separator)", alignItems: "center" }}>
                      <div className="ios-num ios-footnote" style={{ color: "var(--ios-label-2)" }}>{h.name}</div>
                      <div className="ios-num ios-subhead" style={{ color: "var(--ios-label)", textAlign: "right" }}>{fmtMoney(h.value)}</div>
                      <div className="ios-num ios-footnote" style={{ textAlign: "right", color: h.pct == null ? "var(--ios-label-3)" : h.pct >= 0 ? "var(--ios-green)" : "var(--ios-red)" }}>
                        {h.pct != null ? `${h.pct > 0 ? "+" : ""}${h.pct.toFixed(2)}%` : "—"}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px", padding: "9px 14px", ...headerCellStyle }}>
                    <div>Fund</div>
                    <div style={{ textAlign: "right" }}>Value</div>
                    <div style={{ textAlign: "right" }}>Alloc %</div>
                  </div>
                  {a.holdings.map((h, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px", padding: "10px 14px", borderTop: "var(--ios-hair) solid var(--ios-separator)", alignItems: "center" }}>
                      <div className="ios-subhead" style={{ color: "var(--ios-label)" }}>{h.name}</div>
                      <div className="ios-num ios-subhead" style={{ color: "var(--ios-label)", textAlign: "right" }}>{fmtMoney(h.value)}</div>
                      <div className="ios-num ios-footnote" style={{ color: "var(--ios-label-2)", textAlign: "right" }}>
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
    {sharingModal && (
      <ShareAccountModal
        accountId={sharingModal.id}
        accountName={sharingModal.name}
        onClose={() => setSharingModal(null)}
      />
    )}
    </>
  );
}
