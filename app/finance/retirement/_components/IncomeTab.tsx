"use client";

import { useState } from "react";
import { Chip } from "@/components/ios";
import type { RetirementIncome, RetirementProfile } from "../types";
import type { PensionOption } from "@/app/api/finance/retirement/pension-extract/route";
import PensionScanner from "./PensionScanner";
import SSOptimizer from "./SSOptimizer";
import { ssBenefitFactor } from "../_lib/cashflow";

interface Props {
  incomes: RetirementIncome[];
  setIncomes: (i: RetirementIncome[]) => void;
  profile: RetirementProfile;
  /** Unvested value across the stock-plan accounts — the number an estimated
   *  annual stock award is usually derived from. */
  unvestedTotal?: number;
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

function amountLabel(type: string, estimated = false): string {
  if (type === "bonus") return "Annual bonus amount ($)";
  if (type === "stock_award") return estimated ? "Estimated annual vesting value ($)" : "Annual vesting value of this grant ($)";
  // Being explicit matters here: the plan applies the claim-age adjustment to
  // this figure, so it has to be the full-retirement-age benefit — which is
  // also the number an SSA statement leads with.
  if (type === "social_security") return "Monthly benefit at full retirement age (67) ($)";
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
  recurring: true,    // stock_award: an estimated annual amount (vs. a single grant vesting over N years)
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

export default function IncomeTab({ incomes, setIncomes, profile, unvestedTotal }: Props) {
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
    // An estimated annual amount is any stock award without a vesting period.
    // (It used to also require end_age === retirement_age, which stopped an
    // estimate from having an end of its own — grants do run out.)
    const isRecurring = inc.type === "stock_award" && inc.vest_years == null;
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

    // Estimated annual stock award: the same amount vests every year until the
    // chosen age (retirement if none given).
    const isRecurring = form.type === "stock_award" && form.recurring;
    const vestYears = isRecurring ? null : (form.vest_years !== "" ? parseInt(form.vest_years) : null);
    const endAge = isRecurring
      ? (form.end_age !== "" ? parseInt(form.end_age) : profile.retirement_age)
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
    // Estimated annual amount: vest_years is null.
    if (inc.type === "stock_award" && inc.vest_years == null) {
      const grantAge = inc.start_age ?? profile.current_age;
      const until = inc.end_age ?? profile.retirement_age;
      return `Estimated annual vesting · age ${grantAge} to ${until}${until === profile.retirement_age ? " (retirement)" : ""}`;
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
              <label style={labelStyle}>{amountLabel(form.type, form.type === "stock_award" && form.recurring)}</label>
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
                {/* How the award is described: an estimate of what vests each
                    year (the usual case — nobody knows next year's grant), or a
                    single grant with a known vesting period. */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Describe it as</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <Chip small selected={form.recurring} onClick={() => setForm((f) => ({ ...f, recurring: true, vest_years: "" }))}>
                      Estimated annual amount
                    </Chip>
                    <Chip small selected={!form.recurring} onClick={() => setForm((f) => ({ ...f, recurring: false }))}>
                      Single grant, vests over N years
                    </Chip>
                  </div>
                  <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 6, lineHeight: 1.45 }}>
                    {form.recurring
                      ? "Roughly what vests each year. Added to the portfolio after tax, every year until the end age (retirement if blank)."
                      : "One RSU grant with a known vesting schedule — the annual value vests each year for N years."}
                  </div>
                  {form.recurring && (unvestedTotal ?? 0) > 0 && (
                    <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--ios-fill-2)", borderRadius: 8 }}>
                      <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginBottom: 6, lineHeight: 1.45 }}>
                        Your stock plan shows <strong className="ios-num">{fmtMoney(unvestedTotal ?? 0)}</strong> unvested. Spread it over:
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {[3, 4, 5].map((yrs) => (
                          <Chip
                            key={yrs}
                            small
                            onClick={() => setForm((f) => ({
                              ...f,
                              monthly_amount: String(Math.round((unvestedTotal ?? 0) / yrs)),
                              start_age: f.start_age || String(profile.current_age),
                              end_age: String((parseInt(f.start_age) || profile.current_age) + yrs - 1),
                            }))}
                          >
                            {yrs} yrs → {fmtMoney(Math.round((unvestedTotal ?? 0) / yrs))}/yr
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}
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
                  {form.recurring && form.monthly_amount && (() => {
                    const from = parseInt(form.start_age) || profile.current_age;
                    const until = parseInt(form.end_age) || profile.retirement_age;
                    const years = Math.max(0, until - from + 1);
                    return (
                      <div className="ios-caption ios-num" style={{ color: "var(--ios-finance)", padding: "8px 12px", background: "var(--ios-fill-2)", borderRadius: 8 }}>
                        {fmtMoney(parseFloat(form.monthly_amount))}/yr added to portfolio every year from age {from} to {until}
                        {until === profile.retirement_age ? " (retirement)" : ""}
                        {" · "}{years} year{years === 1 ? "" : "s"} · {fmtMoney(parseFloat(form.monthly_amount) * years)} total
                      </div>
                    );
                  })()}
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
                {/* The consequence of the choice, shown at the moment it's made.
                    Claiming early or late changes the benefit permanently. */}
                {(() => {
                  const claim = parseInt(form.ss_claim_age || "67");
                  const fra = parseFloat(form.monthly_amount) || 0;
                  if (!Number.isFinite(claim) || claim < 62 || claim > 70) return null;
                  const factor = ssBenefitFactor(claim);
                  const pct = Math.round((factor - 1) * 100);
                  return (
                    <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 6, lineHeight: 1.45 }}>
                      {claim === 67 ? (
                        <>Full retirement age — you receive the full benefit.</>
                      ) : (
                        <>
                          Claiming at {claim} pays{" "}
                          <strong style={{ color: pct < 0 ? "var(--ios-red)" : "var(--ios-green)" }}>
                            {pct > 0 ? "+" : ""}{pct}%
                          </strong>{" "}
                          for life
                          {fra > 0 && <> — about ${Math.round(fra * factor).toLocaleString()}/mo instead of ${Math.round(fra).toLocaleString()}</>}.
                        </>
                      )}
                    </div>
                  );
                })()}
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
                        {form.type === "stock_award" && form.recurring ? "— leave blank to run to retirement" : "— leave blank for lifetime"}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={form.end_age}
                    onChange={(e) => setForm((f) => ({ ...f, end_age: e.target.value }))}
                    placeholder={form.type === "salary" || (form.type === "stock_award" && form.recurring) ? `${profile.retirement_age}` : "e.g. 75"}
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
