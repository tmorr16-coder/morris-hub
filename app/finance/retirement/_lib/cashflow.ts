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

/** Employer match (free money added to the portfolio) during the working years. */
export function employerMatchAnnual(accounts: RetirementAccount[], age: number, profile: RetirementProfile): number {
  if (age >= profile.retirement_age) return 0;
  return accounts.reduce((s, a) => s + a.monthly_contribution * 12 * ((a.employer_match_pct ?? 0) / 100), 0);
}

/** Employee retirement-account contributions during the working years. */
export function contributionsAnnual(accounts: RetirementAccount[], age: number, profile: RetirementProfile): number {
  if (age >= profile.retirement_age) return 0;
  return accounts.reduce((s, a) => s + a.monthly_contribution * 12, 0);
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
  const match = employerMatchAnnual(accounts, age, profile);
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

  const totalInflow = inflows.reduce((s, i) => s + i.amount, 0);
  const totalOutflow = outflows.reduce((s, i) => s + i.amount, 0);

  // What the projection actually banks into the portfolio during the working years:
  // contributions + employer match + bonuses/stock awards.
  let savedToPortfolio = 0;
  if (!isRetired) {
    savedToPortfolio = contributionsAnnual(accounts, age, profile) + match;
    for (const inc of incomes) {
      if (inc.type === "bonus" || inc.type === "stock_award") savedToPortfolio += incomeAnnualAt(inc, age, profile);
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
  };
}
