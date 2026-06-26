"use client";

import { useState } from "react";
import type { RetirementAccount, RetirementProfile, PlaidAccountSuggestion } from "../types";

interface Props {
  accounts: RetirementAccount[];
  setAccounts: (a: RetirementAccount[]) => void;
  plaidAccounts: PlaidAccountSuggestion[];
  profile: RetirementProfile;
}

const ACCOUNT_TYPES = ["401k", "Roth IRA", "Traditional IRA", "HSA", "Brokerage", "Pension", "Other"];

const TYPE_LABELS: Record<string, string> = {
  "401k": "401(k)",
  "Roth IRA": "Roth IRA",
  "Traditional IRA": "Trad IRA",
  HSA: "HSA",
  Brokerage: "Brokerage",
  Pension: "Pension",
  Other: "Other",
};

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtLarge(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return fmtMoney(n);
}

const EMPTY_FORM = {
  name: "",
  type: "401k",
  owner: "self",
  balance: "",
  monthly_contribution: "",
  employer_match_pct: "",
  return_override: "",
  plaid_account_id: "",
};

export default function AccountsTab({ accounts, setAccounts, plaidAccounts, profile }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const totalPortfolio = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);

  function openAdd() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEdit(acct: RetirementAccount) {
    setEditId(acct.id);
    setForm({
      name: acct.name,
      type: acct.type,
      owner: acct.owner,
      balance: String(acct.balance ?? ""),
      monthly_contribution: String(acct.monthly_contribution ?? ""),
      employer_match_pct: String(acct.employer_match_pct ?? ""),
      return_override: acct.return_override != null ? String(acct.return_override * 100) : "",
      plaid_account_id: acct.plaid_account_id ?? "",
    });
    setShowForm(true);
  }

  function handlePlaidSelect(plaidId: string) {
    const match = plaidAccounts.find((p) => p.id === plaidId);
    if (!match) return;
    setForm((f) => ({
      ...f,
      plaid_account_id: plaidId,
      balance: match.balance != null ? String(match.balance) : f.balance,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const returnOverride =
      form.return_override !== "" ? parseFloat(form.return_override) / 100 : null;

    if (editId) {
      setAccounts(
        accounts.map((a) =>
          a.id === editId
            ? {
                ...a,
                name: form.name,
                type: form.type,
                owner: form.owner,
                balance: parseFloat(form.balance) || 0,
                monthly_contribution: parseFloat(form.monthly_contribution) || 0,
                employer_match_pct: parseFloat(form.employer_match_pct) || 0,
                return_override: returnOverride,
                plaid_account_id: form.plaid_account_id || null,
              }
            : a
        )
      );
    } else {
      const newAcct: RetirementAccount = {
        id: crypto.randomUUID(),
        profile_id: "",
        name: form.name,
        type: form.type,
        owner: form.owner,
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
    setAccounts(accounts.filter((a) => a.id !== id));
  }

  const selfAccounts = accounts.filter((a) => a.owner === "self");
  const spouseAccounts = accounts.filter((a) => a.owner === "spouse");

  function renderGroup(label: string, group: RetirementAccount[]) {
    if (group.length === 0) return null;
    return (
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-ink-3)",
            marginBottom: 10,
          }}
        >
          {label}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {group.map((acct) => (
            <div
              key={acct.id}
              style={{
                background: "var(--color-paper-card)",
                border: "1px solid var(--color-rule)",
                borderRadius: 10,
                padding: "14px 18px",
                boxShadow: "var(--shadow-card)",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span className="serif" style={{ fontSize: 16 }}>
                    {acct.name}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--color-bronze-dark)",
                      background: "rgba(139,106,71,0.1)",
                      padding: "2px 7px",
                      borderRadius: 8,
                    }}
                  >
                    {TYPE_LABELS[acct.type] ?? acct.type}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 18, fontSize: 12, color: "var(--color-ink-3)" }}>
                  <span>
                    +{fmtMoney(acct.monthly_contribution)}/mo
                    {acct.employer_match_pct > 0 && (
                      <span style={{ color: "var(--color-green)" }}>
                        {" "}
                        +{acct.employer_match_pct}% match
                      </span>
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
                <button
                  onClick={() => openEdit(acct)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 7,
                    border: "1px solid var(--color-rule)",
                    background: "var(--color-paper)",
                    color: "var(--color-ink-2)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(acct.id)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 7,
                    border: "1px solid rgba(154,59,42,0.3)",
                    background: "rgba(154,59,42,0.05)",
                    color: "var(--color-red)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
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
      {/* Summary card */}
      <div
        style={{
          background: "var(--color-paper-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "20px 24px",
          boxShadow: "var(--shadow-card)",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-ink-3)",
              marginBottom: 6,
            }}
          >
            Total portfolio
          </div>
          <div className="mono" style={{ fontSize: 36, fontWeight: 500, color: "var(--color-ink)" }}>
            {fmtLarge(totalPortfolio)}
          </div>
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
        <div
          style={{
            textAlign: "center",
            padding: "40px 24px",
            color: "var(--color-ink-3)",
            fontSize: 14,
          }}
        >
          No accounts yet. Add your first retirement account below.
        </div>
      )}

      {!showForm && (
        <button
          onClick={openAdd}
          style={{
            marginTop: 8,
            padding: "10px 22px",
            borderRadius: 10,
            border: "1px dashed var(--color-rule)",
            background: "transparent",
            color: "var(--color-ink-2)",
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
            width: "100%",
          }}
        >
          + Add account
        </button>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--color-paper-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 12,
            padding: "20px 24px",
            boxShadow: "var(--shadow-card)",
            marginTop: 12,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-ink)",
              marginBottom: 16,
            }}
          >
            {editId ? "Edit account" : "Add account"}
          </div>

          {plaidAccounts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--color-ink-3)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Link to Plaid balance
              </label>
              <select
                value={form.plaid_account_id}
                onChange={(e) => handlePlaidSelect(e.target.value)}
                style={selectStyle}
              >
                <option value="">— select a connected account —</option>
                {plaidAccounts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.mask ? ` ····${p.mask}` : ""}
                    {p.balance != null ? ` (${fmtMoney(p.balance)})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                style={selectStyle}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            {profile.spouse_enabled && (
              <div>
                <label style={labelStyle}>Owner</label>
                <select
                  value={form.owner}
                  onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                  style={selectStyle}
                >
                  <option value="self">Self</option>
                  <option value="spouse">{profile.spouse_name ?? "Spouse"}</option>
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>Current balance ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.balance}
                onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                placeholder="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Monthly contribution ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_contribution}
                onChange={(e) => setForm((f) => ({ ...f, monthly_contribution: e.target.value }))}
                placeholder="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Employer match (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.employer_match_pct}
                onChange={(e) => setForm((f) => ({ ...f, employer_match_pct: e.target.value }))}
                placeholder="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Return override (% per year, optional)</label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.1"
                value={form.return_override}
                onChange={(e) => setForm((f) => ({ ...f, return_override: e.target.value }))}
                placeholder={`global (${((profile.base_return ?? 0.07) * 100).toFixed(1)}%)`}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button
              type="submit"
              style={{
                padding: "9px 22px",
                borderRadius: 9,
                border: "1px solid var(--color-bronze-dark)",
                background: "var(--color-bronze)",
                color: "#FBF8F1",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {editId ? "Save changes" : "Add account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
              style={{
                padding: "9px 18px",
                borderRadius: 9,
                border: "1px solid var(--color-rule)",
                background: "transparent",
                color: "var(--color-ink-2)",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-ink-3)",
  display: "block",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--color-rule)",
  borderRadius: 8,
  background: "var(--color-paper)",
  color: "var(--color-ink)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--color-rule)",
  borderRadius: 8,
  background: "var(--color-paper)",
  color: "var(--color-ink)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
