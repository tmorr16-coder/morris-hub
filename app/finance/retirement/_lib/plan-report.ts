// Everything the printed plan document needs, computed once from the same
// engine the module's tabs use. Pure: no React, no I/O — so a route can call
// it to brief the model that writes the narrative, and the page can call it to
// draw the tables, and the two can never disagree.

import type {
  RetirementProfile, RetirementAccount, RetirementIncome, RetirementExpense, RetirementDebt, RetirementScenario,
} from "../types";
import { buildCtx, project, projectForScenario, runProjection, returnForAge, type ProjectionResult } from "./projection";
import { runMonteCarlo, type MonteCarloResult } from "./montecarlo";
import { accountTaxMix, bucketOf, selectedMonthlySpend, retirementIncomeAt, RMD_AGE, type TaxBucket } from "./cashflow";

export interface PlanInputs {
  profile: RetirementProfile;
  accounts: RetirementAccount[];
  incomes: RetirementIncome[];
  expenses: RetirementExpense[];
  debts: RetirementDebt[];
  scenario: RetirementScenario;
}

export interface MilestoneRow {
  age: number;
  year: number;
  isRetired: boolean;
  portfolio: number;
  jobIncome: number;
  ss: number;
  pension: number;
  outflow: number;
  tax: number;
  rmd: number;
  note: string | null;
}

export interface ScenarioRow {
  key: "lean" | "balanced" | "abundant";
  label: string;
  monthlySpend: number;
  nestEgg: number;
  depletionAge: number | null;
  selected: boolean;
}

export interface PlanReport {
  generatedAt: string;
  inputs: PlanInputs;
  projection: ProjectionResult;
  monteCarlo: MonteCarloResult;
  /** Nest egg at retirement in today's purchasing power. */
  nestEggReal: number;
  yearsToRetirement: number;
  retirementYear: number;
  planEndYear: number;
  /** Lifestyle spend in retirement, today's dollars, before healthcare. */
  monthlySpend: number;
  annualLifestyleSpend: number;
  /** Retirement income (SS, pension, part-time) in the first year everything flows. */
  retirementIncomeAtStart: number;
  annualWithdrawalNeed: number;
  safeAnnualWithdrawal: number;
  netWorth: {
    portfolio: number;
    unvested: number;
    home: number;
    debt: number;
    total: number;
    potential: number;
  };
  taxMix: Record<TaxBucket, number>;
  taxMixPct: Record<TaxBucket, number>;
  contributions: { monthly: number; annual: number };
  expenses: { essentialMonthly: number; discretionaryMonthly: number };
  debtPayments: { monthly: number };
  scenarios: ScenarioRow[];
  /** A one-time −20% market hit in the first year of retirement. */
  shock: { pct: number; age: number; depletionAge: number | null; finalBalance: number };
  /** Lifetime retirement tax + IRMAA with and without the Roth-conversion window. */
  roth: { enabled: boolean; withTax: number; withoutTax: number; saved: number } | null;
  legacy: { goal: number; goalNominal: number; finalBalance: number; met: boolean } | null;
  milestones: MilestoneRow[];
  path: { age: number; value: number }[];
}

export function bucketLabel(b: TaxBucket): string {
  return { pretax: "Pre-tax", roth: "Roth", taxable: "Taxable", hsa: "HSA" }[b];
}

const SCENARIO_LABELS: Record<ScenarioRow["key"], string> = {
  lean: "Lean & Purposeful",
  balanced: "Balanced Living",
  abundant: "Abundant & Active",
};

function firstSsClaimAge(incomes: RetirementIncome[], profile: RetirementProfile): number {
  const ages = incomes
    .filter((i) => i.type === "social_security")
    .map((i) => i.ss_claim_age ?? i.start_age ?? profile.retirement_age);
  return ages.length ? Math.min(...ages) : profile.retirement_age;
}

export function buildPlanReport(inputs: PlanInputs): PlanReport {
  const { profile, accounts, incomes, expenses, debts, scenario } = inputs;
  const projection = project(profile, accounts, incomes, expenses, debts, scenario);
  const ctx = buildCtx(profile, accounts, incomes, expenses, debts, scenario);

  const ages: number[] = [];
  for (let a = profile.current_age; a <= profile.life_expectancy; a++) ages.push(a);
  const monteCarlo = runMonteCarlo(ctx, ages);

  const yearsToRetirement = Math.max(0, profile.retirement_age - profile.current_age);
  const inflAt = (age: number) => Math.pow(1 + profile.inflation_rate, age - profile.current_age);
  const thisYear = new Date().getFullYear();

  const monthlySpend = selectedMonthlySpend(scenario);
  const annualLifestyleSpend = monthlySpend * 12 + (scenario.annual_travel ?? 0) + (scenario.monthly_health_premium ?? 0) * 12;
  const retirementIncomeAtStart = retirementIncomeAt(
    incomes,
    Math.max(profile.retirement_age, firstSsClaimAge(incomes, profile)),
    profile,
  );
  const annualWithdrawalNeed = Math.max(0, annualLifestyleSpend - retirementIncomeAtStart);
  const safeAnnualWithdrawal = projection.nestEgg * 0.04;

  const portfolio = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const unvested = accounts.reduce((s, a) => s + (a.unvested_value ?? 0), 0);
  const home = scenario.home_value ?? 0;
  const debt = debts.reduce((s, d) => s + (d.balance ?? 0), 0);

  const taxMix = accountTaxMix(accounts);
  const mixTotal = Object.values(taxMix).reduce((s, v) => s + v, 0);
  const taxMixPct = Object.fromEntries(
    (Object.keys(taxMix) as TaxBucket[]).map((k) => [k, mixTotal > 0 ? taxMix[k] / mixTotal : 0]),
  ) as Record<TaxBucket, number>;

  const monthlyContrib = accounts.reduce((s, a) => s + (a.monthly_contribution ?? 0), 0);

  const scenarios: ScenarioRow[] = (["lean", "balanced", "abundant"] as const).map((key) => {
    const r = projectForScenario(profile, accounts, incomes, expenses, debts, scenario, key);
    return {
      key,
      label: SCENARIO_LABELS[key],
      monthlySpend: scenario[`${key}_monthly_spend`],
      nestEgg: r.nestEgg,
      depletionAge: r.depletionAge,
      selected: scenario.selected_scenario === key,
    };
  });

  const shockRun = runProjection(ctx, (age) => returnForAge(ctx, age), {
    shockAge: profile.retirement_age,
    shockMult: 0.8,
  });

  const rothOn = !!scenario.roth_convert_enabled && (scenario.roth_convert_annual ?? 0) > 0;
  let roth: PlanReport["roth"] = null;
  if (rothOn) {
    const without = project(profile, accounts, incomes, expenses, debts, { ...scenario, roth_convert_enabled: false });
    const lifetime = (r: ProjectionResult) => {
      let s = 0;
      for (let a = profile.retirement_age; a <= profile.life_expectancy; a++) s += (r.taxByAge.get(a) ?? 0) + (r.irmaaByAge.get(a) ?? 0);
      return s;
    };
    const withTax = lifetime(projection);
    const withoutTax = lifetime(without);
    roth = { enabled: true, withTax, withoutTax, saved: withoutTax - withTax };
  }

  const legacyGoal = scenario.legacy_goal ?? 0;
  const legacy = legacyGoal > 0
    ? (() => {
        const goalNominal = legacyGoal * inflAt(profile.life_expectancy);
        return { goal: legacyGoal, goalNominal, finalBalance: projection.finalBalance, met: projection.finalBalance >= goalNominal };
      })()
    : null;

  // Milestone years: every fifth year, plus the ages where something changes.
  const special = new Map<number, string>();
  special.set(profile.current_age, "Today");
  special.set(profile.retirement_age, "Retirement");
  const ssAge = firstSsClaimAge(incomes, profile);
  if (incomes.some((i) => i.type === "social_security")) special.set(ssAge, "Social Security begins");
  if (profile.retirement_age < 65 && 65 <= profile.life_expectancy) special.set(65, "Medicare");
  if (RMD_AGE <= profile.life_expectancy) special.set(RMD_AGE, "Required distributions");
  if (projection.depletionAge != null) special.set(projection.depletionAge, "Portfolio depleted");
  special.set(profile.life_expectancy, "End of plan");

  const milestones: MilestoneRow[] = [];
  for (const age of ages) {
    const every5 = (age - profile.current_age) % 5 === 0;
    if (!every5 && !special.has(age)) continue;
    const d = projection.detailByAge.get(age);
    milestones.push({
      age,
      year: thisYear + (age - profile.current_age),
      isRetired: age >= profile.retirement_age,
      portfolio: projection.portfolioByAge.get(age) ?? 0,
      jobIncome: projection.jobIncomeByAge.get(age) ?? 0,
      ss: projection.ssIncomeByAge.get(age) ?? 0,
      pension: projection.pensionIncomeByAge.get(age) ?? 0,
      outflow: projection.expensesByAge.get(age) ?? 0,
      tax: (projection.taxByAge.get(age) ?? 0) + (projection.irmaaByAge.get(age) ?? 0),
      rmd: d?.rmd ?? 0,
      note: special.get(age) ?? null,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    inputs,
    projection,
    monteCarlo,
    nestEggReal: projection.nestEgg / inflAt(profile.retirement_age),
    yearsToRetirement,
    retirementYear: thisYear + yearsToRetirement,
    planEndYear: thisYear + (profile.life_expectancy - profile.current_age),
    monthlySpend,
    annualLifestyleSpend,
    retirementIncomeAtStart,
    annualWithdrawalNeed,
    safeAnnualWithdrawal,
    netWorth: { portfolio, unvested, home, debt, total: portfolio + home - debt, potential: portfolio + home - debt + unvested },
    taxMix,
    taxMixPct,
    contributions: { monthly: monthlyContrib, annual: monthlyContrib * 12 },
    expenses: {
      essentialMonthly: expenses.filter((e) => e.essential).reduce((s, e) => s + e.monthly_amount, 0),
      discretionaryMonthly: expenses.filter((e) => !e.essential).reduce((s, e) => s + e.monthly_amount, 0),
    },
    debtPayments: {
      monthly: debts.reduce((s, d) => s + (d.subtype === "lease" ? d.lease_monthly_payment ?? 0 : d.monthly_payment ?? 0), 0),
    },
    scenarios,
    shock: { pct: 20, age: profile.retirement_age, depletionAge: shockRun.depletionAge, finalBalance: shockRun.final },
    roth,
    legacy,
    milestones,
    path: ages.map((age) => ({ age, value: projection.portfolioByAge.get(age) ?? 0 })),
  };
}

// ── Formatting shared by the page and the narrative brief ────────────────────

export function fmtUSD(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "−" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${n < 0 ? "−" : ""}$${(abs / 1_000).toFixed(0)}k`;
  return fmtUSD(n);
}
export function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

/**
 * The plan as text, for the model that writes the summary. Mirrors the page
 * section for section so the narrative can only cite numbers the reader can
 * find on the same document.
 */
export function planReportBrief(r: PlanReport): string {
  const { profile, accounts, incomes, expenses, debts, scenario } = r.inputs;
  const p = r.projection;
  const lines: string[] = [];
  lines.push(`# Retirement plan brief (generated ${r.generatedAt.slice(0, 10)})`);
  lines.push(`Ages: now ${profile.current_age}, retire ${profile.retirement_age} (${r.retirementYear}), plan to ${profile.life_expectancy} (${r.planEndYear}).`);
  if (profile.spouse_enabled) lines.push(`Spouse: ${profile.spouse_name ?? "unnamed"}, age ${profile.spouse_age ?? "?"}, retiring ${profile.spouse_retirement_age ?? "?"}. Filing jointly.`);
  lines.push(`Assumptions: return ${fmtPct(profile.base_return)} pre-retirement, ${fmtPct(profile.retirement_return ?? p.weightedReturn)} after; inflation ${fmtPct(profile.inflation_rate)}.`);
  lines.push(`Social Security: COLA ${fmtPct(profile.ss_cola_rate ?? profile.inflation_rate)}${profile.ss_cola_rate == null ? " (same as inflation)" : ""}; ${(profile.ss_cut_pct ?? 0) > 0 ? `benefits reduced ${profile.ss_cut_pct}% from ${profile.ss_cut_year ?? 2033} onward` : "every scheduled dollar assumed paid (no trust-fund reduction)"}.`);
  lines.push("");
  lines.push("## Headline");
  lines.push(`Nest egg at ${profile.retirement_age}: ${fmtUSD(p.nestEgg)} nominal (${fmtUSD(r.nestEggReal)} in today's dollars). Safe withdrawal (4%): ${fmtUSD(p.safeMonthlyWithdrawal)}/mo.`);
  lines.push(`Deterministic path: ${p.depletionAge != null ? `portfolio depleted at age ${p.depletionAge}` : `lasts the whole plan, ending with ${fmtUSD(p.finalBalance)}`}.`);
  lines.push(`Monte Carlo (${r.monteCarlo.band.length ? 400 : 0} runs): ${fmtPct(r.monteCarlo.successRate, 0)} success; ${r.monteCarlo.failures} failures${r.monteCarlo.medianDepletionAge != null ? `, typical failure at age ${Math.round(r.monteCarlo.medianDepletionAge)}, early failure at ${Math.round(r.monteCarlo.earlyDepletionAge ?? 0)}` : ""}; 10th-percentile ending balance ${fmtUSD(r.monteCarlo.p10Final)}, median ${fmtUSD(r.monteCarlo.medianFinal)}.`);
  lines.push(`Market shock test: −20% in the first retirement year → ${r.shock.depletionAge != null ? `depleted at ${r.shock.depletionAge}` : `still lasts, ending ${fmtUSD(r.shock.finalBalance)}`}.`);
  if (r.legacy) lines.push(`Legacy goal ${fmtUSD(r.legacy.goal)} today's dollars (${fmtUSD(r.legacy.goalNominal)} nominal): ${r.legacy.met ? "met" : "NOT met"}.`);
  if (r.roth) lines.push(`Roth conversions: lifetime retirement tax+IRMAA ${fmtUSD(r.roth.withTax)} with, ${fmtUSD(r.roth.withoutTax)} without (saves ${fmtUSD(r.roth.saved)}).`);
  lines.push("");
  lines.push("## Net worth today");
  lines.push(`Portfolio ${fmtUSD(r.netWorth.portfolio)}; unvested stock ${fmtUSD(r.netWorth.unvested)}; home ${fmtUSD(r.netWorth.home)}; debt ${fmtUSD(r.netWorth.debt)}; net ${fmtUSD(r.netWorth.total)} (potential ${fmtUSD(r.netWorth.potential)}).`);
  lines.push(`Tax mix: ${(Object.keys(r.taxMixPct) as TaxBucket[]).map((k) => `${bucketLabel(k)} ${fmtPct(r.taxMixPct[k], 0)}`).join(", ")}.`);
  lines.push(`Contributions ${fmtUSD(r.contributions.monthly)}/mo.`);
  lines.push("");
  lines.push("## Accounts");
  for (const a of accounts) lines.push(`- ${a.name} [${a.type}, ${bucketLabel(bucketOf(a))}, ${a.owner}]: ${fmtUSD(a.balance)}${a.unvested_value ? ` + ${fmtUSD(a.unvested_value)} unvested` : ""}; +${fmtUSD(a.monthly_contribution)}/mo${a.employer_match_pct ? `, ${a.employer_match_pct}% match` : ""}`);
  lines.push("");
  lines.push("## Income");
  for (const i of incomes) {
    const when = i.type === "social_security" ? `claim at ${i.ss_claim_age ?? "?"}` : `${i.start_age ?? "now"}–${i.end_age ?? "∞"}`;
    lines.push(`- ${i.name} [${i.type}, ${i.owner}]: ${fmtUSD(i.monthly_amount)} ${i.frequency}; ${when}${i.annual_growth_pct ? `; +${i.annual_growth_pct}%/yr` : ""}`);
  }
  lines.push(`Retirement income in first full year: ${fmtUSD(r.retirementIncomeAtStart)}/yr.`);
  lines.push("");
  lines.push("## Retirement lifestyle");
  lines.push(`Scenario: ${scenario.selected_scenario}; ${fmtUSD(r.monthlySpend)}/mo + travel ${fmtUSD(scenario.annual_travel)}/yr + health ${fmtUSD(scenario.monthly_health_premium)}/mo = ${fmtUSD(r.annualLifestyleSpend)}/yr. Portfolio must fund ${fmtUSD(r.annualWithdrawalNeed)}/yr vs ${fmtUSD(r.safeAnnualWithdrawal)}/yr safe.`);
  for (const s of r.scenarios) lines.push(`- ${s.label}: ${fmtUSD(s.monthlySpend)}/mo → nest egg ${fmtUSD(s.nestEgg)}, ${s.depletionAge != null ? `depletes at ${s.depletionAge}` : "lasts"}${s.selected ? " (selected)" : ""}`);
  if (scenario.tithe_enabled) lines.push(`Giving: ${scenario.tithe_pct ?? 10}% tithe on ${scenario.tithe_basis ?? "gross"} + ${fmtUSD(scenario.offering_monthly ?? 0)}/mo.`);
  if (scenario.ltc_enabled) lines.push(`Long-term care modelled: ${fmtUSD(scenario.ltc_monthly_cost ?? 0)}/mo for ${scenario.ltc_years ?? "?"} years.`);
  if (scenario.survivor_enabled) lines.push(`Survivor transition at age ${scenario.survivor_age ?? "?"}, spending ${scenario.survivor_spend_pct ?? 75}%.`);
  lines.push("");
  lines.push("## Outflows today");
  lines.push(`Expenses: essential ${fmtUSD(r.expenses.essentialMonthly)}/mo, discretionary ${fmtUSD(r.expenses.discretionaryMonthly)}/mo. Debt payments ${fmtUSD(r.debtPayments.monthly)}/mo.`);
  for (const e of expenses) lines.push(`- ${e.name}${e.essential ? "" : " (discretionary)"}: ${fmtUSD(e.monthly_amount)}/mo${e.end_date ? ` until ${e.end_date}` : ""}`);
  for (const d of debts) lines.push(`- ${d.name} [${d.subtype === "lease" ? "lease" : d.type}]: ${d.subtype === "lease" ? `${fmtUSD(d.lease_monthly_payment ?? 0)}/mo, ${d.lease_months_remaining ?? "?"} months left` : `${fmtUSD(d.balance ?? 0)} at ${d.rate_pct ?? "?"}%, ${fmtUSD(d.monthly_payment ?? 0)}/mo`}`);
  lines.push("");
  lines.push("## Milestones (age: portfolio | income | outflow)");
  for (const m of r.milestones) lines.push(`- ${m.age} (${m.year})${m.note ? ` ${m.note}` : ""}: ${fmtUSD(m.portfolio)} | job ${fmtUSD(m.jobIncome)}, SS ${fmtUSD(m.ss)}, pension ${fmtUSD(m.pension)} | out ${fmtUSD(m.outflow)} incl. tax ${fmtUSD(m.tax)}${m.rmd ? `, RMD ${fmtUSD(m.rmd)}` : ""}`);
  return lines.join("\n");
}
