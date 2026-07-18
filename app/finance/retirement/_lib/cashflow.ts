// Shared per-year cash-flow math for the retirement planner.
//
// This is the SINGLE SOURCE OF TRUTH for how much each income, expense, and debt
// contributes in a given year. The projection chart (ProjectionTab) and the
// year-by-year cash-flow inspector (Outflows tab) both use these helpers so their
// numbers always agree — the inspector is meant to let you audit the estimate.

import type {
  RetirementProfile,
  RetirementAccount,
  RetirementIncome,
  RetirementExpense,
  RetirementDebt,
  RetirementScenario,
} from "../types";

export const YEAR_MS = 365.25 * 24 * 3600 * 1000;

/** Growth multiplier for a stream with `pct` annual growth over `years`.
 *  Exponent clamped to 10 so a growth % can't balloon over a long career. */
export function clampedGrowth(pct: number | null, years: number): number {
  if (!pct) return 1;
  return Math.pow(1 + pct / 100, Math.min(years, 10));
}

// ── Scenario spend ───────────────────────────────────────────────────────────

export function selectedMonthlySpend(scenario: RetirementScenario): number {
  const sel = scenario.selected_scenario as "lean" | "balanced" | "abundant" | "custom";
  const key = `${sel}_monthly_spend` as keyof RetirementScenario;
  return (scenario[key] as number) ?? 0;
}

/** Base annual retirement spend in today's dollars (before inflation). */
export function baseAnnualSpend(scenario: RetirementScenario): number {
  return selectedMonthlySpend(scenario) * 12 + scenario.annual_travel + scenario.monthly_health_premium * 12;
}

// ── Expenses (date-windowed, growth-aware) ──────────────────────────────────

/** Map an entered outflow's start/stop dates onto the projection's age axis.
 *  start defaults to "now"; end defaults to the last working year so an ongoing
 *  cost hands off to the retirement scenario at retirement (no double-count).
 *  An explicit stop date is honored even into retirement (a mortgage past 65). */
export function expenseAgeWindow(exp: RetirementExpense, profile: RetirementProfile, nowMs: number): [number, number] {
  const start = exp.start_date ? profile.current_age + (Date.parse(exp.start_date) - nowMs) / YEAR_MS : profile.current_age;
  const end = exp.end_date ? profile.current_age + (Date.parse(exp.end_date) - nowMs) / YEAR_MS : (profile.retirement_age - 1);
  return [start, end];
}

/** Annualized amount of an entered expense at a projection age (0 outside window). */
export function expenseAnnualAt(exp: RetirementExpense, age: number, profile: RetirementProfile, nowMs: number): number {
  const [start, end] = expenseAgeWindow(exp, profile, nowMs);
  if (age < Math.floor(start) || age > Math.floor(end)) return 0;
  const growthPct = exp.annual_growth_pct ?? profile.inflation_rate * 100;
  return exp.monthly_amount * 12 * Math.pow(1 + growthPct / 100, Math.max(0, age - start));
}

// ── Debts / leases ──────────────────────────────────────────────────────────

/** Annualized debt/lease payment at a given age (0 once paid off / lease ends). */
export function debtAnnualAt(debt: RetirementDebt, age: number, profile: RetirementProfile): number {
  const yearsFromNow = age - profile.current_age;
  if (yearsFromNow < 0) return 0;
  if (debt.subtype === "lease") {
    const pay = debt.lease_monthly_payment ?? 0;
    const months = debt.lease_months_remaining ?? debt.lease_term_months ?? 0;
    return pay > 0 && yearsFromNow < months / 12 ? pay * 12 : 0;
  }
  const pay = debt.monthly_payment ?? 0;
  if (pay <= 0) return 0;
  const bal = debt.balance ?? 0;
  const rate = (debt.rate_pct ?? 0) / 100 / 12;
  let payoffYears = Infinity; // no balance info → assume it keeps being paid
  if (bal > 0 && rate > 0) {
    const m = -Math.log(1 - (rate * bal) / pay) / Math.log(1 + rate);
    if (isFinite(m) && m > 0) payoffYears = m / 12;
  } else if (bal > 0) {
    payoffYears = Math.ceil(bal / pay) / 12;
  }
  return yearsFromNow < payoffYears ? pay * 12 : 0;
}

// ── Income ──────────────────────────────────────────────────────────────────

/** Recurring wage income (salary/part_time/other) available to cover living costs
 *  during the working years. Bonuses & stock awards are excluded — those are
 *  saved into the portfolio, not spent. Used by the portfolio deficit math. */
export function wageIncomeAt(incomes: RetirementIncome[], age: number, profile: RetirementProfile): number {
  let sum = 0;
  for (const inc of incomes) {
    if (inc.type !== "salary" && inc.type !== "part_time" && inc.type !== "other") continue;
    const start = inc.start_age ?? profile.current_age;
    const end = inc.end_age ?? (profile.retirement_age - 1);
    if (age < start || age > end) continue;
    const annual = inc.frequency === "annual" ? inc.monthly_amount : inc.monthly_amount * 12;
    sum += annual * streamGrowth(inc, age - start);
  }
  return sum;
}

/** Growth factor for an income stream. Bonuses & stock awards are capped at 10
 *  years (a growth % on a large annual grant would otherwise balloon over a long
 *  career); salary and other recurring pay grow UNCAPPED so long careers aren't
 *  understated — this keeps income growth symmetric with expense growth. */
export function streamGrowth(inc: RetirementIncome, years: number): number {
  if (inc.type === "bonus" || inc.type === "stock_award") return clampedGrowth(inc.annual_growth_pct, years);
  return inc.annual_growth_pct ? Math.pow(1 + inc.annual_growth_pct / 100, Math.max(0, years)) : 1;
}

/** Annual amount of a single income stream at a given age (0 outside window).
 *  Mirrors the projection's chart series exactly. */
export function incomeAnnualAt(inc: RetirementIncome, age: number, profile: RetirementProfile): number {
  const isRetired = age >= profile.retirement_age;
  const inflFactor = Math.pow(1 + profile.inflation_rate, age - profile.current_age);

  if (inc.type === "social_security") {
    if (age < (inc.ss_claim_age ?? 67)) return 0;
    return inc.monthly_amount * 12 * inflFactor;
  }
  if (inc.type === "pension") {
    if (age < (inc.start_age ?? profile.retirement_age)) return 0;
    return inc.monthly_amount * 12 * inflFactor;
  }
  if (["salary", "part_time", "other", "bonus", "stock_award"].includes(inc.type)) {
    const start = inc.start_age ?? (
      inc.type === "salary" || inc.type === "bonus" || inc.type === "stock_award"
        ? profile.current_age
        : profile.retirement_age
    );
    const end = inc.end_age ?? (
      inc.type === "stock_award" && inc.vest_years != null
        ? start + inc.vest_years
        : inc.type === "salary" || inc.type === "bonus"
          ? profile.retirement_age - 1
          : 999
    );
    if (age < start || age > end) return 0;
    const growth = streamGrowth(inc, age - start);
    const annual = (inc.frequency === "annual" || inc.type === "stock_award" || inc.type === "bonus")
      ? inc.monthly_amount
      : inc.monthly_amount * 12;
    return annual * growth * (isRetired ? inflFactor : 1);
  }
  return 0;
}

// IRS 401(k) employee elective-deferral limit (~2026). The modeled employer
// match is capped here and the cap grows with inflation across the projection.
// Update as the IRS adjusts the annual limit.
export const IRS_401K_ANNUAL_LIMIT = 24500;

/** Whether an income stream counts toward the 401(k) match base.
 *  Explicit flag wins; unset defaults to salary-only (backward compatible). */
export function isMatchEligible(inc: RetirementIncome): boolean {
  return inc.match_eligible ?? (inc.type === "salary");
}

/** Total 401(k)-eligible compensation this year for a given owner. */
function ownerEligibleCompAt(incomes: RetirementIncome[], owner: string, age: number, profile: RetirementProfile): number {
  let sum = 0;
  for (const inc of incomes) {
    if (!isMatchEligible(inc)) continue;
    if ((inc.owner ?? "self") !== owner) continue;
    sum += incomeAnnualAt(inc, age, profile);
  }
  return sum;
}

/** Employer match — a percentage of the account owner's salary (not of the
 *  employee's contribution), capped at the IRS annual limit (grown with
 *  inflation). Requires an employee contribution. Working years only. */
export function employerMatchAnnual(
  accounts: RetirementAccount[],
  incomes: RetirementIncome[],
  age: number,
  profile: RetirementProfile
): number {
  if (age >= profile.retirement_age) return 0;
  const cap = IRS_401K_ANNUAL_LIMIT * Math.pow(1 + profile.inflation_rate, age - profile.current_age);
  let sum = 0;
  for (const a of accounts) {
    const pct = a.employer_match_pct ?? 0;
    if (pct <= 0 || (a.monthly_contribution ?? 0) <= 0) continue;
    const comp = ownerEligibleCompAt(incomes, a.owner ?? "self", age, profile);
    sum += Math.min(comp * (pct / 100), cap);
  }
  return sum;
}

/** Employee retirement-account contributions during the working years. */
export function contributionsAnnual(accounts: RetirementAccount[], age: number, profile: RetirementProfile): number {
  if (age >= profile.retirement_age) return 0;
  return accounts.reduce((s, a) => s + a.monthly_contribution * 12, 0);
}

// ── Tithe & offerings ───────────────────────────────────────────────────────

// Assumed top marginal tax rate (federal + state) the net-tithe effective rate
// climbs toward as income rises above today's level (manual mode).
const TITHE_MARGINAL_TAX = 0.40;

// Federal ordinary-income brackets (2025 base; inflated forward in the model).
// Each entry is [lower bound in today's dollars, marginal rate].
const FED_BRACKETS: Record<"mfj" | "single", [number, number][]> = {
  mfj: [[0, 0.10], [23850, 0.12], [96950, 0.22], [206700, 0.24], [394600, 0.32], [501050, 0.35], [751600, 0.37]],
  single: [[0, 0.10], [11925, 0.12], [48475, 0.22], [103350, 0.24], [197300, 0.32], [250525, 0.35], [626350, 0.37]],
};
const STD_DEDUCTION: Record<"mfj" | "single", number> = { mfj: 30000, single: 15000 };

/** Federal income tax on gross income for a filing status, brackets & standard
 *  deduction inflated by `inflFactor` to the projection year. */
function federalTax(income: number, filing: "mfj" | "single", inflFactor: number): number {
  const ded = STD_DEDUCTION[filing] * inflFactor;
  const taxable = Math.max(0, income - ded);
  const brackets = FED_BRACKETS[filing];
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const lo = brackets[i][0] * inflFactor;
    const hi = i + 1 < brackets.length ? brackets[i + 1][0] * inflFactor : Infinity;
    if (taxable > lo) tax += (Math.min(taxable, hi) - lo) * brackets[i][1];
  }
  return tax;
}

/** Automatic effective tax rate for a year: federal (brackets + standard
 *  deduction, by filing status) plus a flat state/local rate. */
export function autoTaxRate(income: number, age: number, profile: RetirementProfile, scenario: RetirementScenario): number {
  if (income <= 0) return 0;
  const inflFactor = Math.pow(1 + profile.inflation_rate, age - profile.current_age);
  const filing: "mfj" | "single" = profile.spouse_enabled ? "mfj" : "single";
  const fed = federalTax(income, filing, inflFactor);
  const state = (scenario.state_tax_rate ?? 5) / 100;
  return Math.min(0.6, fed / income + state);
}

/** Gross income the tithe is calculated on for a year (all wage-type income). */
export function titheGrossBaseAt(incomes: RetirementIncome[], age: number, profile: RetirementProfile): number {
  let sum = 0;
  for (const inc of incomes) {
    if (["salary", "bonus", "part_time", "other"].includes(inc.type)) sum += incomeAnnualAt(inc, age, profile);
  }
  return sum;
}

/** Retirement income that offsets the portfolio drawdown (everything except
 *  salary & bonus, which don't fund retirement in the model). */
export function retirementIncomeAt(incomes: RetirementIncome[], age: number, profile: RetirementProfile): number {
  let sum = 0;
  for (const inc of incomes) {
    if (inc.type === "salary" || inc.type === "bonus") continue;
    sum += incomeAnnualAt(inc, age, profile);
  }
  return sum;
}

// ── RMDs · IRMAA · bucket-aware retirement tax (for the stateful engine) ──────

export const RMD_AGE = 73;
// IRS Uniform Lifetime Table divisors, age 73+.
const RMD_DIVISORS: Record<number, number> = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
  83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
  93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2,
  104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1,
  114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3,
};
/** Required minimum distribution from a pre-tax balance at a given age (0 if none). */
export function rmdAmount(pretaxBalance: number, age: number): number {
  if (age < RMD_AGE || pretaxBalance <= 0) return 0;
  const divisor = RMD_DIVISORS[age] ?? 2.0;
  return pretaxBalance / divisor;
}

// IRMAA Part B + D income-related surcharge — per person, annual (2025 ≈), by MAGI
// tier. Thresholds inflate with the plan. Applies from age 65.
const IRMAA_THRESHOLDS: Record<"mfj" | "single", number[]> = {
  mfj: [212000, 266000, 334000, 400000, 750000],
  single: [106000, 133000, 167000, 200000, 500000],
};
const IRMAA_PER_PERSON = [0, 1052, 2644, 4234, 5824, 6357];
/** Annual Medicare IRMAA surcharge for the household (age 65+). */
export function irmaaAnnual(magi: number, age: number, filing: "mfj" | "single", inflFactor: number): number {
  if (age < 65) return 0;
  const thr = IRMAA_THRESHOLDS[filing];
  let tier = 0;
  for (let i = 0; i < thr.length; i++) if (magi > thr[i] * inflFactor) tier = i + 1;
  const people = filing === "mfj" ? 2 : 1;
  return IRMAA_PER_PERSON[tier] * inflFactor * people;
}

/** Income tax on a retirement year given its withdrawal composition. Pre-tax
 *  withdrawals are ordinary, taxable-account gains are LTCG + NIIT, Roth/HSA are
 *  tax-free, and only ≤85% of Social Security is taxable. Returns tax + MAGI. */
export function retirementIncomeTax(
  otherOrdinaryIncome: number, ss: number, pretaxWithdrawn: number, taxableGain: number,
  filing: "mfj" | "single", inflFactor: number, state: number,
): { tax: number; magi: number } {
  const taxableSS = ssTaxablePortion(ss, otherOrdinaryIncome + pretaxWithdrawn, filing, inflFactor);
  const ordinary = otherOrdinaryIncome + taxableSS + pretaxWithdrawn;
  const fed = federalTax(ordinary, filing, inflFactor);
  const capGains = taxableGain * ltcgRate(ordinary, filing, inflFactor);
  const niitThreshold = (filing === "mfj" ? 250000 : 200000) * inflFactor;
  const niit = ordinary + taxableGain > niitThreshold ? 0.038 * taxableGain : 0;
  const stateTax = state * (ordinary + taxableGain);
  return { tax: fed + capGains + niit + stateTax, magi: ordinary + taxableGain };
}

/** Annual tithe + assumed offering for a year, if enabled.
 *  Working years: a percent of income received (gross = full pay; net excludes
 *  401k contributions). Retirement: a percent of everything that comes in —
 *  income plus the portfolio withdrawal that funds spending. Plus a flat,
 *  inflation-grown offering. */
export function titheAndOfferingAt(inp: CashflowInputs, age: number, nowMs: number): number {
  const { profile, incomes, expenses, debts, scenario } = inp;
  if (!scenario.tithe_enabled) return 0;
  const pct = (scenario.tithe_pct ?? 10) / 100;
  const isRetired = age >= profile.retirement_age;
  const inflFactor = Math.pow(1 + profile.inflation_rate, age - profile.current_age);
  const offering = (scenario.offering_monthly ?? 0) * 12 * inflFactor;

  let base: number;
  if (!isRetired) {
    base = 0;
    for (const inc of incomes) {
      if (["salary", "bonus", "part_time", "other"].includes(inc.type)) base += incomeAnnualAt(inc, age, profile);
    }
    base = Math.max(0, base);
  } else {
    // Everything that comes in = retirement income + the withdrawal for spending.
    // Use pre-tithe spending as the base to avoid tithing the tithe (circularity).
    const retIncome = retirementIncomeAt(incomes, age, profile);
    let entered = 0;
    for (const e of expenses) entered += expenseAnnualAt(e, age, profile, nowMs);
    for (const d of debts) entered += debtAnnualAt(d, age, profile);
    const spend = baseAnnualSpend(scenario) * inflFactor + entered;
    base = Math.max(retIncome, spend);
  }
  // Net basis tithes after-tax (take-home) income.
  if (scenario.tithe_basis === "net") {
    let rate: number;
    if (scenario.tithe_tax_auto) {
      // Automatic: federal brackets by filing status + standard deduction, plus state.
      rate = autoTaxRate(base, age, profile, scenario);
    } else {
      // Manual: the entered rate is today's effective rate; taxes are progressive, so
      // as income climbs above today's level the effective rate rises toward the
      // marginal rate — the tax grows with the salary.
      const anchorRate = Math.min(0.95, (scenario.tithe_tax_rate ?? 25) / 100);
      const anchorIncome = titheGrossBaseAt(incomes, profile.current_age, profile);
      rate = anchorRate;
      if (anchorIncome > 0 && base > 0 && anchorRate < TITHE_MARGINAL_TAX) {
        const threshold = anchorIncome * (1 - anchorRate / TITHE_MARGINAL_TAX);
        rate = Math.min(TITHE_MARGINAL_TAX, (TITHE_MARGINAL_TAX * Math.max(0, base - threshold)) / base);
      }
    }
    base *= 1 - rate;
  }
  return base * pct + offering;
}

/** Estimated income tax (federal brackets + state) for a year, on that year's
 *  gross income — working wages, or retirement income + the withdrawal that funds
 *  spending. Independent of the tithe settings; informational. */
// ── Account tax buckets ─────────────────────────────────────────────────────
// Derived from the account's type (no schema needed): pre-tax (401k/IRA/pension)
// is taxed as ordinary on withdrawal, Roth/HSA are tax-free, taxable/brokerage is
// taxed at long-term capital-gains rates on the gain portion.
export type TaxBucket = "pretax" | "roth" | "taxable" | "hsa";
export function bucketOf(a: RetirementAccount): TaxBucket {
  const t = (a.type || "").toLowerCase();
  if (t.includes("roth")) return "roth";
  if (t.includes("hsa")) return "hsa";
  if (t.includes("brokerage") || t.includes("saving") || t.includes("checking") || t.includes("taxable") || t === "other") return "taxable";
  return "pretax"; // 401k, 403b, traditional ira, pension
}

/** Share of the portfolio in each tax bucket, by balance. */
export function accountTaxMix(accounts: RetirementAccount[]): Record<TaxBucket, number> {
  const bal: Record<TaxBucket, number> = { pretax: 0, roth: 0, taxable: 0, hsa: 0 };
  let total = 0;
  for (const a of accounts) { const v = a.balance ?? 0; bal[bucketOf(a)] += v; total += v; }
  if (total <= 0) return { pretax: 1, roth: 0, taxable: 0, hsa: 0 };
  return { pretax: bal.pretax / total, roth: bal.roth / total, taxable: bal.taxable / total, hsa: bal.hsa / total };
}

// Fraction of a taxable-account withdrawal that is taxable gain (no cost-basis
// tracking yet — a mid estimate for a long-held appreciated account).
const TAXABLE_GAIN_FRACTION = 0.5;

/** Long-term capital-gains rate by ordinary-income level (2025 brackets, inflated). */
function ltcgRate(ordinary: number, filing: "mfj" | "single", inflFactor: number): number {
  const top = (filing === "mfj" ? 600050 : 533400) * inflFactor;
  const bottom = (filing === "mfj" ? 96700 : 48350) * inflFactor;
  if (ordinary >= top) return 0.20;
  if (ordinary >= bottom) return 0.15;
  return 0;
}

/** Portion of Social Security benefits that is taxable (≤85%), via the IRS
 *  provisional-income formula. Thresholds inflate with the plan. */
function ssTaxablePortion(ss: number, otherIncome: number, filing: "mfj" | "single", inflFactor: number): number {
  if (ss <= 0) return 0;
  const [t1, t2] = filing === "mfj" ? [32000, 44000] : [25000, 34000];
  const b1 = t1 * inflFactor, b2 = t2 * inflFactor;
  const provisional = otherIncome + 0.5 * ss;
  if (provisional <= b1) return 0;
  if (provisional <= b2) return Math.min(0.5 * (provisional - b1), 0.5 * ss);
  const lowerTier = Math.min(0.5 * (b2 - b1), 0.5 * ss);
  return Math.min(0.85 * (provisional - b2) + lowerTier, 0.85 * ss);
}

/** Additional Medicare tax (0.9%) on wages above the MAGI threshold. */
function additionalMedicareTax(wages: number, filing: "mfj" | "single", inflFactor: number): number {
  const thr = (filing === "mfj" ? 250000 : 200000) * inflFactor;
  return Math.max(0, wages - thr) * 0.009;
}

/** Estimated income tax (federal + state) for the year. Working years tax wages
 *  (plus the additional-Medicare surtax on high earners); retirement taxes
 *  ordinary income + only the taxable portion of Social Security. */
export function estimatedTaxAt(inp: CashflowInputs, age: number, nowMs: number): number {
  const { profile, accounts, incomes, expenses, debts, scenario } = inp;
  const isRetired = age >= profile.retirement_age;
  const inflFactor = Math.pow(1 + profile.inflation_rate, age - profile.current_age);
  const filing: "mfj" | "single" = profile.spouse_enabled ? "mfj" : "single";
  const state = (scenario.state_tax_rate ?? 5) / 100;

  if (!isRetired) {
    const wages = titheGrossBaseAt(incomes, age, profile);
    if (wages <= 0) return 0;
    const tax = federalTax(wages, filing, inflFactor) + additionalMedicareTax(wages, filing, inflFactor) + state * wages;
    return Math.min(0.6 * wages, tax);
  }

  // Retirement income (SS only partially taxable) + a portfolio withdrawal taxed
  // by the account mix: pre-tax → ordinary, Roth/HSA → tax-free, taxable → LTCG.
  const retIncome = retirementIncomeAt(incomes, age, profile);
  let entered = 0;
  for (const e of expenses) entered += expenseAnnualAt(e, age, profile, nowMs);
  for (const d of debts) entered += debtAnnualAt(d, age, profile);
  const spend = baseAnnualSpend(scenario) * inflFactor + entered;
  const withdrawal = Math.max(0, spend - retIncome);

  let ss = 0;
  for (const inc of incomes) if (inc.type === "social_security") ss += incomeAnnualAt(inc, age, profile);
  const otherOrdinaryIncome = Math.max(0, retIncome - ss); // pension / part-time / other

  const mix = accountTaxMix(accounts);
  const pretaxW = withdrawal * mix.pretax;                    // ordinary
  const ltcgIncome = withdrawal * mix.taxable * TAXABLE_GAIN_FRACTION; // capital gains
  // Roth + HSA withdrawals are tax-free.

  const taxableSS = ssTaxablePortion(ss, otherOrdinaryIncome + pretaxW, filing, inflFactor);
  const ordinary = otherOrdinaryIncome + taxableSS + pretaxW;

  const fed = federalTax(ordinary, filing, inflFactor);
  const capGains = ltcgIncome * ltcgRate(ordinary, filing, inflFactor);
  // Net investment income tax (3.8%) on capital gains once MAGI clears the threshold.
  const niitThreshold = (filing === "mfj" ? 250000 : 200000) * inflFactor;
  const niit = ordinary + ltcgIncome > niitThreshold ? 0.038 * ltcgIncome : 0;
  const stateTax = state * (ordinary + ltcgIncome);

  const tax = fed + capGains + niit + stateTax;
  return Math.min(0.6 * (retIncome + withdrawal), tax);
}

// ── Itemized year cash flow (for the inspector) ─────────────────────────────

export interface CashflowItem {
  label: string;
  amount: number;
  kind: string;
}

export interface YearCashflow {
  age: number;
  year: number;
  isRetired: boolean;
  inflows: CashflowItem[];
  outflows: CashflowItem[];
  totalInflow: number;
  totalOutflow: number;
  net: number;
  savedToPortfolio: number; // contributions + match + bonus/stock that the projection banks
  scenarioSpend: number;    // retirement lifestyle spend this year (0 pre-retirement)
  estimatedTax: number;     // estimated income tax (federal + state) on this year's income
  irmaa: number;            // Medicare IRMAA surcharge (retirement, age 65+)
  rmd: number;              // required minimum distribution forced from pre-tax
}

const INCOME_LABEL: Record<string, string> = {
  salary: "Salary",
  bonus: "Bonus",
  stock_award: "Stock / equity",
  part_time: "Part-time / bridge",
  other: "Other income",
  social_security: "Social Security",
  pension: "Pension",
};

export interface CashflowInputs {
  profile: RetirementProfile;
  accounts: RetirementAccount[];
  incomes: RetirementIncome[];
  expenses: RetirementExpense[];
  debts: RetirementDebt[];
  scenario: RetirementScenario;
}

/** Full itemized inflows + outflows for one projection age. currentYear anchors
 *  the age axis to calendar years for display. */
export function yearCashflow(
  inp: CashflowInputs, age: number, nowMs: number, currentYear: number,
  override?: { tax?: number; irmaa?: number; rmd?: number },
): YearCashflow {
  const { profile, accounts, incomes, expenses, debts, scenario } = inp;
  const isRetired = age >= profile.retirement_age;
  const inflFactor = Math.pow(1 + profile.inflation_rate, age - profile.current_age);

  const inflows: CashflowItem[] = [];
  for (const inc of incomes) {
    // Salary & bonus don't fund retirement in the portfolio model — exclude them
    // once retired so the ledger's net equals the actual portfolio drawdown.
    if (isRetired && (inc.type === "salary" || inc.type === "bonus")) continue;
    const amt = incomeAnnualAt(inc, age, profile);
    if (amt > 0.5) inflows.push({ label: inc.name || INCOME_LABEL[inc.type] || inc.type, amount: amt, kind: inc.type });
  }
  const match = employerMatchAnnual(accounts, incomes, age, profile);
  if (match > 0.5) inflows.push({ label: "Employer 401(k) match", amount: match, kind: "match" });

  const outflows: CashflowItem[] = [];
  for (const e of expenses) {
    const amt = expenseAnnualAt(e, age, profile, nowMs);
    if (amt > 0.5) outflows.push({ label: e.name || "Expense", amount: amt, kind: "expense" });
  }
  for (const d of debts) {
    const amt = debtAnnualAt(d, age, profile);
    if (amt > 0.5) outflows.push({ label: d.name || (d.subtype === "lease" ? "Lease" : "Loan"), amount: amt, kind: d.subtype === "lease" ? "lease" : "loan" });
  }
  const scenarioSpend = isRetired ? baseAnnualSpend(scenario) * inflFactor : 0;
  if (scenarioSpend > 0.5) {
    outflows.push({ label: `Retirement lifestyle · ${scenario.selected_scenario}`, amount: scenarioSpend, kind: "scenario" });
  }
  const tithe = titheAndOfferingAt(inp, age, nowMs);
  if (tithe > 0.5) {
    outflows.push({ label: "Tithe & offerings", amount: tithe, kind: "tithe" });
  }
  // Tax comes from the stateful engine when supplied (bucket-correct: pre-tax
  // ordinary, Roth/HSA tax-free, taxable at LTCG, plus RMDs); otherwise estimate.
  const estimatedTax = override?.tax ?? estimatedTaxAt(inp, age, nowMs);
  if (estimatedTax > 0.5) {
    outflows.push({ label: "Income taxes (est.)", amount: estimatedTax, kind: "tax" });
  }
  if ((override?.irmaa ?? 0) > 0.5) {
    outflows.push({ label: "Medicare surcharge (IRMAA)", amount: override!.irmaa!, kind: "tax" });
  }

  const totalInflow = inflows.reduce((s, i) => s + i.amount, 0);
  const totalOutflow = outflows.reduce((s, i) => s + i.amount, 0);

  // What the projection actually banks into the portfolio during the working years:
  // contributions + employer match + bonuses/stock awards.
  let savedToPortfolio = 0;
  if (!isRetired) {
    // 401k contributions & match are pre-tax; bonuses/stock are banked after-tax.
    const taxRate = autoTaxRate(titheGrossBaseAt(incomes, age, profile), age, profile, scenario);
    savedToPortfolio = contributionsAnnual(accounts, age, profile) + match;
    for (const inc of incomes) {
      if (inc.type === "bonus" || inc.type === "stock_award") savedToPortfolio += incomeAnnualAt(inc, age, profile) * (1 - taxRate);
    }
  }

  return {
    age,
    year: currentYear + (age - profile.current_age),
    isRetired,
    inflows,
    outflows,
    totalInflow,
    totalOutflow,
    net: totalInflow - totalOutflow,
    savedToPortfolio,
    scenarioSpend,
    estimatedTax,
    irmaa: override?.irmaa ?? 0,
    rmd: override?.rmd ?? 0,
  };
}
