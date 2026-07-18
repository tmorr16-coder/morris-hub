// The retirement projection engine — the SINGLE source of truth for the
// year-by-year portfolio path. Both the Projection tab (chart + Monte-Carlo) and
// the Advisor snapshot import from here, so the numbers can never diverge.

import type {
  RetirementProfile, RetirementAccount, RetirementIncome, RetirementExpense, RetirementDebt, RetirementScenario,
} from "../types";
import {
  baseAnnualSpend as scenarioBaseAnnualSpend,
  streamGrowth, expenseAnnualAt, debtAnnualAt, wageIncomeAt, employerMatchAnnual,
  titheAndOfferingAt, estimatedTaxAt, autoTaxRate, titheGrossBaseAt,
  retirementIncomeAt, incomeAnnualAt,
} from "./cashflow";

export interface StepCtx {
  profile: RetirementProfile;
  accounts: RetirementAccount[];
  incomes: RetirementIncome[];
  expenses: RetirementExpense[];
  debts: RetirementDebt[];
  scenario: RetirementScenario;
  weightedReturn: number;
  retirementReturn: number;
  baseAnnualSpend: number;
  windfall: number;
  nowMs: number;
}

export interface ProjectionResult {
  portfolioByAge: Map<number, number>;
  jobIncomeByAge: Map<number, number>;
  ssIncomeByAge: Map<number, number>;
  pensionIncomeByAge: Map<number, number>;
  expensesByAge: Map<number, number>;
  nestEgg: number;
  safeMonthlyWithdrawal: number;
  depletionAge: number | null;
  runway: number | string;
  baseAnnualSpend: number;
  weightedReturn: number;
  finalBalance: number;
}

/** Total entered outflows (expenses + debt payments) at a given age. */
export function outflowAt(ctx: StepCtx, age: number): number {
  let sum = 0;
  for (const e of ctx.expenses) sum += expenseAnnualAt(e, age, ctx.profile, ctx.nowMs);
  for (const d of ctx.debts) sum += debtAnnualAt(d, age, ctx.profile);
  return sum;
}

export function buildCtx(
  profile: RetirementProfile,
  accounts: RetirementAccount[],
  incomes: RetirementIncome[],
  expenses: RetirementExpense[],
  debts: RetirementDebt[],
  scenario: RetirementScenario
): StepCtx {
  const totalBal = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const weightedReturn = totalBal > 0
    ? accounts.reduce((s, a) => s + ((a.balance ?? 0) / totalBal) * (a.return_override ?? profile.base_return), 0)
    : profile.base_return;

  return {
    profile, accounts, incomes, expenses, debts, scenario,
    nowMs: Date.now(),
    weightedReturn,
    retirementReturn: profile.retirement_return ?? weightedReturn,
    baseAnnualSpend: scenarioBaseAnnualSpend(scenario),
    windfall: scenario.housing_windfall ?? 0,
  };
}

/** Market return for a year — accumulation return while working, the (optionally
 *  lower) retirement return at/after the retirement age. */
export function returnForAge(ctx: StepCtx, age: number): number {
  return age >= ctx.profile.retirement_age ? ctx.retirementReturn : ctx.weightedReturn;
}

/** Advances the portfolio one year — the ONE place per-year money math lives. */
export function stepYear(ctx: StepCtx, portfolioStart: number, age: number, yearReturn: number, endMult = 1): number {
  const { profile, accounts, incomes } = ctx;
  const isRetired = age >= profile.retirement_age;
  let portfolio = portfolioStart;

  if (age === profile.retirement_age) portfolio += ctx.windfall;
  if (age > profile.current_age) portfolio *= 1 + yearReturn;

  if (!isRetired) {
    // 401k contributions & employer match go in pre-tax (taxed at withdrawal);
    // bonuses/stock are banked after-tax; take-home wage covers spending.
    const taxRate = autoTaxRate(titheGrossBaseAt(incomes, age, profile), age, profile, ctx.scenario);
    portfolio += accounts.reduce((s, a) => s + a.monthly_contribution * 12, 0);
    portfolio += employerMatchAnnual(accounts, incomes, age, profile);
    for (const inc of incomes) {
      if (inc.type !== "bonus" && inc.type !== "stock_award") continue;
      const startAge = inc.start_age ?? profile.current_age;
      const endAge = inc.end_age ?? (
        inc.type === "stock_award" && inc.vest_years != null ? startAge + inc.vest_years : profile.retirement_age - 1
      );
      if (age < startAge || age > endAge) continue;
      portfolio += inc.monthly_amount * streamGrowth(inc, age - startAge) * (1 - taxRate);
    }
    const takeHomeWage = wageIncomeAt(incomes, age, profile) * (1 - taxRate);
    const deficit = outflowAt(ctx, age) + titheAndOfferingAt(ctx, age, ctx.nowMs) - takeHomeWage;
    if (deficit > 0) portfolio = Math.max(0, portfolio - deficit);
  } else {
    const inflFactor = Math.pow(1 + profile.inflation_rate, age - profile.current_age);
    const adjSpend = ctx.baseAnnualSpend * inflFactor;
    // Retirement income uses the SAME calc as the cash-flow inspector (growth +
    // SS claim-age-67), so the portfolio line and the inspector agree.
    const retirementIncome = retirementIncomeAt(incomes, age, profile);
    const totalSpend = adjSpend + outflowAt(ctx, age) + titheAndOfferingAt(ctx, age, ctx.nowMs) + estimatedTaxAt(ctx, age, ctx.nowMs);
    portfolio = Math.max(0, portfolio - Math.max(0, totalSpend - retirementIncome));
  }

  return portfolio * endMult;
}

/** Full path from current_age → life_expectancy with a per-year return + optional shock. */
export function runProjection(
  ctx: StepCtx,
  returnFor: (age: number) => number,
  opts?: { shockAge?: number | null; shockMult?: number }
): { byAge: Map<number, number>; depletionAge: number | null; final: number } {
  const { profile, accounts } = ctx;
  let portfolio = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const byAge = new Map<number, number>();
  let depletionAge: number | null = null;
  for (let age = profile.current_age; age <= profile.life_expectancy; age++) {
    const endMult = opts?.shockAge != null && age === opts.shockAge ? opts.shockMult ?? 1 : 1;
    portfolio = stepYear(ctx, portfolio, age, returnFor(age), endMult);
    if (portfolio === 0 && depletionAge === null && age >= profile.retirement_age) depletionAge = age;
    byAge.set(age, portfolio);
  }
  return { byAge, depletionAge, final: portfolio };
}

const JOB_TYPES = ["salary", "part_time", "other", "bonus", "stock_award"];

/** Deterministic projection with chart series. Chart income series are derived
 *  from incomeAnnualAt so they match the inspector and the drawdown exactly. */
export function project(
  profile: RetirementProfile,
  accounts: RetirementAccount[],
  incomes: RetirementIncome[],
  expenses: RetirementExpense[],
  debts: RetirementDebt[],
  scenario: RetirementScenario
): ProjectionResult {
  const ctx = buildCtx(profile, accounts, incomes, expenses, debts, scenario);
  const { weightedReturn, baseAnnualSpend, windfall } = ctx;

  let portfolio = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const portfolioByAge = new Map<number, number>();
  const jobIncomeByAge = new Map<number, number>();
  const ssIncomeByAge = new Map<number, number>();
  const pensionIncomeByAge = new Map<number, number>();
  const expensesByAge = new Map<number, number>();
  let nestEgg = 0;
  let depletionAge: number | null = null;

  for (let age = profile.current_age; age <= profile.life_expectancy; age++) {
    const isRetired = age >= profile.retirement_age;
    const inflFactor = Math.pow(1 + profile.inflation_rate, age - profile.current_age);
    if (age === profile.retirement_age) nestEgg = portfolio + windfall;

    portfolio = stepYear(ctx, portfolio, age, returnForAge(ctx, age));
    if (portfolio === 0 && depletionAge === null && isRetired) depletionAge = age;
    portfolioByAge.set(age, portfolio);

    let jobIncome = 0, ssIncome = 0, pensionIncome = 0;
    for (const inc of incomes) {
      if (JOB_TYPES.includes(inc.type)) jobIncome += incomeAnnualAt(inc, age, profile);
      else if (inc.type === "social_security") ssIncome += incomeAnnualAt(inc, age, profile);
      else if (inc.type === "pension") pensionIncome += incomeAnnualAt(inc, age, profile);
    }
    jobIncomeByAge.set(age, Math.round(jobIncome));
    ssIncomeByAge.set(age, Math.round(ssIncome));
    pensionIncomeByAge.set(age, Math.round(pensionIncome));

    const outflow = outflowAt(ctx, age) + titheAndOfferingAt(ctx, age, ctx.nowMs) + estimatedTaxAt(ctx, age, ctx.nowMs);
    expensesByAge.set(age, Math.round((isRetired ? baseAnnualSpend * inflFactor : 0) + outflow));
  }

  if (nestEgg === 0) nestEgg = portfolioByAge.get(profile.retirement_age) ?? 0;
  const safeMonthlyWithdrawal = (nestEgg * 0.04) / 12;
  const runway = depletionAge != null ? depletionAge - profile.retirement_age : "lifetime";

  return {
    portfolioByAge, jobIncomeByAge, ssIncomeByAge, pensionIncomeByAge, expensesByAge,
    nestEgg, safeMonthlyWithdrawal, depletionAge, runway, baseAnnualSpend, weightedReturn,
    finalBalance: portfolioByAge.get(profile.life_expectancy) ?? 0,
  };
}

export function projectForScenario(
  profile: RetirementProfile,
  accounts: RetirementAccount[],
  incomes: RetirementIncome[],
  expenses: RetirementExpense[],
  debts: RetirementDebt[],
  scenario: RetirementScenario,
  scenarioKey: "lean" | "balanced" | "abundant"
): { depletionAge: number | null; nestEgg: number } {
  const r = project(profile, accounts, incomes, expenses, debts, { ...scenario, selected_scenario: scenarioKey });
  return { depletionAge: r.depletionAge, nestEgg: r.nestEgg };
}
