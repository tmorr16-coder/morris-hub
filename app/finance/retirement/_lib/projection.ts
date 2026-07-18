// The retirement projection engine — the SINGLE source of truth for the
// year-by-year portfolio path. STATEFUL: it tracks four tax buckets
// (pre-tax / Roth / taxable / HSA) across years, so it can model RMDs, tax-aware
// withdrawal sequencing, IRMAA, and bucket-correct taxation. Both the Projection
// tab and the cash-flow inspector read from here so nothing diverges.

import type {
  RetirementProfile, RetirementAccount, RetirementIncome, RetirementExpense, RetirementDebt, RetirementScenario,
} from "../types";
import {
  baseAnnualSpend as scenarioBaseAnnualSpend,
  streamGrowth, expenseAnnualAt, debtAnnualAt, wageIncomeAt, employerMatchAnnual,
  titheAndOfferingAt, estimatedTaxAt, autoTaxRate, titheGrossBaseAt,
  retirementIncomeAt, incomeAnnualAt,
  bucketOf, rmdAmount, irmaaAnnual, retirementIncomeTax,
} from "./cashflow";

export interface Buckets { pretax: number; roth: number; taxable: number; hsa: number; }
const BUCKET_KEYS: (keyof Buckets)[] = ["taxable", "pretax", "roth", "hsa"]; // withdrawal order
const bTotal = (b: Buckets) => b.pretax + b.roth + b.taxable + b.hsa;
function initBuckets(accounts: RetirementAccount[]): Buckets {
  const b: Buckets = { pretax: 0, roth: 0, taxable: 0, hsa: 0 };
  for (const a of accounts) b[bucketOf(a)] += a.balance ?? 0;
  return b;
}
/** Withdraw `amount` in tax-efficient order (taxable → pre-tax → Roth → HSA).
 *  Mutates `b`; returns the amount drawn from each bucket + any shortfall. */
function sequenceWithdraw(b: Buckets, amount: number): { w: Buckets; shortfall: number } {
  const w: Buckets = { pretax: 0, roth: 0, taxable: 0, hsa: 0 };
  let need = amount;
  for (const k of BUCKET_KEYS) {
    if (need <= 0) break;
    const take = Math.min(b[k], need);
    b[k] -= take; w[k] += take; need -= take;
  }
  return { w, shortfall: Math.max(0, need) };
}

// Fraction of a taxable-account withdrawal treated as taxable gain (no basis yet).
const TAXABLE_GAIN_FRACTION = 0.5;

export interface YearDetail {
  age: number;
  isRetired: boolean;
  buckets: Buckets;
  total: number;
  scenarioSpend: number;
  enteredOutflow: number;
  tithe: number;
  tax: number;
  irmaa: number;
  rmd: number;
  withdrawal: Buckets;
  savedToPortfolio: number;
  netWithdrawal: number;
  shortfall: number;
}

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
  filing: "mfj" | "single";
  state: number;
}

export interface ProjectionResult {
  portfolioByAge: Map<number, number>;
  jobIncomeByAge: Map<number, number>;
  ssIncomeByAge: Map<number, number>;
  pensionIncomeByAge: Map<number, number>;
  expensesByAge: Map<number, number>;
  taxByAge: Map<number, number>;
  irmaaByAge: Map<number, number>;
  rmdByAge: Map<number, number>;
  detailByAge: Map<number, YearDetail>;
  nestEgg: number;
  safeMonthlyWithdrawal: number;
  depletionAge: number | null;
  runway: number | string;
  baseAnnualSpend: number;
  weightedReturn: number;
  finalBalance: number;
}

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
  scenario: RetirementScenario,
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
    filing: profile.spouse_enabled ? "mfj" : "single",
    state: (scenario.state_tax_rate ?? 5) / 100,
  };
}

export function returnForAge(ctx: StepCtx, age: number): number {
  return age >= ctx.profile.retirement_age ? ctx.retirementReturn : ctx.weightedReturn;
}

/** Advance the bucket portfolio one year. Returns the new buckets + a full detail. */
export function stepYear(ctx: StepCtx, start: Buckets, age: number, yearReturn: number, endMult = 1): { buckets: Buckets; detail: YearDetail } {
  const { profile, accounts, incomes } = ctx;
  const isRetired = age >= profile.retirement_age;
  const inflFactor = Math.pow(1 + profile.inflation_rate, age - profile.current_age);
  let b: Buckets = { ...start };

  if (age === profile.retirement_age) b.taxable += ctx.windfall;
  if (age > profile.current_age) for (const k of BUCKET_KEYS) b[k] *= 1 + yearReturn;
  if (endMult !== 1) for (const k of BUCKET_KEYS) b[k] *= endMult;

  const detail: YearDetail = {
    age, isRetired, buckets: b, total: 0, scenarioSpend: 0, enteredOutflow: 0, tithe: 0,
    tax: 0, irmaa: 0, rmd: 0, withdrawal: { pretax: 0, roth: 0, taxable: 0, hsa: 0 },
    savedToPortfolio: 0, netWithdrawal: 0, shortfall: 0,
  };

  if (!isRetired) {
    const taxRate = autoTaxRate(titheGrossBaseAt(incomes, age, profile), age, profile, ctx.scenario);
    const contrib = accounts.reduce((s, a) => s + a.monthly_contribution * 12, 0);
    const match = employerMatchAnnual(accounts, incomes, age, profile);
    b.pretax += contrib + match;
    let bonusStock = 0;
    for (const inc of incomes) {
      if (inc.type !== "bonus" && inc.type !== "stock_award") continue;
      const startAge = inc.start_age ?? profile.current_age;
      const endAge = inc.end_age ?? (inc.type === "stock_award" && inc.vest_years != null ? startAge + inc.vest_years : profile.retirement_age - 1);
      if (age < startAge || age > endAge) continue;
      bonusStock += inc.monthly_amount * streamGrowth(inc, age - startAge) * (1 - taxRate);
    }
    b.taxable += bonusStock;
    detail.savedToPortfolio = contrib + match + bonusStock;
    detail.tax = estimatedTaxAt(ctx, age, ctx.nowMs); // wage tax (paid from paycheck)
    detail.enteredOutflow = outflowAt(ctx, age);
    detail.tithe = titheAndOfferingAt(ctx, age, ctx.nowMs);
    const takeHome = wageIncomeAt(incomes, age, profile) * (1 - taxRate);
    const deficit = detail.enteredOutflow + detail.tithe - takeHome;
    if (deficit > 0) {
      const res = sequenceWithdraw(b, deficit);
      detail.withdrawal = res.w;
      detail.shortfall = res.shortfall;
      detail.netWithdrawal = deficit - res.shortfall;
    }
  } else {
    const scenarioSpend = ctx.baseAnnualSpend * inflFactor;
    const entered = outflowAt(ctx, age);
    const tithe = titheAndOfferingAt(ctx, age, ctx.nowMs);
    const retIncome = retirementIncomeAt(incomes, age, profile);
    let ss = 0;
    for (const inc of incomes) if (inc.type === "social_security") ss += incomeAnnualAt(inc, age, profile);
    const otherOrdinaryInc = Math.max(0, retIncome - ss);

    // RMD forced out of pre-tax (provides cash; excess reinvested after tax).
    const rmd = rmdAmount(b.pretax, age);
    b.pretax -= rmd;

    // Iterate: tax & IRMAA depend on the withdrawal composition, which depends on
    // the total need (which includes tax & IRMAA). Converges in a couple passes.
    let tax = 0, irmaa = 0;
    let w: Buckets = { pretax: 0, roth: 0, taxable: 0, hsa: 0 };
    let shortfall = 0;
    let worked: Buckets = { ...b };
    for (let iter = 0; iter < 3; iter++) {
      const grossOut = scenarioSpend + entered + tithe + tax + irmaa;
      const extraNeed = Math.max(0, grossOut - (retIncome + rmd));
      worked = { ...b };
      const res = sequenceWithdraw(worked, extraNeed);
      w = res.w; shortfall = res.shortfall;
      const pretaxW = rmd + w.pretax;
      const taxableGain = w.taxable * TAXABLE_GAIN_FRACTION;
      const t = retirementIncomeTax(otherOrdinaryInc, ss, pretaxW, taxableGain, ctx.filing, inflFactor, ctx.state);
      tax = t.tax;
      irmaa = irmaaAnnual(t.magi, age, ctx.filing, inflFactor);
    }
    b = worked;
    const totalOut = scenarioSpend + entered + tithe + tax + irmaa;
    const reinvest = Math.max(0, retIncome + rmd - totalOut - (w.taxable + w.pretax + w.roth + w.hsa));
    b.taxable += reinvest;

    detail.scenarioSpend = scenarioSpend;
    detail.enteredOutflow = entered;
    detail.tithe = tithe;
    detail.tax = tax;
    detail.irmaa = irmaa;
    detail.rmd = rmd;
    detail.withdrawal = w;
    detail.shortfall = shortfall;
    detail.netWithdrawal = w.taxable + w.pretax + w.roth + w.hsa;
  }

  detail.buckets = b;
  detail.total = bTotal(b);
  return { buckets: b, detail };
}

/** Full path with a per-year return + optional shock. Returns totals by age. */
export function runProjection(
  ctx: StepCtx,
  returnFor: (age: number) => number,
  opts?: { shockAge?: number | null; shockMult?: number },
): { byAge: Map<number, number>; depletionAge: number | null; final: number } {
  const { profile } = ctx;
  let b = initBuckets(ctx.accounts);
  const byAge = new Map<number, number>();
  let depletionAge: number | null = null;
  for (let age = profile.current_age; age <= profile.life_expectancy; age++) {
    const endMult = opts?.shockAge != null && age === opts.shockAge ? opts.shockMult ?? 1 : 1;
    const r = stepYear(ctx, b, age, returnFor(age), endMult);
    b = r.buckets;
    const total = bTotal(b);
    if (total <= 1 && depletionAge === null && age >= profile.retirement_age) depletionAge = age;
    byAge.set(age, total);
  }
  return { byAge, depletionAge, final: bTotal(b) };
}

const JOB_TYPES = ["salary", "part_time", "other", "bonus", "stock_award"];

export function project(
  profile: RetirementProfile,
  accounts: RetirementAccount[],
  incomes: RetirementIncome[],
  expenses: RetirementExpense[],
  debts: RetirementDebt[],
  scenario: RetirementScenario,
): ProjectionResult {
  const ctx = buildCtx(profile, accounts, incomes, expenses, debts, scenario);
  const { weightedReturn } = ctx;

  let b = initBuckets(accounts);
  const portfolioByAge = new Map<number, number>();
  const jobIncomeByAge = new Map<number, number>();
  const ssIncomeByAge = new Map<number, number>();
  const pensionIncomeByAge = new Map<number, number>();
  const expensesByAge = new Map<number, number>();
  const taxByAge = new Map<number, number>();
  const irmaaByAge = new Map<number, number>();
  const rmdByAge = new Map<number, number>();
  const detailByAge = new Map<number, YearDetail>();
  let nestEgg = 0;
  let depletionAge: number | null = null;

  for (let age = profile.current_age; age <= profile.life_expectancy; age++) {
    const isRetired = age >= profile.retirement_age;
    if (age === profile.retirement_age) nestEgg = bTotal(b) + ctx.windfall;

    const { buckets, detail } = stepYear(ctx, b, age, returnForAge(ctx, age));
    b = buckets;
    const total = bTotal(b);
    if (total <= 1 && depletionAge === null && isRetired) depletionAge = age;

    portfolioByAge.set(age, total);
    detailByAge.set(age, detail);
    taxByAge.set(age, Math.round(detail.tax));
    irmaaByAge.set(age, Math.round(detail.irmaa));
    rmdByAge.set(age, Math.round(detail.rmd));

    let jobIncome = 0, ssIncome = 0, pensionIncome = 0;
    for (const inc of incomes) {
      if (JOB_TYPES.includes(inc.type)) jobIncome += incomeAnnualAt(inc, age, profile);
      else if (inc.type === "social_security") ssIncome += incomeAnnualAt(inc, age, profile);
      else if (inc.type === "pension") pensionIncome += incomeAnnualAt(inc, age, profile);
    }
    jobIncomeByAge.set(age, Math.round(jobIncome));
    ssIncomeByAge.set(age, Math.round(ssIncome));
    pensionIncomeByAge.set(age, Math.round(pensionIncome));

    const outflow = detail.scenarioSpend + detail.enteredOutflow + detail.tithe + detail.tax + detail.irmaa;
    expensesByAge.set(age, Math.round(outflow));
  }

  if (nestEgg === 0) nestEgg = portfolioByAge.get(profile.retirement_age) ?? 0;
  const safeMonthlyWithdrawal = (nestEgg * 0.04) / 12;
  const runway = depletionAge != null ? depletionAge - profile.retirement_age : "lifetime";

  return {
    portfolioByAge, jobIncomeByAge, ssIncomeByAge, pensionIncomeByAge, expensesByAge,
    taxByAge, irmaaByAge, rmdByAge, detailByAge,
    nestEgg, safeMonthlyWithdrawal, depletionAge, runway, baseAnnualSpend: ctx.baseAnnualSpend, weightedReturn,
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
  scenarioKey: "lean" | "balanced" | "abundant",
): { depletionAge: number | null; nestEgg: number } {
  const r = project(profile, accounts, incomes, expenses, debts, { ...scenario, selected_scenario: scenarioKey });
  return { depletionAge: r.depletionAge, nestEgg: r.nestEgg };
}
