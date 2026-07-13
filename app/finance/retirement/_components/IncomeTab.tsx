"use client";

import { useState } from "react";
import { Chip } from "@/components/ios";
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
  salary: "var(--ios-green)",
  bonus: "#AF52DE",
  stock_award: "#FF9F0A",
  social_security: "var(--ios-tint)",
  pension: "var(--ios-finance)",
  part_time: "#30B0C7",
  other: "var(--ios-label-2)",
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
  recurring: false,   // stock_award: same grant issued every year until retirement
  match_eligible: true, // counts toward the 401(k) employer match base
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
    // Detect recurring: stock_award with no vest_years and end_age = retirement_age
    const isRecurring =
      inc.type === "stock_award" &&
      inc.vest_years == null &&
      inc.end_age === profile.retirement_age;
    setForm({
      name: inc.name,
      type: inc.type,
      owner: inc.owner,
      monthly_amount: String(inc.monthly_amount ?? ""),
      annual_growth_pct: inc.annual_growth_pct != null ? String(inc.annual_growth_pct) : "",
      vest_years: inc.vest_years != null ? String(inc.vest_years) : "",
      start_age: inc.start_age != null ? String(inc.start_age) : "",
      end_age: inc.end_age != null && !isRecurring ? String(inc.end_age) : "",
      ss_claim_age: inc.ss_claim_age != null ? String(inc.ss_claim_age) : "",
      recurring: isRecurring,
      match_eligible: inc.match_eligible ?? (inc.type === "salary"),
    });
    setShowPensionScanner(false);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const growthPct = form.annual_growth_pct !== "" ? parseFloat(form.annual_growth_pct) : null;
    const startAge = form.start_age !== "" ? parseInt(form.start_age) : null;

    // Recurring annual stock award: same grant every year until retirement
    const isRecurring = form.type === "stock_award" && form.recurring;
    const vestYears = isRecurring ? null : (form.vest_years !== "" ? parseInt(form.vest_years) : null);
    const endAge = isRecurring
      ? profile.retirement_age            // runs until retirement age
      : form.type === "stock_award" && vestYears != null && startAge != null
        ? startAge + vestYears             // single grant: start + vest period
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
      match_eligible: ["social_security", "pension"].includes(form.type) ? false : form.match_eligible,
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
    // Recurring annual grant: vest_years is null, end_age = retirement_age
    if (inc.type === "stock_award" && inc.vest_years == null && inc.end_age === profile.retirement_age) {
      const grantAge = inc.start_age ?? profile.current_age;
      return `Recurring annual grant · age ${grantAge} to retirement`;
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
      {/* Total hero */}
      <div className="ios-list" style={{ margin: "0 0 8px", padding: 18, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Household monthly income
          </div>
          <div className="ios-num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 2 }}>
            {fmtMoney(totalMonthly)}
          </div>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
            {incomes.length} source{incomes.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Chip
            small
            selected={showTemplates}
            onClick={() => { setShowTemplates((v) => !v); setShowSSOptimizer(false); setShowForm(false); }}
          >
            {showTemplates ? "Close" : "+ Retirement income"}
          </Chip>
          {showSSPrompt && (
            <Chip
              small
              selected={showSSOptimizer}
              onClick={() => { setShowSSOptimizer((v) => !v); setShowForm(false); setShowTemplates(false); }}
            >
              {showSSOptimizer ? "Close SS optimizer" : "SS optimizer"}
            </Chip>
          )}
        </div>
      </div>

      {/* Retirement income templates */}
      {showTemplates && (
        <div className="ios-list" style={{ margin: "0 0 8px", padding: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <h3 className="ios-title-3">Post-Retirement Income</h3>
            <span className="ios-footnote" style={{ color: "var(--ios-label-2)", letterSpacing: "0.03em", textTransform: "uppercase" }}>
              time-limited sources
            </span>
          </div>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5, marginBottom: 16 }}>
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
                    background: "var(--ios-fill-2)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div className="ios-subhead" style={{ fontWeight: 600, marginBottom: 4 }}>
                    {tpl.label}
                  </div>
                  <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.4, marginBottom: 8 }}>
                    {tpl.description}
                  </div>
                  <div className="ios-footnote ios-num" style={{ color: "var(--ios-finance)", fontWeight: 600 }}>
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
        <div className="ios-footnote" style={{ textAlign: "center", padding: "32px 24px", color: "var(--ios-label-2)" }}>
          No income sources yet. Add your salary, Social Security, or pension.
        </div>
      )}

      {incomes.length > 0 && (
        <div className="ios-list" style={{ margin: "0 0 12px" }}>
          {incomes.map((inc) => (
            <div key={inc.id} className="ios-cell" style={{ alignItems: "flex-start", flexWrap: "wrap", rowGap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span className="ios-headline">{inc.name}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      color: TYPE_COLORS[inc.type] ?? "var(--ios-label-2)",
                      background: "var(--ios-fill)",
                      padding: "2px 7px",
                      borderRadius: 6,
                    }}
                  >
                    {TYPE_LABELS[inc.type] ?? inc.type}
                  </span>
                  {profile.spouse_enabled && (
                    <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>
                      {inc.owner === "spouse" ? profile.spouse_name ?? "Spouse" : "Self"}
                    </span>
                  )}
                  {(inc.match_eligible ?? (inc.type === "salary")) && (
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", color: "var(--ios-finance)", background: "var(--ios-fill)", padding: "2px 7px", borderRadius: 6 }}>
                      401(k)
                    </span>
                  )}
                </div>
                <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>{ageRange(inc)}</div>
                {inc.type === "salary" && inc.annual_growth_pct != null && inc.annual_growth_pct > 0 && (() => {
                  const years = profile.retirement_age - profile.current_age;
                  const projected = inc.monthly_amount * Math.pow(1 + inc.annual_growth_pct / 100, years);
                  return years > 0 ? (
                    <div className="ios-caption ios-num" style={{ color: "var(--ios-finance)", marginTop: 2 }}>
                      +{inc.annual_growth_pct}%/yr · {fmtMoney(projected)}/mo at retirement
                    </div>
                  ) : null;
                })()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <div className="ios-num" style={{ fontSize: 18, fontWeight: 600, color: "var(--ios-label)" }}>
                  {fmtMoney(inc.monthly_amount)}{inc.frequency === "annual" ? "/yr" : inc.frequency === "one_time" ? " once" : "/mo"}
                </div>
                <div style={{ display: "flex", gap: 14 }}>
                  <button onClick={() => openEdit(inc)} style={btnSecondary}>Edit</button>
                  <button onClick={() => handleDelete(inc.id)} style={btnDanger}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showForm && (
        <button onClick={openAdd} className="ios-btn ios-btn--primary">
          Add income source
        </button>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="ios-list"
          style={{ margin: "16px 0 0", padding: 18 }}
        >
          <div className="ios-title-3" style={{ marginBottom: 16 }}>
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

            {/* 401(k) match eligibility — which pay the employer matches against */}
            {!["social_security", "pension"].includes(form.type) && (
              <label className="ios-subhead" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: "var(--ios-label)", padding: "4px 0" }}>
                <input
                  type="checkbox"
                  checked={form.match_eligible}
                  onChange={(e) => setForm((f) => ({ ...f, match_eligible: e.target.checked }))}
                  style={{ width: 18, height: 18, accentColor: "var(--ios-tint)" }}
                />
                Counts toward 401(k) match
              </label>
            )}

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
                    <div className="ios-caption ios-num" style={{ color: "var(--ios-finance)", marginTop: 5 }}>
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
                    <div className="ios-caption ios-num" style={{ color: "var(--ios-finance)", marginTop: 5 }}>
                      Estimated total over career: {fmtMoney(total)}
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Stock award: recurring toggle + optional vesting period */}
            {form.type === "stock_award" && (
              <>
                {/* Recurring annual grant toggle */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, recurring: !f.recurring, vest_years: "" }))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: form.recurring ? "var(--ios-fill)" : "var(--ios-fill-2)",
                      cursor: "pointer",
                      width: "100%",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ color: form.recurring ? "var(--ios-finance)" : "var(--ios-label-2)", display: "inline-flex" }}>
                      {form.recurring ? (
                        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8" /><path d="M20 4v4h-4" />
                          <path d="M20 12a8 8 0 0 1-13.7 5.7L4 16" /><path d="M4 20v-4h4" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <rect x="3.5" y="8" width="17" height="12" rx="2" /><path d="M12 8v12M3.5 12h17M12 8s-1.5-4-4-4a2 2 0 0 0 0 4M12 8s1.5-4 4-4a2 2 0 0 1 0 4" />
                        </svg>
                      )}
                    </span>
                    <div>
                      <div className="ios-subhead" style={{ fontWeight: 600, color: form.recurring ? "var(--ios-finance)" : "var(--ios-label)" }}>
                        {form.recurring ? "Recurring annual grant until retirement" : "One-time grant (vests over N years)"}
                      </div>
                      <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
                        {form.recurring
                          ? `Same grant issued every year from age ${form.start_age || "start"} to retirement — adds ${form.monthly_amount ? fmtMoney(parseFloat(form.monthly_amount)) : "$…"}/yr to portfolio`
                          : "E.g. a single RSU grant that vests over 4 years — tap to make it annual"}
                      </div>
                    </div>
                  </button>
                </div>

                {/* One-time grant: vesting period */}
                {!form.recurring && (
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
                )}

                {/* Summary */}
                <div style={{ gridColumn: "1 / -1" }}>
                  {form.recurring && form.monthly_amount && form.start_age && (
                    <div className="ios-caption ios-num" style={{ color: "var(--ios-finance)", padding: "8px 12px", background: "var(--ios-fill-2)", borderRadius: 8 }}>
                      {fmtMoney(parseFloat(form.monthly_amount))}/yr added to portfolio every year from age {form.start_age} to retirement (age {profile.retirement_age})
                      {" · "}{profile.retirement_age - parseInt(form.start_age)} grants total
                    </div>
                  )}
                  {!form.recurring && form.vest_years && form.monthly_amount && (
                    <div className="ios-caption ios-num" style={{ color: "var(--ios-finance)", padding: "8px 12px", background: "var(--ios-fill-2)", borderRadius: 8 }}>
                      Total grant value: {fmtMoney(parseFloat(form.monthly_amount) * parseInt(form.vest_years))} ·
                      vests {fmtMoney(parseFloat(form.monthly_amount))}/yr over {form.vest_years} years
                      {form.start_age && ` (age ${form.start_age}–${parseInt(form.start_age) + parseInt(form.vest_years)})`}
                    </div>
                  )}
                </div>
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
                      <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--ios-label-3)", marginLeft: 4 }}>
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
                      <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--ios-label-3)", marginLeft: 4 }}>
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
              <Chip small selected={showPensionScanner} onClick={() => setShowPensionScanner((v) => !v)}>
                {showPensionScanner ? "Hide scanner" : "Upload pension statement (PDF)"}
              </Chip>

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

          <div style={{ display: "flex", gap: 14, marginTop: 20, alignItems: "center" }}>
            <button type="submit" className="ios-btn ios-btn--primary" style={{ width: "auto", flex: 1 }}>
              {editId ? "Save changes" : "Add income"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setShowPensionScanner(false);
                setEditId(null);
              }}
              style={{ padding: "0 8px", color: "var(--ios-tint)", fontSize: 17 }}
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
  fontSize: 13,
  fontWeight: 400,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
  color: "var(--ios-label-2)",
  display: "block",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--ios-separator)",
  borderRadius: 8,
  background: "var(--ios-bg)",
  color: "var(--ios-label)",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = { ...inputStyle };

const btnSecondary: React.CSSProperties = {
  padding: 0,
  color: "var(--ios-tint)",
  fontSize: 14,
  cursor: "pointer",
};

const btnDanger: React.CSSProperties = {
  padding: 0,
  color: "var(--ios-red)",
  fontSize: 14,
  cursor: "pointer",
};
