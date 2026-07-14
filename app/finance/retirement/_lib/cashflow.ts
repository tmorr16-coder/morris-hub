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
    sum += annual * clampedGrowth(inc.annual_growth_pct, age - start);
  }
  return sum;
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
    const growth = clampedGrowth(inc.annual_growth_pct, age - start);
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
export function estimatedTaxAt(inp: CashflowInputs, age: number, nowMs: number): number {
  const { profile, incomes, expenses, debts, scenario } = inp;
  const isRetired = age >= profile.retirement_age;
  const inflFactor = Math.pow(1 + profile.inflation_rate, age - profile.current_age);
  let base: number;
  if (!isRetired) {
    base = titheGrossBaseAt(incomes, age, profile);
  } else {
    const retIncome = retirementIncomeAt(incomes, age, profile);
    let entered = 0;
    for (const e of expenses) entered += expenseAnnualAt(e, age, profile, nowMs);
    for (const d of debts) entered += debtAnnualAt(d, age, profile);
    base = Math.max(retIncome, baseAnnualSpend(scenario) * inflFactor + entered);
  }
  return autoTaxRate(base, age, profile, scenario) * base;
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
export function yearCashflow(inp: CashflowInputs, age: number, nowMs: number, currentYear: number): YearCashflow {
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
  const estimatedTax = estimatedTaxAt(inp, age, nowMs);
  if (estimatedTax > 0.5) {
    outflows.push({ label: "Income taxes (est.)", amount: estimatedTax, kind: "tax" });
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
  };
}
