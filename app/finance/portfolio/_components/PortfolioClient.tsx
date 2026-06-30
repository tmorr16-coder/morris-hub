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
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--color-rule-soft)" }}>
      {accent && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 11, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            {sublabel}
          </div>
        )}
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", fontFamily: "var(--font-geist, system-ui), sans-serif", flexShrink: 0 }}>
        {fmt(balance)}
      </span>
      {onEdit && (
        <button onClick={onEdit} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--color-ink-4)", padding: "2px 6px", fontFamily: "inherit" }}>
          Edit
        </button>
      )}
      {onRemove && (
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--color-red)", padding: "2px 6px", fontFamily: "inherit" }}>
          ✕
        </button>
      )}
    </div>
  );
}

function SectionCard({ label, subtotal, children, footer }: {
  label: string; subtotal: number; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "20px 24px", boxShadow: "var(--shadow-card)", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", margin: 0, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          {label}
        </h2>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-ink)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          {fmt(subtotal)}
        </span>
      </div>
      {children}
      {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
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
      <button onClick={() => setOpen(true)} style={{ fontSize: 12, color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-geist, system-ui), sans-serif", padding: "6px 0", textAlign: "left" }}>
        + Add custom account
      </button>
    );
  }

  const inp: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg)", color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, padding: "14px", background: "var(--color-bg)", borderRadius: 10, border: "1px solid var(--color-rule)" }}>
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
      {error && <div style={{ fontSize: 11, color: "var(--color-red)" }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={saving} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 12, fontWeight: 600, cursor: saving ? "wait" : "pointer", fontFamily: "inherit" }}>
          {saving ? "Saving…" : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "none", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "var(--color-ink-3)" }}>
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
      .then(d => { if (d?.portfolio_value) setAlpacaValue(parseFloat(d.portfolio_value)); })
      .catch(() => {})
      .finally(() => setAlpacaLoading(false));
  }, [hasAlpaca]);

  // ── Totals ──────────────────────────────────────────────────────────────────

  const retirementTotal = retirementAccounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const manualTotal = manualItems.reduce((s, a) => s + (a.balance ?? 0), 0);
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
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px 100px" }}>

      {/* ── Total hero ─────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 8, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          Total portfolio
        </div>
        <div className="serif" style={{ fontSize: 48, fontWeight: 400, color: "var(--color-ink)", lineHeight: 1 }}>
          {fmt(netTotal)}
        </div>
        {debtTotal > 0 && (
          <div style={{ fontSize: 12, color: "var(--color-ink-4)", marginTop: 6, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            {fmt(grossTotal)} gross · {fmt(debtTotal)} liabilities
          </div>
        )}
      </div>

      {/* ── Retirement Foundation ───────────────────────────────────────── */}
      <SectionCard
        label="Retirement Foundation"
        subtotal={retirementTotal}
        footer={
          <a href="/finance/retirement" style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            {hasProfile ? "Manage retirement accounts →" : "Set up retirement plan →"}
          </a>
        }
      >
        {retirementAccounts.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-ink-4)", margin: "0 0 8px", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            No retirement accounts yet. Add them in the Retirement planner.
          </p>
        ) : (
          retirementAccounts.map(a => (
            <AccountRow
              key={a.id}
              label={a.name}
              sublabel={`${RETIREMENT_TYPE_LABELS[a.type] ?? a.type}${a.plaid_account_id ? " · Plaid-linked" : ""}${a.monthly_contribution > 0 ? ` · $${a.monthly_contribution.toLocaleString()}/mo contribution` : ""}`}
              balance={a.balance}
              accent="var(--color-accent)"
            />
          ))
        )}
      </SectionCard>

      {/* ── Alpaca + Plaid investments ──────────────────────────────────── */}
      {(hasAlpaca || plaidInvestmentAccounts.length > 0) && (
        <SectionCard label="Investment Accounts" subtotal={plaidInvestTotal + alpacaTotal}>
          {hasAlpaca && (
            <AccountRow
              label="Alpaca Portfolio"
              sublabel={alpacaLoading ? "Loading live balance…" : "Paper / live trading · Alpaca"}
              balance={alpacaValue ?? 0}
              accent="#C97A3A"
            />
          )}
          {plaidInvestmentAccounts.map(a => (
            <AccountRow
              key={a.id}
              label={a.name}
              sublabel={`${a.subtype ?? "Investment"}${a.mask ? ` ···${a.mask}` : ""} · Plaid`}
              balance={a.balance}
              accent="#8B6A47"
            />
          ))}
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
          <p style={{ fontSize: 13, color: "var(--color-ink-4)", margin: "0 0 4px", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            Add brokerage accounts, real estate, crypto, or any other asset.
          </p>
        ) : (
          manualItems.map(item => (
            editingId === item.id ? (
              <div key={item.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-rule-soft)" }}>
                <span style={{ flex: 1, fontSize: 13, color: "var(--color-ink)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{item.name}</span>
                <input
                  value={editBalance}
                  onChange={e => setEditBalance(e.target.value)}
                  style={{ width: 120, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--color-accent)", fontSize: 13, fontFamily: "inherit", outline: "none", background: "var(--color-bg)", color: "var(--color-ink)" }}
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") handleEditSave(item.id); if (e.key === "Escape") setEditingId(null); }}
                />
                <button onClick={() => handleEditSave(item.id)} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "var(--color-accent)", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                <button onClick={() => setEditingId(null)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid var(--color-rule)", background: "none", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "var(--color-ink-3)" }}>Cancel</button>
              </div>
            ) : (
              <AccountRow
                key={item.id}
                label={item.name}
                sublabel={`${ACCOUNT_TYPE_LABELS[item.account_type] ?? item.account_type}${item.institution ? ` · ${item.institution}` : ""}`}
                balance={item.balance}
                accent="var(--color-green)"
                onEdit={() => { setEditingId(item.id); setEditBalance(String(item.balance)); }}
                onRemove={() => handleRemove(item.id)}
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
              accent="var(--color-red)"
            />
          ))}
          <p style={{ fontSize: 11, color: "var(--color-ink-4)", margin: "10px 0 0", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            Liabilities from your retirement plan. <a href="/finance/retirement" style={{ color: "var(--color-accent)", textDecoration: "none" }}>Manage →</a>
          </p>
        </SectionCard>
      )}

    </div>
  );
}
