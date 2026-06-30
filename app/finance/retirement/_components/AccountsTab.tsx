"use client";

import { useState } from "react";
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
  onDelete: (updatedAccounts: RetirementAccount[]) => void;
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
  { key: "plaid",   label: "Plaid account",  description: "Link a Plaid-connected account" },
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

// ── Styles ────────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
  color: "var(--color-ink-3)", display: "block", marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid var(--color-rule)",
  borderRadius: 8, background: "var(--color-paper)", color: "var(--color-ink)",
  fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const selectStyle: React.CSSProperties = { ...inputStyle };

const EMPTY_FORM = {
  name: "", type: "401k", owner: "self", balance: "",
  monthly_contribution: "", employer_match_pct: "", return_override: "",
  plaid_account_id: "",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccountsTab({
  accounts, setAccounts, onDelete, plaidAccounts, savedAccounts, sharedAccounts, profile,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("custom");
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const totalPortfolio = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);

  // Filter sources that have data
  const availableSources = SOURCES.filter((s) => {
    if (s.key === "plaid") return plaidAccounts.length > 0;
    if (s.key === "saved") return savedAccounts.length > 0;
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

    if (editId) {
      setAccounts(accounts.map((a) =>
        a.id === editId ? {
          ...a,
          name: form.name, type: form.type, owner: form.owner,
          balance: parseFloat(form.balance) || 0,
          monthly_contribution: parseFloat(form.monthly_contribution) || 0,
          employer_match_pct: parseFloat(form.employer_match_pct) || 0,
          return_override: returnOverride,
          plaid_account_id: form.plaid_account_id || null,
        } : a
      ));
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
      setAccounts([...accounts, newAcct]);
    }

    setShowForm(false);
    setEditId(null);
    setForm({ ...EMPTY_FORM });
  }

  function handleDelete(id: string) {
    const updated = accounts.filter((a) => a.id !== id);
    setAccounts(updated);   // immediate visual update
    onDelete(updated);       // auto-save so Portfolio reflects the change
  }

  const selfAccounts = accounts.filter((a) => a.owner === "self");
  const spouseAccounts = accounts.filter((a) => a.owner === "spouse");

  function renderGroup(label: string, group: RetirementAccount[]) {
    if (group.length === 0) return null;
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 10 }}>
          {label}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {group.map((acct) => (
            <div key={acct.id} style={{ background: "var(--color-paper-card)", border: "1px solid var(--color-rule)", borderRadius: 10, padding: "14px 18px", boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span className="serif" style={{ fontSize: 16 }}>{acct.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-bronze-dark)", background: "rgba(139,106,71,0.1)", padding: "2px 7px", borderRadius: 8 }}>
                    {TYPE_LABELS[acct.type] ?? acct.type}
                  </span>
                  {acct.plaid_account_id && (
                    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-accent)", background: "rgba(59,92,127,0.08)", padding: "2px 7px", borderRadius: 8 }}>
                      Plaid
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 18, fontSize: 12, color: "var(--color-ink-3)" }}>
                  <span>
                    +{fmtMoney(acct.monthly_contribution)}/mo
                    {acct.employer_match_pct > 0 && (
                      <span style={{ color: "var(--color-green)" }}> +{acct.employer_match_pct}% match</span>
                    )}
                  </span>
                  <span>
                    {acct.return_override != null
                      ? `${(acct.return_override * 100).toFixed(1)}% return`
                      : "global return"}
                  </span>
                </div>
              </div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 500, color: "var(--color-ink)" }}>
                {fmtLarge(acct.balance ?? 0)}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openEdit(acct)} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--color-rule)", background: "var(--color-paper)", color: "var(--color-ink-2)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(acct.id)} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(154,59,42,0.3)", background: "rgba(154,59,42,0.05)", color: "var(--color-red)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Summary */}
      <div style={{ background: "var(--color-paper-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "20px 24px", boxShadow: "var(--shadow-card)", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>Total portfolio</div>
          <div className="mono" style={{ fontSize: 36, fontWeight: 500, color: "var(--color-ink)" }}>{fmtLarge(totalPortfolio)}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13, color: "var(--color-ink-3)" }}>
          <div>{accounts.length} account{accounts.length !== 1 ? "s" : ""}</div>
          {accounts.length > 0 && (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              +{fmtMoney(accounts.reduce((s, a) => s + a.monthly_contribution, 0))}/mo contributions
            </div>
          )}
        </div>
      </div>

      {renderGroup("Self", selfAccounts)}
      {profile.spouse_enabled && renderGroup(profile.spouse_name ?? "Spouse", spouseAccounts)}

      {accounts.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--color-ink-3)", fontSize: 14 }}>
          No accounts yet. Add your first retirement account below.
        </div>
      )}

      {!showForm && (
        <button
          onClick={openAdd}
          style={{ marginTop: 8, padding: "10px 22px", borderRadius: 10, border: "1px dashed var(--color-rule)", background: "transparent", color: "var(--color-ink-2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", width: "100%" }}
        >
          + Add account
        </button>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{ background: "var(--color-paper-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "20px 24px", boxShadow: "var(--shadow-card)", marginTop: 12 }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", marginBottom: 18 }}>
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
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        setSource(s.key);
                        // Reset source-specific fields when switching
                        setForm((f) => ({ ...f, plaid_account_id: "" }));
                      }}
                      title={s.description}
                      style={{
                        padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                        border: active ? "2px solid var(--color-bronze)" : "1px solid var(--color-rule)",
                        background: active ? "rgba(139,106,71,0.08)" : "transparent",
                        color: active ? "var(--color-bronze-dark)" : "var(--color-ink-3)",
                        cursor: "pointer", fontFamily: "inherit", transition: "all 100ms",
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>

              {/* Source-specific pickers */}
              {source === "plaid" && plaidAccounts.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <label style={labelStyle}>Select Plaid account</label>
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
                  <p style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 4 }}>
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
                  <p style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 4 }}>
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
                  <p style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 4 }}>
                    Balance reflects the shared account's current value. You can adjust before saving.
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

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button type="submit" style={{ padding: "9px 22px", borderRadius: 9, border: "1px solid var(--color-bronze-dark)", background: "var(--color-bronze)", color: "#FBF8F1", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
              {editId ? "Save changes" : "Add account"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
