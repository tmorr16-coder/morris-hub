"use client";

import { useState, useEffect } from "react";
import type { RetirementAccount, RetirementDebt } from "../../retirement/types";
import type { ManualItem, PlaidInvestmentAccount } from "../page";
import { addPortfolioItem, removePortfolioItem, updatePortfolioItem } from "../actions";

// ── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  "401k":             "401(k)",
  "roth_ira":         "Roth IRA",
  "traditional_ira":  "Traditional IRA",
  "hsa":              "HSA",
  "brokerage":        "Brokerage",
  "pension":          "Pension",
  "other_investment": "Investment",
  "real_estate":      "Real Estate",
  "crypto":           "Crypto",
  "other":            "Other",
};

const RETIREMENT_TYPE_LABELS: Record<string, string> = {
  "401k":            "401(k)",
  "403b":            "403(b)",
  "roth_ira":        "Roth IRA",
  "traditional_ira": "Traditional IRA",
  "hsa":             "HSA",
  "pension":         "Pension",
  "brokerage":       "Brokerage",
  "other":           "Other",
};

const ADD_TYPES = [
  { value: "brokerage",        label: "Brokerage" },
  { value: "real_estate",      label: "Real Estate" },
  { value: "crypto",           label: "Crypto" },
  { value: "other_investment", label: "Other Investment" },
  { value: "other",            label: "Other Asset" },
];

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// ── Row components ───────────────────────────────────────────────────────────

function AccountRow({
  label, sublabel, balance, accent, onEdit, onRemove,
}: {
  label: string; sublabel?: string; balance: number;
  accent?: string; onEdit?: () => void; onRemove?: () => void;
}) {
  return (
    <div className="ios-cell">
      {accent && (
        <span className="ios-cell-lead">
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, display: "block" }} />
        </span>
      )}
      <div className="ios-cell-body">
        <span className="ios-cell-title" style={{ fontSize: 15, fontWeight: 500 }}>{label}</span>
        {sublabel && <span className="ios-cell-sub">{sublabel}</span>}
      </div>
      <span className="ios-cell-trail ios-num" style={{ color: "var(--ios-label)", fontWeight: 600, fontSize: 15 }}>
        {fmt(balance)}
      </span>
      {onEdit && (
        <button onClick={onEdit} style={{ color: "var(--ios-tint)", fontSize: 14, padding: "0 2px" }}>
          Edit
        </button>
      )}
      {onRemove && (
        <button onClick={onRemove} aria-label="Remove" style={{ color: "var(--ios-red)", display: "inline-flex", padding: "0 2px" }}>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}

function SectionCard({ label, subtotal, children, footer }: {
  label: string; subtotal: number; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 4px 7px" }}>
        <h2 className="ios-group-header" style={{ padding: 0 }}>{label}</h2>
        <span className="ios-num" style={{ fontSize: 15, fontWeight: 700, color: "var(--ios-label)" }}>
          {fmt(subtotal)}
        </span>
      </div>
      <div className="ios-list" style={{ margin: 0 }}>{children}</div>
      {footer && <div style={{ padding: "8px 4px 0" }}>{footer}</div>}
    </div>
  );
}

// ── Add form ─────────────────────────────────────────────────────────────────

function AddItemForm({ onAdd }: { onAdd: (item: ManualItem) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [accountType, setAccountType] = useState("brokerage");
  const [balance, setBalance] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const bal = parseFloat(balance.replace(/[,$]/g, ""));
    if (!name.trim() || isNaN(bal)) { setError("Name and balance required"); return; }
    setSaving(true);
    setError(null);
    const result = await addPortfolioItem({ name: name.trim(), institution: institution.trim() || null, accountType, balance: bal });
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    onAdd({ id: result.id!, name: name.trim(), institution: institution.trim() || null, account_type: accountType, balance: bal, as_of_date: new Date().toISOString().slice(0, 10) });
    setName(""); setInstitution(""); setBalance(""); setAccountType("brokerage"); setOpen(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ fontSize: 15, color: "var(--ios-tint)", cursor: "pointer", padding: "4px 0", textAlign: "left" }}>
        + Add custom account
      </button>
    );
  }

  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--ios-separator)", background: "var(--ios-cell)", color: "var(--ios-label)", fontSize: 15, outline: "none", boxSizing: "border-box" };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 10, padding: 14, background: "var(--ios-fill-2)", borderRadius: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input style={inp} placeholder="Account name" value={name} onChange={e => setName(e.target.value)} required />
        <input style={inp} placeholder="Institution (optional)" value={institution} onChange={e => setInstitution(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select style={inp} value={accountType} onChange={e => setAccountType(e.target.value)}>
          {ADD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input style={inp} placeholder="Balance ($)" value={balance} onChange={e => setBalance(e.target.value)} required />
      </div>
      {error && <div className="ios-footnote" style={{ color: "var(--ios-red)" }}>{error}</div>}
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <button type="submit" disabled={saving} style={{ padding: "9px 18px", borderRadius: 999, background: "var(--ios-tint)", color: "var(--ios-on-tint)", fontSize: 14, fontWeight: 600, cursor: saving ? "wait" : "pointer" }}>
          {saving ? "Saving…" : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ padding: "0 4px", color: "var(--ios-tint)", fontSize: 15, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  retirementAccounts: RetirementAccount[];
  retirementDebts: RetirementDebt[];
  hasProfile: boolean;
  manualItems: ManualItem[];
  plaidInvestmentAccounts: PlaidInvestmentAccount[];
  hasAlpaca: boolean;
}

export default function PortfolioClient({
  retirementAccounts,
  retirementDebts,
  hasProfile,
  manualItems: initialManualItems,
  plaidInvestmentAccounts,
  hasAlpaca,
}: Props) {
  const [manualItems, setManualItems] = useState(initialManualItems);
  const [alpacaValue, setAlpacaValue] = useState<number | null>(null);
  const [alpacaLoading, setAlpacaLoading] = useState(hasAlpaca);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState("");

  useEffect(() => {
    if (!hasAlpaca) return;
    fetch("/api/investments/alpaca/account")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        // Route returns { connected:false } when the user has no brokerage,
        // or { connected:true, account:{ portfolio_value } } when connected.
        const pv = d?.account?.portfolio_value;
        if (d?.connected && pv) setAlpacaValue(parseFloat(pv));
      })
      .catch(() => {})
      .finally(() => setAlpacaLoading(false));
  }, [hasAlpaca]);

  // ── Totals ──────────────────────────────────────────────────────────────────

  const retirementTotal = retirementAccounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  // Liabilities in custom additions subtract from the gross total
  const LIABILITY_TYPES = new Set(["credit_card", "mortgage", "loan", "other_liability"]);
  const manualTotal = manualItems.reduce((s, a) => {
    const bal = a.balance ?? 0;
    return s + (LIABILITY_TYPES.has(a.account_type) ? -Math.abs(bal) : bal);
  }, 0);
  const plaidInvestTotal = plaidInvestmentAccounts.reduce((s, a) => s + a.balance, 0);
  const alpacaTotal = alpacaValue ?? 0;
  const debtTotal = retirementDebts.reduce((s, d) => s + (d.balance ?? 0), 0);

  const grossTotal = retirementTotal + manualTotal + plaidInvestTotal + alpacaTotal;
  const netTotal = grossTotal - debtTotal;

  async function handleRemove(id: string) {
    if (!confirm("Remove this account from your portfolio?")) return;
    await removePortfolioItem(id);
    setManualItems(prev => prev.filter(i => i.id !== id));
  }

  async function handleEditSave(id: string) {
    const bal = parseFloat(editBalance.replace(/[,$]/g, ""));
    if (isNaN(bal)) return;
    await updatePortfolioItem(id, bal);
    setManualItems(prev => prev.map(i => i.id === id ? { ...i, balance: bal } : i));
    setEditingId(null);
  }

  return (
    <div>

      {/* ── Total hero ─────────────────────────────────────────────────── */}
      <div className="ios-list" style={{ margin: "8px 0 8px", padding: 18, textAlign: "center" }}>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Total portfolio
        </div>
        <div className="ios-num" style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 4, lineHeight: 1.1 }}>
          {fmt(netTotal)}
        </div>
        {debtTotal > 0 && (
          <div className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)", marginTop: 6 }}>
            {fmt(grossTotal)} gross · {fmt(debtTotal)} liabilities
          </div>
        )}
      </div>

      {/* ── Retirement Foundation ───────────────────────────────────────── */}
      <SectionCard
        label="Retirement Foundation"
        subtotal={retirementTotal}
        footer={
          <a href="/finance/retirement" className="ios-footnote" style={{ color: "var(--ios-tint)" }}>
            {hasProfile ? "Manage retirement accounts →" : "Set up retirement plan →"}
          </a>
        }
      >
        {retirementAccounts.length === 0 ? (
          <p className="ios-footnote ios-cell" style={{ color: "var(--ios-label-2)" }}>
            No retirement accounts yet. Add them in the Retirement planner.
          </p>
        ) : (
          retirementAccounts.map(a => (
            <AccountRow
              key={a.id}
              label={a.name}
              sublabel={`${RETIREMENT_TYPE_LABELS[a.type] ?? a.type}${a.plaid_account_id ? " · Plaid-linked" : ""}${a.monthly_contribution > 0 ? ` · $${a.monthly_contribution.toLocaleString()}/mo contribution` : ""}`}
              balance={a.balance}
              accent="var(--ios-tint)"
            />
          ))
        )}
      </SectionCard>

      {/* ── Alpaca + Plaid investments ──────────────────────────────────── */}
      {(hasAlpaca || plaidInvestmentAccounts.length > 0) && (
        <SectionCard label="Investment Accounts" subtotal={plaidInvestTotal + alpacaTotal}>
          {plaidInvestmentAccounts.map(a => (
            <AccountRow
              key={a.id}
              label={a.name}
              sublabel={`${a.subtype ?? "Investment"}${a.mask ? ` ···${a.mask}` : ""}${a.name.includes("(shared)") ? " · Shared" : " · Plaid"}`}
              balance={a.balance}
              accent="var(--ios-finance)"
            />
          ))}
          {hasAlpaca && (
            <AccountRow
              label="Alpaca Paper Portfolio"
              sublabel={alpacaLoading ? "Loading…" : `${alpacaValue !== null ? "Live balance" : "Unavailable"} · Paper trading · Gamification`}
              balance={alpacaValue ?? 0}
              accent="var(--ios-orange)"
            />
          )}
          {plaidInvestmentAccounts.length === 0 && !hasAlpaca && (
            <div className="ios-cell" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
              <p className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
                Connect a brokerage account for live investment data.
              </p>
              <a href="/finance/dashboard/import" className="ios-footnote" style={{ color: "var(--ios-tint)" }}>
                Connect via Plaid (E*TRADE, Fidelity, Schwab, etc.) →
              </a>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Custom additions ────────────────────────────────────────────── */}
      <SectionCard
        label="Custom Additions"
        subtotal={manualTotal}
        footer={
          <AddItemForm
            onAdd={item => setManualItems(prev => [...prev, item])}
          />
        }
      >
        {manualItems.length === 0 ? (
          <p className="ios-footnote ios-cell" style={{ color: "var(--ios-label-2)" }}>
            Add brokerage accounts, real estate, crypto, or any other asset.
          </p>
        ) : (
          manualItems.map((item) => (
            editingId === item.id ? (
              <div key={item.id} className="ios-cell" style={{ gap: 8 }}>
                <span className="ios-cell-body ios-cell-title" style={{ fontSize: 15 }}>{item.name}</span>
                <input
                  value={editBalance}
                  onChange={e => setEditBalance(e.target.value)}
                  style={{ width: 120, padding: "7px 10px", borderRadius: 7, border: "1px solid var(--ios-tint)", fontSize: 15, outline: "none", background: "var(--ios-bg)", color: "var(--ios-label)" }}
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") handleEditSave(item.id); if (e.key === "Escape") setEditingId(null); }}
                />
                <button onClick={() => handleEditSave(item.id)} style={{ padding: "7px 14px", borderRadius: 999, background: "var(--ios-tint)", color: "var(--ios-on-tint)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Save</button>
                <button onClick={() => setEditingId(null)} style={{ padding: "0 4px", color: "var(--ios-tint)", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              </div>
            ) : (
              <AccountRow
                key={item.id}
                label={item.name}
                sublabel={[
                  ACCOUNT_TYPE_LABELS[item.account_type] ?? item.account_type,
                  item.institution,
                  item.is_shared ? "Shared" : item.source === "import" ? "Imported" : null,
                ].filter(Boolean).join(" · ")}
                balance={item.balance}
                accent={item.is_shared ? "var(--ios-finance)" : "var(--ios-green)"}
                onEdit={item.is_shared ? undefined : () => { setEditingId(item.id); setEditBalance(String(item.balance)); }}
                onRemove={item.is_shared ? undefined : () => handleRemove(item.id)}
              />
            )
          ))
        )}
      </SectionCard>

      {/* ── Liabilities ─────────────────────────────────────────────────── */}
      {retirementDebts.length > 0 && (
        <SectionCard label="Liabilities" subtotal={-debtTotal}>
          {retirementDebts.map(d => (
            <AccountRow
              key={d.id}
              label={d.name}
              sublabel={`${d.type}${d.rate_pct ? ` · ${d.rate_pct}% APR` : ""}${d.monthly_payment ? ` · $${d.monthly_payment.toLocaleString()}/mo` : ""}`}
              balance={-(d.balance ?? 0)}
              accent="var(--ios-red)"
            />
          ))}
          <p className="ios-footnote ios-cell" style={{ color: "var(--ios-label-2)" }}>
            Liabilities from your retirement plan. <a href="/finance/retirement" style={{ color: "var(--ios-tint)" }}>Manage →</a>
          </p>
        </SectionCard>
      )}

    </div>
  );
}
