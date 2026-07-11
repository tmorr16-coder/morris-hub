"use client";

import { useState } from "react";
import { Chip } from "@/components/ios";
import type {
  RetirementAccount,
  RetirementProfile,
  PlaidAccountSuggestion,
  SavedAccountSuggestion,
  SharedAccountSuggestion,
} from "../types";

interface Props {
  accounts: RetirementAccount[];
  setAccounts: (a: RetirementAccount[]) => void;
  onAccountsChange: (updatedAccounts: RetirementAccount[]) => void;
  plaidAccounts: PlaidAccountSuggestion[];
  savedAccounts: SavedAccountSuggestion[];
  sharedAccounts: SharedAccountSuggestion[];
  profile: RetirementProfile;
}

// ── Type config ───────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = ["401k", "403b", "Roth IRA", "Traditional IRA", "HSA", "Brokerage", "Pension", "Other"];

const TYPE_LABELS: Record<string, string> = {
  "401k": "401(k)", "403b": "403(b)",
  "Roth IRA": "Roth IRA", "Traditional IRA": "Trad IRA",
  HSA: "HSA", Brokerage: "Brokerage", Pension: "Pension", Other: "Other",
  roth_ira: "Roth IRA", traditional_ira: "Trad IRA",
  brokerage: "Brokerage", pension: "Pension",
  other_investment: "Investment", other: "Other",
};

// Map manual_account account_type values to ACCOUNT_TYPES keys
const MANUAL_TO_RETIREMENT_TYPE: Record<string, string> = {
  "401k": "401k", "roth_ira": "Roth IRA", "traditional_ira": "Traditional IRA",
  "hsa": "HSA", "brokerage": "Brokerage", "pension": "Pension",
};

type Source = "custom" | "plaid" | "saved" | "shared";

const SOURCES: { key: Source; label: string; description: string }[] = [
  { key: "custom",  label: "Custom",         description: "Enter account details manually" },
  { key: "plaid",   label: "Linked account", description: "Use a bank/brokerage linked via SimpleFIN" },
  { key: "saved",   label: "Saved account",  description: "Import from your saved accounts" },
  { key: "shared",  label: "Shared with me", description: "Import an account shared by a family member" },
];

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function fmtLarge(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return fmtMoney(n);
}

// ── Styles (iOS) ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 400, letterSpacing: "0.02em", textTransform: "uppercase",
  color: "var(--ios-label-2)", display: "block", marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid var(--ios-separator)",
  borderRadius: 8, background: "var(--ios-bg)", color: "var(--ios-label)",
  fontSize: 15, outline: "none", boxSizing: "border-box",
};
const selectStyle: React.CSSProperties = { ...inputStyle };

// Small uppercase token pill (type / Plaid tags)
function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase",
      color, background: "var(--ios-fill)", padding: "2px 7px", borderRadius: 6,
    }}>
      {children}
    </span>
  );
}

const EMPTY_FORM = {
  name: "", type: "401k", owner: "self", balance: "",
  monthly_contribution: "", employer_match_pct: "", return_override: "",
  plaid_account_id: "",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccountsTab({
  accounts, setAccounts, onAccountsChange, plaidAccounts, savedAccounts, sharedAccounts, profile,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("custom");
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const totalPortfolio = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);

  // Filter sources that have data
  const availableSources = SOURCES.filter((s) => {
    if (s.key === "plaid")  return plaidAccounts.length > 0;
    if (s.key === "saved")  return savedAccounts.length > 0;
    if (s.key === "shared") return sharedAccounts.length > 0;
    return true;
  });

  function openAdd() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setSource("custom");
    setShowForm(true);
  }

  function openEdit(acct: RetirementAccount) {
    setEditId(acct.id);
    setForm({
      name: acct.name, type: acct.type, owner: acct.owner,
      balance: String(acct.balance ?? ""),
      monthly_contribution: String(acct.monthly_contribution ?? ""),
      employer_match_pct: String(acct.employer_match_pct ?? ""),
      return_override: acct.return_override != null ? String(acct.return_override * 100) : "",
      plaid_account_id: acct.plaid_account_id ?? "",
    });
    setSource("custom");
    setShowForm(true);
  }

  function handlePlaidSelect(plaidId: string) {
    const match = plaidAccounts.find((p) => p.id === plaidId);
    if (!match) return;
    setForm((f) => ({
      ...f,
      plaid_account_id: plaidId,
      name: f.name || match.name,
      balance: match.balance != null ? String(match.balance) : f.balance,
    }));
  }

  function handleSavedSelect(savedId: string) {
    const match = savedAccounts.find((s) => s.id === savedId);
    if (!match) return;
    setForm((f) => ({
      ...f,
      name: match.name,
      type: MANUAL_TO_RETIREMENT_TYPE[match.account_type] ?? "Other",
      balance: String(match.balance),
    }));
  }

  function handleSharedSelect(sharedId: string) {
    const match = sharedAccounts.find((s) => s.id === sharedId);
    if (!match) return;
    setForm((f) => ({
      ...f,
      name: match.name,
      type: MANUAL_TO_RETIREMENT_TYPE[match.account_type] ?? "Other",
      balance: String(match.balance),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const returnOverride = form.return_override !== "" ? parseFloat(form.return_override) / 100 : null;

    let updated: RetirementAccount[];

    if (editId) {
      updated = accounts.map((a) =>
        a.id === editId ? {
          ...a,
          name: form.name, type: form.type, owner: form.owner,
          balance: parseFloat(form.balance) || 0,
          monthly_contribution: parseFloat(form.monthly_contribution) || 0,
          employer_match_pct: parseFloat(form.employer_match_pct) || 0,
          return_override: returnOverride,
          plaid_account_id: form.plaid_account_id || null,
        } : a
      );
    } else {
      const newAcct: RetirementAccount = {
        id: crypto.randomUUID(), profile_id: "",
        name: form.name, type: form.type, owner: form.owner,
        balance: parseFloat(form.balance) || 0,
        monthly_contribution: parseFloat(form.monthly_contribution) || 0,
        employer_match_pct: parseFloat(form.employer_match_pct) || 0,
        return_override: returnOverride,
        plaid_account_id: form.plaid_account_id || null,
        sort_order: accounts.length,
        created_at: new Date().toISOString(),
      };
      updated = [...accounts, newAcct];
    }

    onAccountsChange(updated); // auto-save add/edit to DB
    setShowForm(false);
    setEditId(null);
    setForm({ ...EMPTY_FORM });
  }

  function handleDelete(id: string) {
    const updated = accounts.filter((a) => a.id !== id);
    onAccountsChange(updated); // updates state + auto-saves
  }

  // ── Quick inline edit ──────────────────────────────────────────────────────
  const [quickEdit, setQuickEdit] = useState<{
    id: string;
    field: "balance" | "monthly_contribution";
    value: string;
  } | null>(null);

  function startQuickEdit(acct: RetirementAccount, field: "balance" | "monthly_contribution") {
    setQuickEdit({ id: acct.id, field, value: String(field === "balance" ? (acct.balance ?? 0) : acct.monthly_contribution) });
  }

  function commitQuickEdit() {
    if (!quickEdit) return;
    const parsed = parseFloat(quickEdit.value.replace(/[,$]/g, ""));
    if (isNaN(parsed) || parsed < 0) { setQuickEdit(null); return; }
    const updated = accounts.map((a) =>
      a.id === quickEdit.id
        ? { ...a, [quickEdit.field]: parsed }
        : a
    );
    onAccountsChange(updated);
    setQuickEdit(null);
  }

  const selfAccounts = accounts.filter((a) => a.owner === "self");
  const spouseAccounts = accounts.filter((a) => a.owner === "spouse");

  function renderGroup(label: string, group: RetirementAccount[]) {
    if (group.length === 0) return null;
    return (
      <>
        <div className="ios-group-header" style={{ padding: "16px 0 7px" }}>{label}</div>
        <div className="ios-list" style={{ margin: 0 }}>
          {group.map((acct) => (
            <div key={acct.id} className="ios-cell" style={{ alignItems: "flex-start", flexWrap: "wrap", rowGap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span className="ios-headline">{acct.name}</span>
                  <Pill color="var(--ios-finance)">{TYPE_LABELS[acct.type] ?? acct.type}</Pill>
                  {acct.plaid_account_id && <Pill color="var(--ios-tint)">Linked</Pill>}
                </div>
                {/* Contribution — tap to quick-edit */}
                <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--ios-label-2)", alignItems: "center", flexWrap: "wrap" }}>
                  {quickEdit?.id === acct.id && quickEdit.field === "monthly_contribution" ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      +<input
                        autoFocus
                        type="number"
                        min="0"
                        step="1"
                        value={quickEdit.value}
                        onChange={(e) => setQuickEdit((q) => q ? { ...q, value: e.target.value } : q)}
                        onBlur={commitQuickEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") commitQuickEdit(); if (e.key === "Escape") setQuickEdit(null); }}
                        style={{ width: 90, padding: "3px 8px", border: "1.5px solid var(--ios-tint)", borderRadius: 6, fontSize: 13, outline: "none", background: "var(--ios-bg)", color: "var(--ios-label)" }}
                      />/mo
                    </span>
                  ) : (
                    <button
                      onClick={() => startQuickEdit(acct, "monthly_contribution")}
                      title="Tap to edit contribution"
                      className="ios-num"
                      style={{ padding: 0, color: "var(--ios-tint)", fontSize: 13 }}
                    >
                      +{fmtMoney(acct.monthly_contribution)}/mo
                    </button>
                  )}
                  {acct.employer_match_pct > 0 && (
                    <span style={{ color: "var(--ios-green)" }}>+{acct.employer_match_pct}% match</span>
                  )}
                  <span>
                    {acct.return_override != null
                      ? `${(acct.return_override * 100).toFixed(1)}% return`
                      : "global return"}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                {/* Balance — tap to quick-edit */}
                {quickEdit?.id === acct.id && quickEdit.field === "balance" ? (
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    step="1"
                    value={quickEdit.value}
                    onChange={(e) => setQuickEdit((q) => q ? { ...q, value: e.target.value } : q)}
                    onBlur={commitQuickEdit}
                    onKeyDown={(e) => { if (e.key === "Enter") commitQuickEdit(); if (e.key === "Escape") setQuickEdit(null); }}
                    style={{ width: 120, padding: "4px 8px", border: "1.5px solid var(--ios-tint)", borderRadius: 7, fontSize: 18, fontWeight: 600, outline: "none", textAlign: "right", background: "var(--ios-bg)", color: "var(--ios-label)" }}
                  />
                ) : (
                  <button
                    onClick={() => startQuickEdit(acct, "balance")}
                    title="Tap to update balance"
                    className="ios-num"
                    style={{ padding: 0, fontSize: 22, fontWeight: 600, color: "var(--ios-label)" }}
                  >
                    {fmtLarge(acct.balance ?? 0)}
                  </button>
                )}

                <div style={{ display: "flex", gap: 14 }}>
                  <button onClick={() => openEdit(acct)} style={{ padding: 0, color: "var(--ios-tint)", fontSize: 14 }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(acct.id)} style={{ padding: 0, color: "var(--ios-red)", fontSize: 14 }}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div>
      {/* Summary hero */}
      <div className="ios-list" style={{ margin: "0 0 8px", padding: 18, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total portfolio</div>
          <div className="ios-num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 2 }}>{fmtLarge(totalPortfolio)}</div>
          {accounts.length > 0 && (
            <div className="ios-subhead ios-num" style={{ marginTop: 2, color: "var(--ios-green)" }}>
              +{fmtMoney(accounts.reduce((s, a) => s + a.monthly_contribution, 0))}/mo contributions
            </div>
          )}
        </div>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textAlign: "right", flexShrink: 0 }}>
          {accounts.length} account{accounts.length !== 1 ? "s" : ""}
        </div>
      </div>

      {renderGroup("Self", selfAccounts)}
      {profile.spouse_enabled && renderGroup(profile.spouse_name ?? "Spouse", spouseAccounts)}

      {accounts.length === 0 && !showForm && (
        <div className="ios-footnote" style={{ textAlign: "center", padding: "36px 24px", color: "var(--ios-label-2)" }}>
          No accounts yet. Add your first retirement account below.
        </div>
      )}

      {!showForm && (
        <button
          onClick={openAdd}
          className="ios-btn ios-btn--primary"
          style={{ marginTop: 16 }}
        >
          Add account
        </button>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="ios-list"
          style={{ margin: "16px 0 0", padding: 18 }}
        >
          <div className="ios-title-3" style={{ marginBottom: 16 }}>
            {editId ? "Edit account" : "Add retirement account"}
          </div>

          {/* ── Source picker (add mode only) ── */}
          {!editId && (
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Source</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {availableSources.map((s) => {
                  const active = source === s.key;
                  return (
                    <Chip
                      key={s.key}
                      small
                      selected={active}
                      onClick={() => {
                        setSource(s.key);
                        // Reset source-specific fields when switching
                        setForm((f) => ({ ...f, plaid_account_id: "" }));
                      }}
                    >
                      {s.label}
                    </Chip>
                  );
                })}
              </div>

              {/* Source-specific pickers */}
              {source === "plaid" && plaidAccounts.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <label style={labelStyle}>Select linked account</label>
                  <select
                    value={form.plaid_account_id}
                    onChange={(e) => handlePlaidSelect(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">— choose a connected account —</option>
                    {plaidAccounts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.mask ? ` ····${p.mask}` : ""}{p.balance != null ? ` (${fmtMoney(p.balance)})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>
                    Name and balance will be pre-filled. You can edit before saving.
                  </p>
                </div>
              )}

              {source === "saved" && savedAccounts.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <label style={labelStyle}>Select saved account</label>
                  <select
                    onChange={(e) => handleSavedSelect(e.target.value)}
                    style={selectStyle}
                    defaultValue=""
                  >
                    <option value="">— choose a saved account —</option>
                    {savedAccounts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.institution ? ` · ${s.institution}` : ""} ({fmtMoney(s.balance)})
                      </option>
                    ))}
                  </select>
                  <p className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>
                    Name, type, and balance will be pre-filled from your saved account.
                  </p>
                </div>
              )}

              {source === "shared" && sharedAccounts.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <label style={labelStyle}>Select shared account</label>
                  <select
                    onChange={(e) => handleSharedSelect(e.target.value)}
                    style={selectStyle}
                    defaultValue=""
                  >
                    <option value="">— choose a shared account —</option>
                    {sharedAccounts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.shared_by} ({fmtMoney(s.balance)})
                      </option>
                    ))}
                  </select>
                  <p className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>
                    Balance reflects the shared account&apos;s current value. You can adjust before saving.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Account fields ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Account name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Fidelity 401(k)"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={selectStyle}>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {profile.spouse_enabled && (
              <div>
                <label style={labelStyle}>Owner</label>
                <select value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} style={selectStyle}>
                  <option value="self">Self</option>
                  <option value="spouse">{profile.spouse_name ?? "Spouse"}</option>
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>Current balance ($)</label>
              <input type="number" min="0" step="0.01" value={form.balance} onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Monthly contribution ($)</label>
              <input type="number" min="0" step="0.01" value={form.monthly_contribution} onChange={(e) => setForm((f) => ({ ...f, monthly_contribution: e.target.value }))} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Employer match (%)</label>
              <input type="number" min="0" max="100" step="0.1" value={form.employer_match_pct} onChange={(e) => setForm((f) => ({ ...f, employer_match_pct: e.target.value }))} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Return override (% / yr, optional)</label>
              <input type="number" min="0" max="30" step="0.1" value={form.return_override} onChange={(e) => setForm((f) => ({ ...f, return_override: e.target.value }))} placeholder={`global (${((profile.base_return ?? 0.07) * 100).toFixed(1)}%)`} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20, alignItems: "center" }}>
            <button type="submit" className="ios-btn ios-btn--primary" style={{ width: "auto", flex: 1 }}>
              {editId ? "Save changes" : "Add account"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} style={{ padding: "0 8px", color: "var(--ios-tint)", fontSize: 17 }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
