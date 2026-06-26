"use client";

import { useState } from "react";
import type { RetirementIncome, RetirementProfile } from "../types";
import type { PensionOption } from "@/app/api/finance/retirement/pension-extract/route";
import PensionScanner from "./PensionScanner";
import SSOptimizer from "./SSOptimizer";

interface Props {
  incomes: RetirementIncome[];
  setIncomes: (i: RetirementIncome[]) => void;
  profile: RetirementProfile;
}

const INCOME_TYPES = ["salary", "bonus", "stock_award", "social_security", "pension", "part_time", "other"] as const;

const TYPE_LABELS: Record<string, string> = {
  salary: "Salary",
  bonus: "Annual Bonus",
  stock_award: "Stock Award",
  social_security: "Social Security",
  pension: "Pension",
  part_time: "Part-time",
  other: "Other",
};

const TYPE_COLORS: Record<string, string> = {
  salary: "var(--color-green)",
  bonus: "#7C5CBF",
  stock_award: "#B8860B",
  social_security: "#3B7CBF",
  pension: "var(--color-bronze)",
  part_time: "#2A9D8F",
  other: "var(--color-ink-3)",
};

// Types that should be treated as annual amounts (stored in monthly_amount field)
const ANNUAL_TYPES = new Set(["bonus", "stock_award"]);

// Default frequency by type
function defaultFrequency(type: string): string {
  if (ANNUAL_TYPES.has(type)) return "annual";
  return "monthly";
}

function amountLabel(type: string): string {
  if (type === "bonus") return "Annual bonus amount ($)";
  if (type === "stock_award") return "Annual vesting value ($)";
  return "Monthly amount ($)";
}

function amountPlaceholder(type: string): string {
  if (type === "bonus") return "e.g. 25000";
  if (type === "stock_award") return "e.g. 15000";
  return "0";
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const EMPTY_FORM = {
  name: "",
  type: "salary",
  owner: "self",
  monthly_amount: "",
  annual_growth_pct: "",
  vest_years: "",
  start_age: "",
  end_age: "",
  ss_claim_age: "",
};

interface RetirementTemplate {
  label: string;
  description: string;
  type: string;
  defaultName: string;
  startOffset: number | null;  // years after retirement_age, null = at retirement
  endOffset: number | null;    // years after retirement_age, null = indefinite
}

const RETIREMENT_TEMPLATES: RetirementTemplate[] = [
  {
    label: "Consulting / Part-time",
    description: "Income from post-career work, typically early retirement",
    type: "part_time",
    defaultName: "Consulting income",
    startOffset: 0,
    endOffset: 5,
  },
  {
    label: "Rental income",
    description: "Property rental over a specific period",
    type: "other",
    defaultName: "Rental income",
    startOffset: 0,
    endOffset: null,
  },
  {
    label: "Bridge income",
    description: "Covers the gap before Social Security or pension begins",
    type: "other",
    defaultName: "Bridge income",
    startOffset: 0,
    endOffset: 2,
  },
  {
    label: "Deferred compensation",
    description: "Employer deferred comp payout over a set period",
    type: "other",
    defaultName: "Deferred compensation",
    startOffset: 0,
    endOffset: 5,
  },
  {
    label: "Annuity / Structured payout",
    description: "Fixed payments from an annuity contract",
    type: "other",
    defaultName: "Annuity payout",
    startOffset: 0,
    endOffset: 10,
  },
  {
    label: "Inheritance / Windfall",
    description: "One-time or short-term income from an estate or asset sale",
    type: "other",
    defaultName: "Inheritance",
    startOffset: 0,
    endOffset: 1,
  },
];

export default function IncomeTab({ incomes, setIncomes, profile }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [showSSOptimizer, setShowSSOptimizer] = useState(false);
  const [showPensionScanner, setShowPensionScanner] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  function applyTemplate(tpl: RetirementTemplate) {
    const retAge = profile.retirement_age;
    const startAge = tpl.startOffset !== null ? retAge + tpl.startOffset : retAge;
    const endAge = tpl.endOffset !== null ? retAge + tpl.endOffset : null;
    setForm({
      ...EMPTY_FORM,
      name: tpl.defaultName,
      type: tpl.type,
      start_age: String(startAge),
      end_age: endAge !== null ? String(endAge) : "",
    });
    setShowTemplates(false);
    setShowSSOptimizer(false);
    setEditId(null);
    setShowForm(true);
  }

  const totalMonthly = incomes.reduce((s, i) => {
    const amt = i.monthly_amount ?? 0;
    if (i.frequency === "annual") return s + amt / 12;
    if (i.frequency === "one_time") return s;
    return s + amt;
  }, 0);
  const hasSelfSS = incomes.some((i) => i.type === "social_security" && i.owner === "self");
  const hasSpouseSS = incomes.some((i) => i.type === "social_security" && i.owner === "spouse");

  function openAdd() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowPensionScanner(false);
    setShowForm(true);
  }

  function openEdit(inc: RetirementIncome) {
    setEditId(inc.id);
    setForm({
      name: inc.name,
      type: inc.type,
      owner: inc.owner,
      monthly_amount: String(inc.monthly_amount ?? ""),
      annual_growth_pct: inc.annual_growth_pct != null ? String(inc.annual_growth_pct) : "",
      vest_years: inc.vest_years != null ? String(inc.vest_years) : "",
      start_age: inc.start_age != null ? String(inc.start_age) : "",
      end_age: inc.end_age != null ? String(inc.end_age) : "",
      ss_claim_age: inc.ss_claim_age != null ? String(inc.ss_claim_age) : "",
    });
    setShowPensionScanner(false);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const growthPct = form.annual_growth_pct !== "" ? parseFloat(form.annual_growth_pct) : null;
    const vestYears = form.vest_years !== "" ? parseInt(form.vest_years) : null;
    // Auto-set end_age for stock awards based on vest_years
    const startAge = form.start_age !== "" ? parseInt(form.start_age) : null;
    const endAge = form.type === "stock_award" && vestYears != null && startAge != null
      ? startAge + vestYears
      : form.end_age !== "" ? parseInt(form.end_age) : null;

    const incomeFields = {
      name: form.name,
      type: form.type,
      owner: form.owner,
      frequency: defaultFrequency(form.type),
      monthly_amount: parseFloat(form.monthly_amount) || 0,
      annual_growth_pct: growthPct,
      vest_years: vestYears,
      start_age: startAge,
      end_age: endAge,
      ss_claim_age: form.ss_claim_age !== "" ? parseInt(form.ss_claim_age) : null,
    };

    if (editId) {
      setIncomes(incomes.map((inc) => inc.id === editId ? { ...inc, ...incomeFields } : inc));
    } else {
      setIncomes([...incomes, {
        id: crypto.randomUUID(),
        profile_id: "",
        sort_order: incomes.length,
        created_at: new Date().toISOString(),
        ...incomeFields,
      }]);
    }

    setShowForm(false);
    setShowPensionScanner(false);
    setEditId(null);
    setForm({ ...EMPTY_FORM });
  }

  function handleDelete(id: string) {
    setIncomes(incomes.filter((i) => i.id !== id));
  }

  function handlePensionOptionSelect(option: PensionOption, owner: "self" | "spouse", pensionName: string) {
    setForm((f) => ({
      ...f,
      name: pensionName || `${owner === "spouse" ? profile.spouse_name ?? "Spouse" : "My"} Pension`,
      type: "pension",
      owner,
      monthly_amount: String(Math.round(option.monthly_amount)),
    }));
    setShowPensionScanner(false);
  }

  function handleSSAdd(income: RetirementIncome) {
    setIncomes([...incomes, { ...income, sort_order: incomes.length }]);
  }

  function ageRange(inc: RetirementIncome): string {
    if (inc.type === "social_security" && inc.ss_claim_age != null) {
      return `Claiming at age ${inc.ss_claim_age}`;
    }
    if (inc.type === "stock_award" && inc.vest_years != null) {
      const grantAge = inc.start_age ?? profile.current_age;
      return `${inc.vest_years}-yr vesting · age ${grantAge}–${grantAge + inc.vest_years}`;
    }
    if (inc.start_age != null && inc.end_age != null) {
      return `Age ${inc.start_age}–${inc.end_age}`;
    }
    if (inc.start_age != null) return `Starting age ${inc.start_age}`;
    if (inc.end_age != null) return `Until age ${inc.end_age}`;
    return "Ongoing";
  }

  const showSSPrompt = !hasSelfSS || (profile.spouse_enabled && !hasSpouseSS);

  return (
    <div>
      {/* Total card */}
      <div
        style={{
          background: "var(--color-paper-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "20px 24px",
          boxShadow: "var(--shadow-card)",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>
            Household monthly income
          </div>
          <div className="mono" style={{ fontSize: 36, fontWeight: 500, color: "var(--color-ink)" }}>
            {fmtMoney(totalMonthly)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => { setShowTemplates((v) => !v); setShowSSOptimizer(false); setShowForm(false); }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${showTemplates ? "var(--color-bronze-dark)" : "var(--color-rule)"}`,
              background: showTemplates ? "rgba(139,106,71,0.08)" : "var(--color-paper)",
              color: showTemplates ? "var(--color-bronze-dark)" : "var(--color-ink-2)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {showTemplates ? "Close" : "+ Retirement income"}
          </button>
          {showSSPrompt && (
            <button
              onClick={() => { setShowSSOptimizer((v) => !v); setShowForm(false); setShowTemplates(false); }}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1px solid ${showSSOptimizer ? "var(--color-bronze-dark)" : "#3B7CBF"}`,
                background: showSSOptimizer ? "rgba(139,106,71,0.08)" : "rgba(59,124,191,0.07)",
                color: showSSOptimizer ? "var(--color-bronze-dark)" : "#3B7CBF",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {showSSOptimizer ? "Close SS optimizer" : "SS optimizer"}
            </button>
          )}
          <div style={{ fontSize: 13, color: "var(--color-ink-3)", alignSelf: "center" }}>
            {incomes.length} source{incomes.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Retirement income templates */}
      {showTemplates && (
        <div
          style={{
            background: "var(--color-paper-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 12,
            padding: "20px 24px",
            boxShadow: "var(--shadow-card)",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <h3 className="serif" style={{ fontSize: 20 }}>Post-Retirement Income</h3>
            <span style={{ fontSize: 11, color: "var(--color-ink-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              time-limited sources
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--color-ink-3)", lineHeight: 1.5, marginBottom: 18 }}>
            Add income that begins at or after retirement and lasts for a defined period.
            Start and end ages are pre-filled based on your retirement age ({profile.retirement_age}) — adjust as needed.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
            {RETIREMENT_TEMPLATES.map((tpl) => {
              const startAge = tpl.startOffset !== null ? profile.retirement_age + tpl.startOffset : profile.retirement_age;
              const endAge = tpl.endOffset !== null ? profile.retirement_age + tpl.endOffset : null;
              return (
                <button
                  key={tpl.label}
                  onClick={() => applyTemplate(tpl)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: "1px solid var(--color-rule)",
                    background: "var(--color-paper)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--color-bronze)")}
                  onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--color-rule)")}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", marginBottom: 4 }}>
                    {tpl.label}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.4, marginBottom: 8 }}>
                    {tpl.description}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-bronze-dark)", fontWeight: 500 }}>
                    Age {startAge}{endAge !== null ? `–${endAge}` : "+"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SS Optimizer panel */}
      {showSSOptimizer && (
        <SSOptimizer
          profile={profile}
          onAddIncome={(inc) => {
            handleSSAdd(inc);
            setShowSSOptimizer(false);
          }}
        />
      )}

      {/* Income list */}
      {incomes.length === 0 && !showForm && !showSSOptimizer && (
        <div style={{ textAlign: "center", padding: "32px 24px", color: "var(--color-ink-3)", fontSize: 14 }}>
          No income sources yet. Add your salary, Social Security, or pension.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
        {incomes.map((inc) => (
          <div
            key={inc.id}
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span className="serif" style={{ fontSize: 16 }}>{inc.name}</span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#FBF8F1",
                    background: TYPE_COLORS[inc.type] ?? "var(--color-ink-3)",
                    padding: "2px 7px",
                    borderRadius: 8,
                  }}
                >
                  {TYPE_LABELS[inc.type] ?? inc.type}
                </span>
                {profile.spouse_enabled && (
                  <span style={{ fontSize: 10, color: "var(--color-ink-3)" }}>
                    {inc.owner === "spouse" ? profile.spouse_name ?? "Spouse" : "Self"}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>{ageRange(inc)}</div>
              {inc.type === "salary" && inc.annual_growth_pct != null && inc.annual_growth_pct > 0 && (() => {
                const years = profile.retirement_age - profile.current_age;
                const projected = inc.monthly_amount * Math.pow(1 + inc.annual_growth_pct / 100, years);
                return years > 0 ? (
                  <div style={{ fontSize: 11, color: "var(--color-bronze-dark)", marginTop: 2 }}>
                    +{inc.annual_growth_pct}%/yr · {fmtMoney(projected)}/mo at retirement
                  </div>
                ) : null;
              })()}
            </div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: "var(--color-ink)" }}>
              {fmtMoney(inc.monthly_amount)}{inc.frequency === "annual" ? "/yr" : inc.frequency === "one_time" ? " once" : "/mo"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => openEdit(inc)}
                style={btnSecondary}
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(inc.id)}
                style={btnDanger}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {!showForm && (
        <button
          onClick={openAdd}
          style={{
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
          + Add income source
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
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", marginBottom: 16 }}>
            {editId ? "Edit income source" : "Add income source"}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select
                value={form.type}
                onChange={(e) => {
                  setForm((f) => ({ ...f, type: e.target.value }));
                  setShowPensionScanner(false);
                }}
                style={selectStyle}
              >
                {INCOME_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
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
              <label style={labelStyle}>Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={form.type === "pension" ? "e.g. Lilly Pension Plan" : "e.g. Terry's salary"}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{amountLabel(form.type)}</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_amount}
                onChange={(e) => setForm((f) => ({ ...f, monthly_amount: e.target.value }))}
                placeholder={amountPlaceholder(form.type)}
                style={inputStyle}
              />
            </div>

            {/* Salary: growth rate + projected value */}
            {form.type === "salary" && (
              <div>
                <label style={labelStyle}>Annual raise / growth rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="0.1"
                  value={form.annual_growth_pct}
                  onChange={(e) => setForm((f) => ({ ...f, annual_growth_pct: e.target.value }))}
                  placeholder="e.g. 3"
                  style={inputStyle}
                />
                {form.annual_growth_pct && form.monthly_amount && (() => {
                  const years = profile.retirement_age - profile.current_age;
                  const projected = parseFloat(form.monthly_amount) * Math.pow(1 + parseFloat(form.annual_growth_pct) / 100, years);
                  return years > 0 && projected > 0 ? (
                    <div style={{ fontSize: 11, color: "var(--color-bronze-dark)", marginTop: 5 }}>
                      Projected at retirement (age {profile.retirement_age}): {fmtMoney(projected)}/mo
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Bonus: growth rate + total projection */}
            {form.type === "bonus" && (
              <div>
                <label style={labelStyle}>Annual growth rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="0.1"
                  value={form.annual_growth_pct}
                  onChange={(e) => setForm((f) => ({ ...f, annual_growth_pct: e.target.value }))}
                  placeholder="e.g. 3"
                  style={inputStyle}
                />
                {form.annual_growth_pct && form.monthly_amount && (() => {
                  const startAge = form.start_age !== "" ? parseInt(form.start_age) : profile.current_age;
                  const endAge = form.end_age !== "" ? parseInt(form.end_age) : profile.retirement_age;
                  const rate = parseFloat(form.annual_growth_pct) / 100;
                  const base = parseFloat(form.monthly_amount);
                  let total = 0;
                  for (let a = startAge; a < endAge; a++) {
                    total += base * Math.pow(1 + rate, a - startAge);
                  }
                  return total > 0 ? (
                    <div style={{ fontSize: 11, color: "var(--color-bronze-dark)", marginTop: 5 }}>
                      Estimated total over career: {fmtMoney(total)}
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Stock award: vesting period + total grant */}
            {form.type === "stock_award" && (
              <>
                <div>
                  <label style={labelStyle}>Vesting period (years)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    value={form.vest_years}
                    onChange={(e) => setForm((f) => ({ ...f, vest_years: e.target.value }))}
                    placeholder="e.g. 4"
                    style={inputStyle}
                  />
                </div>
                {form.vest_years && form.monthly_amount && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 11, color: "var(--color-bronze-dark)", padding: "8px 12px", background: "rgba(139,106,71,0.07)", borderRadius: 7 }}>
                      Total grant value: {fmtMoney(parseFloat(form.monthly_amount) * parseInt(form.vest_years))} ·
                      vests {fmtMoney(parseFloat(form.monthly_amount))}/yr over {form.vest_years} years
                      {form.start_age && ` (age ${form.start_age}–${parseInt(form.start_age) + parseInt(form.vest_years)})`}
                    </div>
                  </div>
                )}
              </>
            )}

            {form.type === "social_security" ? (
              <div>
                <label style={labelStyle}>Claim age</label>
                <input
                  type="number"
                  min="62"
                  max="70"
                  value={form.ss_claim_age}
                  onChange={(e) => setForm((f) => ({ ...f, ss_claim_age: e.target.value }))}
                  placeholder="67"
                  style={inputStyle}
                />
              </div>
            ) : (
              <>
                <div>
                  <label style={labelStyle}>
                    Start age
                    {form.type !== "salary" && (
                      <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--color-ink-4)", marginLeft: 4 }}>
                        — leave blank to start now
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.start_age}
                    onChange={(e) => setForm((f) => ({ ...f, start_age: e.target.value }))}
                    placeholder={form.type === "salary" ? "current age" : `e.g. ${profile.retirement_age}`}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    End age
                    {form.type !== "salary" && (
                      <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--color-ink-4)", marginLeft: 4 }}>
                        — leave blank for lifetime
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={form.end_age}
                    onChange={(e) => setForm((f) => ({ ...f, end_age: e.target.value }))}
                    placeholder={form.type === "salary" ? "retirement age" : "e.g. 75"}
                    style={inputStyle}
                  />
                </div>
              </>
            )}
          </div>

          {/* Pension scanner toggle */}
          {form.type === "pension" && !editId && (
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setShowPensionScanner((v) => !v)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--color-bronze)",
                  background: showPensionScanner ? "rgba(139,106,71,0.1)" : "transparent",
                  color: "var(--color-bronze-dark)",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {showPensionScanner ? "Hide scanner" : "Scan Lilly pension statement"}
              </button>

              {showPensionScanner && (
                <div style={{ marginTop: 10 }}>
                  <PensionScanner
                    spouseEnabled={profile.spouse_enabled}
                    spouseName={profile.spouse_name}
                    onSelect={(option, owner, name) => handlePensionOptionSelect(option, owner, name)}
                  />
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button type="submit" style={btnPrimary}>
              {editId ? "Save changes" : "Add income"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setShowPensionScanner(false);
                setEditId(null);
              }}
              style={btnSecondary}
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

const btnPrimary: React.CSSProperties = {
  padding: "9px 22px",
  borderRadius: 9,
  border: "1px solid var(--color-bronze-dark)",
  background: "var(--color-bronze)",
  color: "#FBF8F1",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnSecondary: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 7,
  border: "1px solid var(--color-rule)",
  background: "var(--color-paper)",
  color: "var(--color-ink-2)",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnDanger: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 7,
  border: "1px solid rgba(154,59,42,0.3)",
  background: "rgba(154,59,42,0.05)",
  color: "var(--color-red)",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};
