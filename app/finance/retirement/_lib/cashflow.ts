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

/** Lifestyle retirement spend in today's dollars, EXCLUDING healthcare (which is
 *  age-banded and inflated separately via healthcareCostAt). */
export function baseAnnualSpend(scenario: RetirementScenario): number {
  return selectedMonthlySpend(scenario) * 12 + scenario.annual_travel;
}

/** Age-banded annual healthcare cost at a given age (retirement): the pre-65
 *  (ACA/COBRA) premium until Medicare at 65, then the Medicare-era premium — each
 *  grown at a healthcare-specific inflation rate — plus an optional late-life
 *  long-term-care cost. IRMAA surcharges are added by the engine on top. */
export function healthcareCostAt(scenario: RetirementScenario, age: number, profile: RetirementProfile): number {
  const base = scenario.monthly_health_premium ?? 0;
  const pre65 = scenario.health_premium_pre65 ?? base;
  const medicare = scenario.health_premium_medicare ?? base;
  const monthly = age < 65 ? pre65 : medicare;
  const hcInflPct = scenario.healthcare_inflation ?? profile.inflation_rate * 100;
  const hcFactor = Math.pow(1 + hcInflPct / 100, age - profile.current_age);
  let cost = monthly * 12 * hcFactor;

  if (scenario.ltc_enabled && (scenario.ltc_monthly_cost ?? 0) > 0) {
    const years = scenario.ltc_years ?? 3;
    const startAge = scenario.ltc_start_age ?? Math.max(profile.retirement_age, profile.life_expectancy - years);
    if (age >= startAge && age < startAge + years) {
      const infl = Math.pow(1 + profile.inflation_rate, age - profile.current_age);
      cost += (scenario.ltc_monthly_cost ?? 0) * 12 * infl;
    }
  }
  return cost;
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
    let annual = pay > 0 && yearsFromNow < months / 12 ? pay * 12 : 0;
    // The lease-end decision is a real cash event in the year the lease ends:
    // the residual if the car is bought, the disposition fee if it goes back.
    // The plan held both figures and paid neither.
    if (months > 0 && yearsFromNow === Math.floor(months / 12)) {
      if (debt.lease_end_decision === "buy") annual += debt.lease_residual ?? 0;
      else if (debt.lease_end_decision === "return") annual += debt.lease_disposition_fee ?? 0;
    }
    return annual;
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

/** Balance still owed on an amortising loan after `years` of payments. */
export function mortgageBalanceAt(debt: RetirementDebt, years: number): number {
  const bal = debt.balance ?? 0;
  const pay = debt.monthly_payment ?? 0;
  const r = (debt.rate_pct ?? 0) / 100 / 12;
  const n = Math.max(0, years) * 12;
  if (bal <= 0 || pay <= 0) return Math.max(0, bal);
  if (r <= 0) return Math.max(0, bal - pay * n);
  const g = Math.pow(1 + r, n);
  return Math.max(0, bal * g - pay * (g - 1) / r);
}

// ── Income ──────────────────────────────────────────────────────────────────

/** Recurring wage income (salary/part_time/other) available to cover living costs
 *  during the working years. Bonuses & stock awards are excluded — those are
 *  saved into the portfolio, not spent. Used by the portfolio deficit math. */
export function wageIncomeAt(incomes: RetirementIncome[], age: number, profile: RetirementProfile): number {
  // Delegates to incomeAnnualAt so the deficit math, the chart, the tithe base
  // and the tax all see the same window for a stream with blank dates.
  let sum = 0;
  for (const inc of incomes) {
    if (inc.type !== "salary" && inc.type !== "part_time" && inc.type !== "other") continue;
    sum += incomeAnnualAt(inc, age, profile);
  }
  return sum;
}

/** All W-2 style pay this year: wages, bonus and vesting stock. */
export function grossPayAt(incomes: RetirementIncome[], age: number, profile: RetirementProfile): number {
  let sum = 0;
  for (const inc of incomes) {
    if (["salary", "part_time", "other", "bonus", "stock_award"].includes(inc.type)) sum += incomeAnnualAt(inc, age, profile);
  }
  return sum;
}

/** Employee pay deferred before tax this year: contributions to pre-tax and
 *  HSA accounts. Roth and brokerage contributions come out of taxed pay. */
export function pretaxDeferralsAt(accounts: RetirementAccount[], age: number, profile: RetirementProfile): number {
  if (age >= profile.retirement_age) return 0;
  let sum = 0;
  for (const a of accounts) {
    const b = bucketOf(a);
    if (b === "pretax" || b === "hsa") sum += (a.monthly_contribution ?? 0) * 12;
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

/** Full retirement age for anyone born 1960 or later. */
export const SS_FRA_AGE = 67;

/** The year the trust fund is projected to be unable to pay full benefits,
 *  used when a reduction is set without a year. The 2025 Trustees Report put
 *  retirement-benefit depletion at 2033 with about 77% payable. */
export const SS_DEFAULT_CUT_YEAR = 2033;

/**
 * Share of the scheduled Social Security benefit actually paid at `age`.
 *
 * The plan's largest unstated optimism was that every scheduled benefit is
 * paid in full for life. Once the trust fund is exhausted, current law pays
 * only what payroll tax brings in — roughly three-quarters of what is
 * scheduled — unless Congress acts. This lets a plan assume that, or any other
 * reduction, from a chosen year. Null or zero means benefits are paid in full.
 */
export function ssPayableFraction(age: number, profile: RetirementProfile): number {
  const cut = profile.ss_cut_pct ?? 0;
  if (cut <= 0) return 1;
  const year = new Date().getFullYear() + (age - profile.current_age);
  if (year < (profile.ss_cut_year ?? SS_DEFAULT_CUT_YEAR)) return 1;
  return Math.max(0, 1 - Math.min(cut, 100) / 100);
}

/**
 * Monthly benefit as a fraction of the full-retirement-age benefit, by claim age.
 *
 * Early: 5/9 of 1% per month for the first 36 months, then 5/12 of 1% per month.
 * Late: 8% per year of delayed retirement credits, which stop accruing at 70.
 * Claiming at 62 pays 70% of the FRA benefit; claiming at 70 pays 124%.
 *
 * This lives here, not in the optimiser component, because the projection engine
 * is what needs it — the two must never be able to disagree again.
 */
export function ssBenefitFactor(claimAge: number, fraAge: number = SS_FRA_AGE): number {
  if (claimAge >= fraAge) return 1 + Math.min(claimAge - fraAge, 70 - fraAge) * 0.08;
  const monthsEarly = (fraAge - claimAge) * 12;
  const first36 = Math.min(monthsEarly, 36) * (5 / 9 / 100);
  const beyond36 = Math.max(monthsEarly - 36, 0) * (5 / 12 / 100);
  return Math.max(0, 1 - first36 - beyond36);
}

/**
 * The age of a stream's owner when the plan owner is `age`. A spouse's Social
 * Security claim age, pension start and salary end are the spouse's ages; the
 * projection runs on the owner's age axis, so every spouse stream has to be
 * shifted by the age gap or a younger spouse's benefits start years early.
 */
export function ownerAgeAt(inc: Pick<RetirementIncome, "owner">, age: number, profile: RetirementProfile): number {
  if (inc.owner === "spouse" && profile.spouse_enabled && profile.spouse_age != null) {
    return age - (profile.current_age - profile.spouse_age);
  }
  return age;
}

/** Annual amount of a single income stream at a given age (0 outside window).
 *  Mirrors the projection's chart series exactly. */
export function incomeAnnualAt(inc: RetirementIncome, ownerAge: number, profile: RetirementProfile): number {
  // `ownerAge` is the plan owner's age; windows below compare the stream
  // owner's own age against it (identical unless the stream is the spouse's).
  const age = ownerAgeAt(inc, ownerAge, profile);
  if (inc.type === "social_security") {
    const claim = inc.ss_claim_age ?? SS_FRA_AGE;
    if (age < claim) return 0;
    // The benefit entered is the one at full retirement age — that is the figure
    // an SSA statement leads with. Claiming earlier or later changes it
    // permanently, so the factor is applied here rather than left to the
    // optimiser screen (which computed it correctly and was never wired in).
    //
    // Growth is the Social Security COLA, not general inflation, when the plan
    // sets one apart. It applies from today, not from the claim date: the
    // statement figure is in today's dollars, and benefits are wage-indexed
    // until claiming (historically a little above inflation), so growing at a
    // COLA over that stretch is already the conservative reading.
    const cola = profile.ss_cola_rate ?? profile.inflation_rate;
    const colaFactor = Math.pow(1 + cola, ownerAge - profile.current_age);
    return inc.monthly_amount * ssBenefitFactor(claim) * 12 * colaFactor * ssPayableFraction(ownerAge, profile);
  }
  if (inc.type === "pension") {
    const start = inc.start_age ?? (inc.owner === "spouse" ? profile.spouse_retirement_age ?? profile.retirement_age : profile.retirement_age);
    if (age < start) return 0;
    // Pensions are FLAT nominal by default — most private pensions have no COLA,
    // so the benefit erodes in real terms. If the user sets an annual growth %,
    // treat it as the pension's COLA. (Social Security, above, keeps its COLA.)
    const cola = inc.annual_growth_pct ? Math.pow(1 + inc.annual_growth_pct / 100, age - start) : 1;
    return inc.monthly_amount * 12 * cola;
  }
  if (["salary", "part_time", "other", "bonus", "stock_award"].includes(inc.type)) {
    const spouse = inc.owner === "spouse" && profile.spouse_enabled && profile.spouse_age != null;
    const nowAge = spouse ? (profile.spouse_age as number) : profile.current_age;
    const retireAge = spouse ? (profile.spouse_retirement_age ?? profile.retirement_age) : profile.retirement_age;
    const start = inc.start_age ?? (
      inc.type === "salary" || inc.type === "bonus" || inc.type === "stock_award"
        ? nowAge
        : retireAge
    );
    // A grant that vests over N years pays in N years: start … start+N−1.
    const end = inc.end_age ?? (
      inc.type === "stock_award" && inc.vest_years != null
        ? start + inc.vest_years - 1
        : inc.type === "salary" || inc.type === "bonus"
          ? retireAge - 1
          : 999
    );
    if (age < start || age > end) return 0;
    const annual = (inc.frequency === "annual" || inc.type === "stock_award" || inc.type === "bonus")
      ? inc.monthly_amount
      : inc.monthly_amount * 12;
    // Wage / bridge income uses its OWN growth rate only — never the inflation
    // factor (applying both double-inflated it, spiking the retirement-year value).
    return annual * streamGrowth(inc, age - start);
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

export type Filing = "mfj" | "single";

/**
 * Federal tables by tax year. Brackets are [lower bound, marginal rate].
 * 2025 reflects the July 2025 law (P.L. 119-21): the standard deduction rose
 * to $31,500 / $15,750 and the SALT cap to $40,000. 2026 is from Rev. Proc.
 * 2025-32. Add a year here when the IRS publishes it; the model inflates the
 * latest year it has for every year after that.
 */
export interface TaxTables {
  brackets: Record<Filing, [number, number][]>;
  stdDeduction: Record<Filing, number>;
  /** Additional standard deduction per person aged 65+. */
  stdDeduction65: Record<Filing, number>;
  /** Taxable-income tops of the 0% and 15% long-term capital-gains brackets. */
  ltcg: Record<Filing, [number, number]>;
  saltCap: number;
}
export const TAX_TABLES: Record<number, TaxTables> = {
  2025: {
    brackets: {
      mfj: [[0, 0.10], [23850, 0.12], [96950, 0.22], [206700, 0.24], [394600, 0.32], [501050, 0.35], [751600, 0.37]],
      single: [[0, 0.10], [11925, 0.12], [48475, 0.22], [103350, 0.24], [197300, 0.32], [250525, 0.35], [626350, 0.37]],
    },
    stdDeduction: { mfj: 31500, single: 15750 },
    stdDeduction65: { mfj: 1600, single: 2000 },
    ltcg: { mfj: [96700, 600050], single: [48350, 533400] },
    saltCap: 40000,
  },
  2026: {
    brackets: {
      mfj: [[0, 0.10], [24800, 0.12], [100800, 0.22], [211400, 0.24], [403550, 0.32], [512450, 0.35], [768700, 0.37]],
      single: [[0, 0.10], [12400, 0.12], [50400, 0.22], [105700, 0.24], [201775, 0.32], [256225, 0.35], [640600, 0.37]],
    },
    stdDeduction: { mfj: 32200, single: 16100 },
    stdDeduction65: { mfj: 1650, single: 2050 },
    ltcg: { mfj: [98900, 613700], single: [49450, 545500] },
    saltCap: 40400,
  },
};
/** The tables for a year: the latest year published at or before it. */
export function taxTables(year: number): TaxTables {
  const years = Object.keys(TAX_TABLES).map(Number).sort((a, b) => a - b);
  let pick = years[0];
  for (const y of years) if (y <= year) pick = y;
  return TAX_TABLES[pick];
}
/** The year the planner's "today's dollars" tables are from. */
export const TAX_TABLE_YEAR = (() => {
  const years = Object.keys(TAX_TABLES).map(Number);
  const now = new Date().getFullYear();
  return Math.max(...years.filter((y) => y <= now), Math.min(...years));
})();
const CURRENT = taxTables(TAX_TABLE_YEAR);
export const FED_BRACKETS: Record<Filing, [number, number][]> = CURRENT.brackets;
export const STD_DEDUCTION: Record<Filing, number> = CURRENT.stdDeduction;

/** Extra standard deduction for people 65 and over (each spouse counts). */
export function seniorDeductionAt(age: number, profile: RetirementProfile, filing: Filing, inflFactor: number): number {
  let people = age >= 65 ? 1 : 0;
  if (filing === "mfj" && profile.spouse_enabled && profile.spouse_age != null) {
    if (age - (profile.current_age - profile.spouse_age) >= 65) people++;
  }
  return people * CURRENT.stdDeduction65[filing] * inflFactor;
}

/**
 * Federal tax on long-term gains, stacked on top of ordinary taxable income.
 * The 0% bracket covers gains only up to its top less the ordinary income
 * already sitting in it; the rest is taxed at 15% and then 20%. A single rate
 * chosen from ordinary income alone taxed a $300,000 gain on top of $50,000 of
 * pension at 0%, which the law does not do.
 */
export function capitalGainsTax(taxableOrdinary: number, gain: number, filing: Filing, inflFactor: number): { tax: number; rate: number } {
  if (gain <= 0) return { tax: 0, rate: 0 };
  const [top0, top15] = CURRENT.ltcg[filing].map((v) => v * inflFactor);
  const ord = Math.max(0, taxableOrdinary);
  const at0 = Math.max(0, Math.min(gain, top0 - ord));
  const at15 = Math.max(0, Math.min(gain - at0, top15 - Math.max(ord, top0)));
  const at20 = Math.max(0, gain - at0 - at15);
  const tax = at15 * 0.15 + at20 * 0.20;
  return { tax, rate: tax / gain };
}

/** Net investment income tax: 3.8% on the lesser of investment income and the
 *  excess of MAGI over a threshold that Congress never indexed. */
export function niitTax(investmentIncome: number, magi: number, filing: Filing): number {
  const thr = filing === "mfj" ? 250000 : 200000;
  return 0.038 * Math.max(0, Math.min(investmentIncome, magi - thr));
}

/**
 * Gross income at which the given marginal rate stops applying — i.e. the most
 * you can take as ordinary income and still be taxed no higher than `rate`.
 *
 * Used to fill a Roth conversion to the top of a bracket instead of converting
 * a fixed dollar amount. A fixed amount either wastes cheap bracket space in
 * lean years or spills into a higher rate in fat ones; the whole point of
 * converting in the low-income window is to use exactly the room available.
 */
export function bracketCeiling(rate: number, filing: Filing, inflFactor: number): number | null {
  const brackets = FED_BRACKETS[filing];
  const idx = brackets.findIndex((b) => Math.abs(b[1] - rate) < 1e-9);
  if (idx < 0 || idx + 1 >= brackets.length) return null; // top bracket has no ceiling
  return brackets[idx + 1][0] * inflFactor + STD_DEDUCTION[filing] * inflFactor;
}

/** Federal income tax on gross income for a filing status. `deduction` overrides
 *  the standard deduction (for itemizers); otherwise the standard is used. */
export function federalTax(income: number, filing: Filing, inflFactor: number, deduction?: number): number {
  const ded = deduction != null ? deduction : STD_DEDUCTION[filing] * inflFactor;
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

/**
 * The SALT deduction cap for a plan year. $40,000 for 2025 rising 1% a year
 * through 2029, reduced by 30% of income over $500,000 but never below
 * $10,000; back to a flat $10,000 from 2030 under current law.
 */
export function saltCapAt(year: number, magi: number): number {
  if (year >= 2030) return 10000;
  const n = Math.max(0, Math.min(4, year - 2025));
  const cap = 40000 * Math.pow(1.01, n);
  const phase = 500000 * Math.pow(1.01, n);
  return Math.max(10000, cap - 0.3 * Math.max(0, magi - phase));
}

/** Itemized deductions for a year: charitable gifts (tithe + offerings) +
 *  mortgage interest + SALT (state income + property tax, capped) + other. */
export function itemizedDeductionAt(inp: CashflowInputs, age: number, nowMs: number, incomeForState: number): {
  total: number; charitable: number; mortgageInterest: number; salt: number;
} {
  const { profile, debts, scenario } = inp;
  const inflFactor = Math.pow(1 + profile.inflation_rate, age - profile.current_age);
  const charitable = titheAndOfferingAt(inp, age, nowMs);
  let mortgageInterest = 0;
  for (const d of debts) {
    if (d.subtype === "loan" && d.type === "mortgage" && d.balance && d.rate_pct && debtAnnualAt(d, age, profile) > 0) {
      // Interest on the balance still owed this year (the loan amortises), and
      // only on the first $750,000 of acquisition debt.
      const bal = Math.min(750000, mortgageBalanceAt(d, age - profile.current_age));
      mortgageInterest += bal * (d.rate_pct / 100);
    }
  }
  const stateIncomeTax = ((scenario.state_tax_rate ?? 5) / 100) * incomeForState;
  const propertyTax = (scenario.property_tax_annual ?? 0) * inflFactor;
  const year = new Date().getFullYear() + (age - profile.current_age);
  const salt = Math.min(stateIncomeTax + propertyTax, saltCapAt(year, incomeForState) * inflFactor);
  const other = (scenario.other_itemized ?? 0) * inflFactor;
  return { total: charitable + mortgageInterest + salt + other, charitable, mortgageInterest, salt: salt + other };
}

/** The deduction to use — greater of standard and itemized. */
export function deductionAt(inp: CashflowInputs, age: number, nowMs: number, income: number, filing: Filing, inflFactor: number): number {
  const senior = seniorDeductionAt(age, inp.profile, filing, inflFactor);
  return Math.max(STD_DEDUCTION[filing] * inflFactor + senior, itemizedDeductionAt(inp, age, nowMs, income).total);
}

/** Automatic effective tax rate for a year: federal (brackets + standard
 *  deduction, by filing status) plus a flat state/local rate. */
export function autoTaxRate(income: number, age: number, profile: RetirementProfile, scenario: RetirementScenario): number {
  if (income <= 0) return 0;
  const inflFactor = Math.pow(1 + profile.inflation_rate, age - profile.current_age);
  const filing: Filing = profile.spouse_enabled ? "mfj" : "single";
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

/**
 * The age required minimum distributions begin. SECURE 2.0 set it at 73 for
 * people born 1951–1959 and 75 for anyone born in 1960 or later. A planner
 * who is 47 today was born in 1979, so a fixed 73 forced two years of
 * distributions — and the tax and Medicare surcharges on them — that the law
 * does not require.
 */
export function rmdAge(profile: Pick<RetirementProfile, "current_age">): number {
  const birthYear = new Date().getFullYear() - profile.current_age;
  return birthYear >= 1960 ? 75 : 73;
}
// IRS Uniform Lifetime Table divisors, age 73+.
const RMD_DIVISORS: Record<number, number> = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
  83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
  93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2,
  104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1,
  114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3,
};
/** Required minimum distribution from a pre-tax balance at a given age (0 if none). */
export function rmdAmount(pretaxBalance: number, age: number, profile: Pick<RetirementProfile, "current_age">): number {
  if (age < rmdAge(profile) || pretaxBalance <= 0) return 0;
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
  filing: Filing, inflFactor: number, state: number, extraDeduction = 0,
): { tax: number; magi: number } {
  // Capital gains count in the provisional-income test for Social Security.
  const taxableSS = ssTaxablePortion(ss, otherOrdinaryIncome + pretaxWithdrawn + taxableGain, filing, inflFactor);
  const ordinary = otherOrdinaryIncome + taxableSS + pretaxWithdrawn;
  const deduction = STD_DEDUCTION[filing] * inflFactor + extraDeduction;
  const fed = federalTax(ordinary, filing, inflFactor, deduction);
  // Whatever deduction ordinary income did not use shelters gains first.
  const taxableOrdinary = Math.max(0, ordinary - deduction);
  const gainAfterDeduction = Math.max(0, taxableGain - Math.max(0, deduction - ordinary));
  const capGains = capitalGainsTax(taxableOrdinary, gainAfterDeduction, filing, inflFactor).tax;
  const magi = ordinary + taxableGain;
  const niit = niitTax(taxableGain, magi, filing);
  const stateTax = state * (ordinary + taxableGain);
  return { tax: fed + capGains + niit + stateTax, magi };
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
  // Flat nominal — an assumed offering is a fixed monthly amount, not something
  // that balloons with 40 years of inflation. (The 10% tithe already scales with income.)
  const offering = (scenario.offering_monthly ?? 0) * 12;

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
    const spend = baseAnnualSpend(scenario) * inflFactor + healthcareCostAt(scenario, age, profile) + entered;
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
export function ltcgRate(ordinary: number, filing: Filing, inflFactor: number): number {
  const [bottom, top] = CURRENT.ltcg[filing].map((v) => v * inflFactor);
  if (ordinary >= top) return 0.20;
  if (ordinary >= bottom) return 0.15;
  return 0;
}

/**
 * Portion of Social Security benefits that is taxable (≤85%), via the IRS
 * provisional-income formula.
 *
 * The thresholds are deliberately NOT inflated. Congress fixed them in nominal
 * dollars in 1983 and 1993 and has never indexed them — which is why a rising
 * share of retirees pays tax on a rising share of their benefit. Inflating them
 * (as this did) shelters income the law would tax, and the error compounds every
 * year of a thirty-year plan.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ssTaxablePortion(ss: number, otherIncome: number, filing: Filing, _inflFactor: number): number {
  if (ss <= 0) return 0;
  const [t1, t2] = filing === "mfj" ? [32000, 44000] : [25000, 34000];
  const b1 = t1, b2 = t2;
  const provisional = otherIncome + 0.5 * ss;
  if (provisional <= b1) return 0;
  if (provisional <= b2) return Math.min(0.5 * (provisional - b1), 0.5 * ss);
  const lowerTier = Math.min(0.5 * (b2 - b1), 0.5 * ss);
  return Math.min(0.85 * (provisional - b2) + lowerTier, 0.85 * ss);
}

/**
 * Additional Medicare tax (0.9%) on wages above the MAGI threshold.
 * Like the Social Security thresholds, the $200k/$250k figures are fixed in
 * nominal dollars and are not indexed — so they are not inflated here.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function additionalMedicareTax(wages: number, filing: Filing, _inflFactor: number): number {
  const thr = filing === "mfj" ? 250000 : 200000;
  return Math.max(0, wages - thr) * 0.009;
}

/** Estimated income tax (federal + state) for the year. Working years tax wages
 *  (plus the additional-Medicare surtax on high earners); retirement taxes
 *  ordinary income + only the taxable portion of Social Security. */
export function estimatedTaxAt(inp: CashflowInputs, age: number, nowMs: number): number {
  const { profile, accounts, incomes, expenses, debts, scenario } = inp;
  const isRetired = age >= profile.retirement_age;
  const inflFactor = Math.pow(1 + profile.inflation_rate, age - profile.current_age);
  const filing: Filing = profile.spouse_enabled ? "mfj" : "single";
  const state = (scenario.state_tax_rate ?? 5) / 100;

  if (!isRetired) {
    // Everything on the W-2 — salary, bonus and stock that vests — less what
    // is deferred before tax into 401(k)/403(b)/HSA accounts.
    const gross = grossPayAt(incomes, age, profile);
    if (gross <= 0) return 0;
    const wages = Math.max(0, gross - pretaxDeferralsAt(accounts, age, profile));
    const deduction = deductionAt(inp, age, nowMs, wages, filing, inflFactor); // greater of standard / itemized
    const tax = federalTax(wages, filing, inflFactor, deduction) + additionalMedicareTax(gross, filing, inflFactor) + state * wages;
    return Math.min(0.6 * gross, tax);
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
  const senior = seniorDeductionAt(age, profile, filing, inflFactor);
  const { tax } = retirementIncomeTax(otherOrdinaryIncome, ss, pretaxW, ltcgIncome, filing, inflFactor, state, senior);
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
  override?: { tax?: number; irmaa?: number; rmd?: number; scenarioSpend?: number },
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
  // The engine supplies the lifestyle figure when it has applied the spending
  // smile or the survivor multiplier; otherwise it is the plain inflated spend.
  const scenarioSpend = isRetired ? (override?.scenarioSpend ?? baseAnnualSpend(scenario) * inflFactor) : 0;
  if (scenarioSpend > 0.5) {
    outflows.push({ label: `Retirement lifestyle · ${scenario.selected_scenario}`, amount: scenarioSpend, kind: "scenario" });
  }
  const healthcare = isRetired ? healthcareCostAt(scenario, age, profile) : 0;
  if (healthcare > 0.5) {
    const ltcActive = scenario.ltc_enabled && (scenario.ltc_monthly_cost ?? 0) > 0 &&
      age >= (scenario.ltc_start_age ?? Math.max(profile.retirement_age, profile.life_expectancy - (scenario.ltc_years ?? 3))) &&
      age < (scenario.ltc_start_age ?? Math.max(profile.retirement_age, profile.life_expectancy - (scenario.ltc_years ?? 3))) + (scenario.ltc_years ?? 3);
    outflows.push({ label: age < 65 ? "Healthcare (pre-Medicare)" : ltcActive ? "Healthcare + long-term care" : "Healthcare (Medicare)", amount: healthcare, kind: "healthcare" });
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
