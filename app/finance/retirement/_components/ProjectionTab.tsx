"use client";

import { useMemo, useState } from "react";
import { Cell, Chip, Segmented, Sparkline, BarRows, RadialGauge } from "@/components/ios";
import type { RetirementProfile, RetirementAccount, RetirementIncome, RetirementScenario, RetirementExpense, RetirementDebt } from "../types";
import { clampedGrowth, expenseAnnualAt, debtAnnualAt, wageIncomeAt, employerMatchAnnual, titheAndOfferingAt } from "../_lib/cashflow";

interface Props {
  profile: RetirementProfile;
  accounts: RetirementAccount[];
  incomes: RetirementIncome[];
  scenario: RetirementScenario;
  expenses: RetirementExpense[];
  debts: RetirementDebt[];
}

interface ProjectionResult {
  portfolioByAge: Map<number, number>;
  jobIncomeByAge: Map<number, number>;    // salary pre-ret + bridge/part_time post-ret (annual $)
  ssIncomeByAge: Map<number, number>;     // Social Security income (annual $)
  pensionIncomeByAge: Map<number, number>;
  expensesByAge: Map<number, number>;     // total annual outflows from now (entered expenses/debts + scenario once retired)
  nestEgg: number;
  safeMonthlyWithdrawal: number;
  depletionAge: number | null;
  runway: number | string;
  baseAnnualSpend: number;
  weightedReturn: number;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtLarge(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return fmtMoney(n);
}

function getSelectedSpend(scenario: RetirementScenario): number {
  const sel = scenario.selected_scenario as
    | "lean"
    | "balanced"
    | "abundant"
    | "custom";
  const key = `${sel}_monthly_spend` as keyof RetirementScenario;
  return scenario[key] as number;
}

// ── Shared money math ───────────────────────────────────────────────────────
// clampedGrowth, expenseAnnualAt, debtAnnualAt and wageIncomeAt live in
// ../_lib/cashflow so the projection and the Outflows-tab cash-flow inspector
// compute every income/expense/debt identically (single source of truth).

/** Total entered outflows (expenses + debt payments) at a given age. */
function outflowAt(ctx: StepCtx, age: number): number {
  let sum = 0;
  for (const e of ctx.expenses) sum += expenseAnnualAt(e, age, ctx.profile, ctx.nowMs);
  for (const d of ctx.debts) sum += debtAnnualAt(d, age, ctx.profile);
  return sum;
}

interface StepCtx {
  profile: RetirementProfile;
  accounts: RetirementAccount[];
  incomes: RetirementIncome[];
  expenses: RetirementExpense[];
  debts: RetirementDebt[];
  scenario: RetirementScenario;
  weightedReturn: number;
  baseAnnualSpend: number;
  windfall: number;
  nowMs: number;
}

function buildCtx(
  profile: RetirementProfile,
  accounts: RetirementAccount[],
  incomes: RetirementIncome[],
  expenses: RetirementExpense[],
  debts: RetirementDebt[],
  scenario: RetirementScenario
): StepCtx {
  const monthlySpend = getSelectedSpend(scenario);
  const baseAnnualSpend =
    monthlySpend * 12 + scenario.annual_travel + scenario.monthly_health_premium * 12;

  const totalBal = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const weightedReturn =
    totalBal > 0
      ? accounts.reduce(
          (s, a) =>
            s + ((a.balance ?? 0) / totalBal) * (a.return_override ?? profile.base_return),
          0
        )
      : profile.base_return;

  return {
    profile,
    accounts,
    incomes,
    expenses,
    debts,
    scenario,
    nowMs: Date.now(),
    weightedReturn,
    baseAnnualSpend,
    windfall: scenario.housing_windfall ?? 0,
  };
}

/**
 * Advances the portfolio through a single year. This is the ONE place the
 * per-year money math lives — the deterministic, shocked, and Monte-Carlo
 * paths all call it so their contribution/withdrawal/income/expense logic
 * stays identical.
 *
 * @param yearReturn  the market return to apply this year
 * @param endMult     extra multiplier applied AFTER growth/withdrawal (shock)
 */
function stepYear(
  ctx: StepCtx,
  portfolioStart: number,
  age: number,
  yearReturn: number,
  endMult = 1
): number {
  const { profile, accounts, incomes } = ctx;
  const yearsFromNow = age - profile.current_age;
  const isRetired = age >= profile.retirement_age;
  let portfolio = portfolioStart;

  if (age === profile.retirement_age) {
    portfolio += ctx.windfall;
  }

  if (age > profile.current_age) {
    portfolio *= 1 + yearReturn;
  }

  if (!isRetired) {
    // Employee contributions + a salary-based employer match (capped at the IRS limit).
    portfolio += accounts.reduce((s, a) => s + a.monthly_contribution * 12, 0);
    portfolio += employerMatchAnnual(accounts, incomes, age, profile);
    // Bonuses and vesting stock awards add to the portfolio during employment.
    for (const inc of incomes) {
      if (inc.type !== "bonus" && inc.type !== "stock_award") continue;
      const startAge = inc.start_age ?? profile.current_age;
      const endAge = inc.end_age ?? (
        inc.type === "stock_award" && inc.vest_years != null
          ? startAge + inc.vest_years       // vest_years defines the window
          : profile.retirement_age - 1      // default: through end of career
      );
      if (age < startAge || age > endAge) continue;
      const growthFactor = clampedGrowth(inc.annual_growth_pct, age - startAge);
      portfolio += inc.monthly_amount * growthFactor; // monthly_amount stores annual amount for these types
    }
    // Entered outflows (living costs, tuition, debt payments) plus any tithe draw
    // on savings only to the extent they exceed the wage income meant to cover
    // them. Salary covers day-to-day spend; a temporary spike like tuition dips
    // savings only if it outstrips income that year.
    const deficit = outflowAt(ctx, age) + titheAndOfferingAt(ctx, age, ctx.nowMs) - wageIncomeAt(incomes, age, profile);
    if (deficit > 0) portfolio = Math.max(0, portfolio - deficit);
  } else {
    const inflFactor = Math.pow(1 + profile.inflation_rate, yearsFromNow);
    const adjSpend = ctx.baseAnnualSpend * inflFactor;

    const retirementIncome = incomes
      .filter((inc) => {
        if (inc.type === "salary" || inc.type === "bonus") return false;
        // Stock awards that are still vesting into early retirement count
        if (inc.type === "stock_award") {
          const startAge = inc.start_age ?? profile.current_age;
          const endAge = inc.end_age ?? (startAge + (inc.vest_years ?? 4));
          return age >= startAge && age <= endAge;
        }
        const startAge = inc.start_age ?? profile.retirement_age;
        const endAge = inc.end_age ?? 999;
        if (age < startAge || age > endAge) return false;
        if (inc.type === "social_security" && inc.ss_claim_age != null && age < inc.ss_claim_age)
          return false;
        return true;
      })
      .reduce((s, inc) => {
        // Convert to annual amount based on frequency
        const annual = inc.frequency === "annual" || inc.type === "stock_award"
          ? inc.monthly_amount
          : inc.monthly_amount * 12;
        return s + annual * inflFactor;
      }, 0);

    // Retirement drawdown covers the lifestyle scenario, any entered outflows
    // still active (a mortgage past retirement), and the tithe on what comes in.
    const totalSpend = adjSpend + outflowAt(ctx, age) + titheAndOfferingAt(ctx, age, ctx.nowMs);
    const netWithdrawal = Math.max(0, totalSpend - retirementIncome);
    portfolio = Math.max(0, portfolio - netWithdrawal);
  }

  return portfolio * endMult;
}

/**
 * Runs a full portfolio path from current_age → life_expectancy, applying a
 * per-year return supplied by `returnFor` and an optional one-year shock.
 */
function runProjection(
  ctx: StepCtx,
  returnFor: (age: number) => number,
  opts?: { shockAge?: number | null; shockMult?: number }
): { byAge: Map<number, number>; depletionAge: number | null; final: number } {
  const { profile, accounts } = ctx;
  let portfolio = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const byAge = new Map<number, number>();
  let depletionAge: number | null = null;

  for (let age = profile.current_age; age <= profile.life_expectancy; age++) {
    const endMult =
      opts?.shockAge != null && age === opts.shockAge ? opts.shockMult ?? 1 : 1;
    portfolio = stepYear(ctx, portfolio, age, returnFor(age), endMult);
    if (portfolio === 0 && depletionAge === null && age >= profile.retirement_age) {
      depletionAge = age;
    }
    byAge.set(age, portfolio);
  }
  return { byAge, depletionAge, final: portfolio };
}

// Seeded PRNG (mulberry32) + Box–Muller normal draw — keeps the Monte-Carlo
// band stable across re-renders (must never rely on Math.random()/Date.now()).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextNormal(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function project(
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
  const portfolioByAge    = new Map<number, number>();
  const jobIncomeByAge    = new Map<number, number>();
  const ssIncomeByAge     = new Map<number, number>();
  const pensionIncomeByAge = new Map<number, number>();
  const expensesByAge     = new Map<number, number>();
  let nestEgg = 0;
  let depletionAge: number | null = null;

  for (let age = profile.current_age; age <= profile.life_expectancy; age++) {
    const yearsFromNow = age - profile.current_age;
    const isRetired = age >= profile.retirement_age;

    // Nest egg = portfolio + windfall at the moment of retirement (pre-growth).
    if (age === profile.retirement_age) {
      nestEgg = portfolio + windfall;
    }

    // Advance one year using the shared per-year money math.
    portfolio = stepYear(ctx, portfolio, age, weightedReturn);

    if (portfolio === 0 && depletionAge === null && isRetired) {
      depletionAge = age;
    }

    portfolioByAge.set(age, portfolio);

    // ── Per-age income/expense data for chart series ─────────────────────────
    const inflFactor = Math.pow(1 + profile.inflation_rate, yearsFromNow);

    // Job income: salary + stock_award + bonus pre-ret; part_time/bridge/other post-ret
    let jobIncome = 0;
    for (const inc of incomes) {
      if (!["salary", "part_time", "other", "bonus", "stock_award"].includes(inc.type)) continue;
      // Determine effective age window for this income stream
      const start = inc.start_age ?? (
        inc.type === "salary" || inc.type === "bonus" || inc.type === "stock_award"
          ? profile.current_age
          : profile.retirement_age
      );
      const end = inc.end_age ?? (
        inc.type === "stock_award" && inc.vest_years != null
          ? start + inc.vest_years          // stock awards: use vest_years as fallback
          : inc.type === "salary" || inc.type === "bonus"
            ? profile.retirement_age - 1   // salary/bonus: default end at retirement
            : 999                           // part_time/other: no default end
      );
      if (age < start || age > end) continue;
      // Same clamped compounding as the portfolio math so the series matches.
      const growth = clampedGrowth(inc.annual_growth_pct, age - start);
      // stock_award and bonus store annual value in monthly_amount field
      const annual = (inc.frequency === "annual" || inc.type === "stock_award" || inc.type === "bonus")
        ? inc.monthly_amount
        : inc.monthly_amount * 12;
      jobIncome += annual * growth * (isRetired ? inflFactor : 1);
    }
    jobIncomeByAge.set(age, Math.round(jobIncome));

    // Social Security income
    let ssIncome = 0;
    for (const inc of incomes) {
      if (inc.type !== "social_security") continue;
      if (age < (inc.ss_claim_age ?? 67)) continue;
      ssIncome += inc.monthly_amount * 12 * inflFactor;
    }
    ssIncomeByAge.set(age, Math.round(ssIncome));

    // Pension income
    let pensionIncome = 0;
    for (const inc of incomes) {
      if (inc.type !== "pension") continue;
      if (age < (inc.start_age ?? profile.retirement_age)) continue;
      pensionIncome += inc.monthly_amount * 12 * inflFactor;
    }
    pensionIncomeByAge.set(age, Math.round(pensionIncome));

    // Total outflows from now: entered expenses + debt payments across their
    // windows, plus the retirement lifestyle scenario once retired.
    const enteredOutflow = outflowAt(ctx, age) + titheAndOfferingAt(ctx, age, ctx.nowMs);
    expensesByAge.set(age, Math.round((isRetired ? baseAnnualSpend * inflFactor : 0) + enteredOutflow));
  }

  if (nestEgg === 0) {
    nestEgg = portfolioByAge.get(profile.retirement_age) ?? 0;
  }

  const safeMonthlyWithdrawal = (nestEgg * 0.04) / 12;
  const runway =
    depletionAge != null ? depletionAge - profile.retirement_age : "lifetime";

  return { portfolioByAge, jobIncomeByAge, ssIncomeByAge, pensionIncomeByAge, expensesByAge, nestEgg, safeMonthlyWithdrawal, depletionAge, runway, baseAnnualSpend, weightedReturn };
}

function projectForScenario(
  profile: RetirementProfile,
  accounts: RetirementAccount[],
  incomes: RetirementIncome[],
  expenses: RetirementExpense[],
  debts: RetirementDebt[],
  scenario: RetirementScenario,
  scenarioKey: "lean" | "balanced" | "abundant"
): { depletionAge: number | null; nestEgg: number } {
  const overrideScenario = { ...scenario, selected_scenario: scenarioKey };
  const r = project(profile, accounts, incomes, expenses, debts, overrideScenario);
  return { depletionAge: r.depletionAge, nestEgg: r.nestEgg };
}

const SERIES = [
  { key: "portfolio" as const, label: "Portfolio balance", color: "var(--ios-finance)" },
  { key: "jobIncome" as const, label: "Job / bridge income", color: "var(--ios-green)" },
  { key: "ss" as const, label: "Social Security", color: "var(--ios-tint)" },
  { key: "pension" as const, label: "Pension", color: "var(--ios-orange)" },
  { key: "expenses" as const, label: "Expenses & outflows", color: "var(--ios-red)" },
];

const SHOCK_OPTIONS = [
  { value: "0" as const, label: "None" },
  { value: "10" as const, label: "−10%" },
  { value: "20" as const, label: "−20%" },
  { value: "30" as const, label: "−30%" },
];

const MC_SIMS = 400;
const MC_STDEV = 0.12;
const MC_SEED = 0x9e3779b9;

export default function ProjectionTab({ profile, accounts, incomes, scenario, expenses, debts }: Props) {
  const [shown, setShown] = useState<Record<string, boolean>>({
    portfolio: true, jobIncome: true, ss: true, pension: true, expenses: true,
  });
  function toggle(key: string) { setShown((s) => ({ ...s, [key]: !s[key] })); }

  const [hoveredAge, setHoveredAge] = useState<number | null>(null);

  // Sequence-of-returns controls
  const [shockPct, setShockPct] = useState<"0" | "10" | "20" | "30">("0");
  const [shockAge, setShockAge] = useState<number>(profile.retirement_age);
  const [showMC, setShowMC] = useState<boolean>(false);

  const result = project(profile, accounts, incomes, expenses, debts, scenario);
  const { portfolioByAge, jobIncomeByAge, ssIncomeByAge, pensionIncomeByAge, expensesByAge,
          nestEgg, safeMonthlyWithdrawal, depletionAge, runway, weightedReturn } = result;

  const annualWithdrawalNeed = getSelectedSpend(scenario) * 12 + scenario.annual_travel + scenario.monthly_health_premium * 12;
  const safeAnnualWithdrawal = nestEgg * 0.04;
  const gap = annualWithdrawalNeed - safeAnnualWithdrawal;
  const gapMonthly = gap / 12;

  // Scenario comparison
  const leanResult = projectForScenario(profile, accounts, incomes, expenses, debts, scenario, "lean");
  const balancedResult = projectForScenario(profile, accounts, incomes, expenses, debts, scenario, "balanced");
  const abundantResult = projectForScenario(profile, accounts, incomes, expenses, debts, scenario, "abundant");

  const ages = Array.from({ length: profile.life_expectancy - profile.current_age + 1 }, (_, i) => profile.current_age + i);
  const values = ages.map((a) => portfolioByAge.get(a) ?? 0);

  // ── Market-shock path (deterministic returns + one-year hit) ──────────────
  const shockFraction = parseInt(shockPct, 10) / 100;
  const shockResult = useMemo(() => {
    if (shockFraction <= 0) return null;
    const ctx = buildCtx(profile, accounts, incomes, expenses, debts, scenario);
    return runProjection(ctx, () => ctx.weightedReturn, {
      shockAge,
      shockMult: 1 - shockFraction,
    });
  }, [profile, accounts, incomes, expenses, debts, scenario, shockFraction, shockAge]);

  // ── Monte-Carlo band + success rate ───────────────────────────────────────
  const mc = useMemo(() => {
    const ctx = buildCtx(profile, accounts, incomes, expenses, debts, scenario);
    const rng = mulberry32(MC_SEED);
    const perAge: number[][] = Array.from({ length: ages.length }, () => [] as number[]);
    let successes = 0;
    for (let s = 0; s < MC_SIMS; s++) {
      const { byAge, final } = runProjection(ctx, () => ctx.weightedReturn + nextNormal(rng) * MC_STDEV);
      ages.forEach((a, i) => perAge[i].push(byAge.get(a) ?? 0));
      if (final > 0) successes++;
    }
    const band = ages.map((a, i) => {
      const sorted = perAge[i].slice().sort((x, y) => x - y);
      return { age: a, p10: percentile(sorted, 0.1), p50: percentile(sorted, 0.5), p90: percentile(sorted, 0.9) };
    });
    return { band, successRate: successes / MC_SIMS };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, accounts, incomes, expenses, debts, scenario]);

  // ── Chart geometry ─────────────────────────────────────────────────────────
  const W = 800;
  const PAD_L = 72;
  const PAD_R = 16;
  const chartW = W - PAD_L - PAD_R;

  // Panel A — portfolio
  const HA = 260;
  const PAD_TA = 24;
  const PAD_BA = 24;
  const chartHA = HA - PAD_TA - PAD_BA;

  // Panel B — annual cash flow
  const HB = 210;
  const PAD_TB = 16;
  const PAD_BB = 40;
  const chartHB = HB - PAD_TB - PAD_BB;

  function xPos(age: number) {
    return PAD_L + ((age - profile.current_age) / (profile.life_expectancy - profile.current_age)) * chartW;
  }

  // Panel A y-scale: exclude the housing-windfall spike so pre-retirement growth
  // stays visible; include the shock path and Monte-Carlo p90 when shown.
  const windfallAmount = scenario.housing_windfall ?? 0;
  const scaleVals: number[] = ages.map((a) => {
    const v = portfolioByAge.get(a) ?? 0;
    return a === profile.retirement_age && windfallAmount > 0 ? v - windfallAmount : v;
  });
  if (showMC) scaleVals.push(...mc.band.map((b) => b.p90));
  if (shockResult) scaleVals.push(...ages.map((a) => shockResult.byAge.get(a) ?? 0));
  const maxValA = Math.max(...scaleVals, 1) * 1.1;

  function yPosA(val: number) {
    return PAD_TA + chartHA - (val / maxValA) * chartHA;
  }

  // Panel B y-scale: income/expense magnitudes only.
  const cashVals = ages.flatMap((a) => [
    jobIncomeByAge.get(a) ?? 0,
    ssIncomeByAge.get(a) ?? 0,
    pensionIncomeByAge.get(a) ?? 0,
    expensesByAge.get(a) ?? 0,
  ]);
  const maxValB = Math.max(...cashVals, 1) * 1.1;

  function yPosB(val: number) {
    return PAD_TB + chartHB - (val / maxValB) * chartHB;
  }

  function cashPath(map: Map<number, number>): string {
    return ages
      .map((a, i) => `${i === 0 ? "M" : "L"}${xPos(a).toFixed(1)},${yPosB(map.get(a) ?? 0).toFixed(1)}`)
      .join(" ");
  }

  // Portfolio segments (Panel A)
  const preRetirementPoints = ages.filter((a) => a <= profile.retirement_age);
  const retiredPoints = ages.filter((a) => a >= profile.retirement_age);
  const depletedPoints = depletionAge != null ? retiredPoints.filter((a) => a >= depletionAge!) : [];
  const healthyRetiredPoints = depletionAge != null
    ? retiredPoints.filter((a) => a <= depletionAge!)
    : retiredPoints;

  function portfolioPath(pts: number[]): string {
    return pts
      .map((a, i) => `${i === 0 ? "M" : "L"}${xPos(a).toFixed(1)},${yPosA(portfolioByAge.get(a) ?? 0).toFixed(1)}`)
      .join(" ");
  }

  // Monte-Carlo band (p90 across, back along p10) + median line
  const mcBandPath = (() => {
    if (!showMC || mc.band.length < 2) return "";
    const top = mc.band.map((b, i) => `${i === 0 ? "M" : "L"}${xPos(b.age).toFixed(1)},${yPosA(b.p90).toFixed(1)}`).join(" ");
    const bottom = mc.band.slice().reverse().map((b) => `L${xPos(b.age).toFixed(1)},${yPosA(b.p10).toFixed(1)}`).join(" ");
    return `${top} ${bottom} Z`;
  })();
  const mcMedianPath = showMC
    ? mc.band.map((b, i) => `${i === 0 ? "M" : "L"}${xPos(b.age).toFixed(1)},${yPosA(b.p50).toFixed(1)}`).join(" ")
    : "";

  const shockPath = shockResult
    ? ages.map((a, i) => `${i === 0 ? "M" : "L"}${xPos(a).toFixed(1)},${yPosA(shockResult.byAge.get(a) ?? 0).toFixed(1)}`).join(" ")
    : "";

  // Panel A y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxValA * i) / yTicks);
  // Panel B y-axis ticks
  const yTickValuesB = Array.from({ length: 4 }, (_, i) => (maxValB * i) / 3);

  // Bridge job note
  const hasBridgeJob = incomes.some(
    (inc) => inc.type === "part_time" && (inc.start_age ?? profile.retirement_age) >= profile.retirement_age
  );

  // Hovered values for tooltip
  const hoveredPortfolio = hoveredAge != null ? (portfolioByAge.get(hoveredAge) ?? 0) : null;
  const hoveredJobIncome = hoveredAge != null ? (jobIncomeByAge.get(hoveredAge) ?? 0) : null;
  const hoveredSS = hoveredAge != null ? (ssIncomeByAge.get(hoveredAge) ?? 0) : null;
  const hoveredPension = hoveredAge != null ? (pensionIncomeByAge.get(hoveredAge) ?? 0) : null;
  const hoveredExpenses = hoveredAge != null ? (expensesByAge.get(hoveredAge) ?? 0) : null;

  // Key ages for table
  const tableAges = [
    profile.current_age,
    profile.retirement_age,
    70,
    75,
    80,
    85,
    profile.life_expectancy,
  ].filter((a, idx, arr) => a >= profile.current_age && a <= profile.life_expectancy && arr.indexOf(a) === idx);

  // Health hue for the headline sparkline / gauge.
  const healthColor = depletionAge != null ? "var(--ios-red)" : "var(--ios-green)";

  // Plan-confidence ratio: share of retirement years the portfolio survives.
  const retirementSpan = profile.life_expectancy - profile.retirement_age;
  const survivedSpan =
    depletionAge != null ? Math.max(0, depletionAge - profile.retirement_age) : retirementSpan;
  const survivalRatio = retirementSpan > 0 ? Math.min(1, survivedSpan / retirementSpan) : 1;

  const xLabelAges = [profile.current_age, profile.retirement_age, profile.life_expectancy]
    .filter((a, idx, arr) => a >= profile.current_age && a <= profile.life_expectancy && arr.indexOf(a) === idx);

  return (
    <div>
      {/* Hero — projected nest egg + plan-confidence gauge + projection curve */}
      <div className="ios-list" style={{ margin: "0 0 8px", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Projected nest egg
            </div>
            <div className="ios-num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 2 }}>
              {fmtLarge(nestEgg)}
            </div>
            <div className="ios-subhead" style={{ marginTop: 2, color: healthColor }}>
              At age {profile.retirement_age} ·{" "}
              {depletionAge != null ? `funds run out at ${depletionAge}` : "outlives your plan"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <RadialGauge
              value={survivalRatio}
              color={healthColor}
              size={72}
              label="Plan confidence"
              center={
                <span className="ios-num" style={{ fontSize: 17, fontWeight: 700 }}>
                  {Math.round(survivalRatio * 100)}%
                </span>
              }
            />
            <div className="ios-caption" style={{ color: "var(--ios-label-2)", textAlign: "center" }}>
              Monte Carlo success: {Math.round(mc.successRate * 100)}%
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <Sparkline points={values} color={healthColor} width={320} height={52} />
        </div>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 6 }}>
          Age {profile.current_age} → {profile.life_expectancy}
        </div>
      </div>

      {/* Gap / surplus callout */}
      {nestEgg > 0 && (
        <div className="ios-list" style={{ margin: "0 0 8px", padding: 16 }}>
          <div className="ios-subhead" style={{ color: "var(--ios-label)", lineHeight: 1.5 }}>
            {gap > 0 ? (
              <>
                <strong style={{ color: "var(--ios-orange)" }}>Gap: {fmtMoney(gapMonthly)}/mo</strong> — your projected safe
                withdrawal falls short of your planned spend. Consider extending contributions, reducing scenario spend, or
                delaying retirement.
              </>
            ) : (
              <>
                <strong style={{ color: "var(--ios-green)" }}>Surplus: {fmtMoney(Math.abs(gapMonthly))}/mo</strong> — your plan is
                on track. The 4% rule supports your lifestyle scenario.
              </>
            )}
          </div>
        </div>
      )}

      {/* Summary metrics */}
      <div className="ios-group-header" style={{ padding: "16px 0 7px" }}>SUMMARY</div>
      <div className="ios-list" style={{ margin: 0 }}>
        <Cell
          chevron={false}
          title="Safe monthly withdrawal"
          subtitle="4% rule"
          trailing={<span className="ios-num">{fmtMoney(safeMonthlyWithdrawal)}</span>}
        />
        <Cell
          chevron={false}
          title="Portfolio depletion"
          subtitle={depletionAge != null ? "funds exhausted" : "surplus at end of life"}
          trailing={
            <span className="ios-num" style={{ color: depletionAge != null ? "var(--ios-red)" : "var(--ios-green)" }}>
              {depletionAge != null ? `Age ${depletionAge}` : "Outlives plan"}
            </span>
          }
        />
        <Cell
          chevron={false}
          title="Retirement runway"
          subtitle={runway === "lifetime" ? "portfolio survives" : "from retirement"}
          trailing={<span className="ios-num">{runway === "lifetime" ? "Lifetime" : `${runway} years`}</span>}
        />
      </div>

      {/* Portfolio projection chart */}
      <div className="ios-group-header" style={{ padding: "16px 0 7px" }}>PORTFOLIO PROJECTION</div>
      <div className="ios-list" style={{ margin: 0, padding: 18 }}>
        {/* ── Series toggle chips ── */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {SERIES.map((s) => (
            <Chip
              key={s.key}
              small
              selected={s.key === "portfolio" ? true : !!shown[s.key]}
              onClick={() => { if (s.key !== "portfolio") toggle(s.key); }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color, display: "inline-block" }} />
                {s.label}
              </span>
            </Chip>
          ))}
        </div>

        {/* ── Sequence-of-returns risk controls ── */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>Market shock</span>
            <Segmented
              options={SHOCK_OPTIONS}
              value={shockPct}
              onChange={(v) => setShockPct(v)}
              ariaLabel="One-time market shock"
            />
          </div>
          {shockFraction > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>Shock at age</span>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="ios-chip ios-chip--sm"
                  onClick={() => setShockAge((a) => Math.max(profile.current_age, a - 1))}
                  aria-label="Decrease shock age"
                >
                  −
                </button>
                <span className="ios-num" style={{ minWidth: 28, textAlign: "center" }}>{shockAge}</span>
                <button
                  type="button"
                  className="ios-chip ios-chip--sm"
                  onClick={() => setShockAge((a) => Math.min(profile.life_expectancy, a + 1))}
                  aria-label="Increase shock age"
                >
                  +
                </button>
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>Uncertainty</span>
            <Chip small selected={showMC} onClick={() => setShowMC((v) => !v)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--ios-finance)", opacity: 0.5, display: "inline-block" }} />
                Show uncertainty
              </span>
            </Chip>
          </div>
        </div>

        {/* ── Panel A: Portfolio balance ── */}
        <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginBottom: 2, fontWeight: 600 }}>
          Portfolio balance
        </div>
        <svg
          viewBox={`0 0 ${W} ${HA}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          aria-label="Portfolio balance projection"
          onMouseLeave={() => setHoveredAge(null)}
        >
          <defs>
            <clipPath id="panelAClip">
              <rect x={PAD_L} y={PAD_TA} width={chartW} height={chartHA} />
            </clipPath>
          </defs>

          {/* Y axis grid lines + labels */}
          {yTickValues.map((val, i) => {
            const y = yPosA(val).toFixed(1);
            return (
              <g key={i}>
                <line
                  x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                  stroke="var(--ios-separator)" strokeWidth="1"
                  strokeDasharray={i === 0 ? undefined : "4,4"}
                />
                <text x={PAD_L - 6} y={parseFloat(y) + 4} textAnchor="end" fontSize="10" fill="var(--ios-label-2)">
                  {fmtLarge(val)}
                </text>
              </g>
            );
          })}

          {/* Retirement age vertical marker */}
          {profile.retirement_age > profile.current_age && profile.retirement_age <= profile.life_expectancy && (
            <g>
              <line
                x1={xPos(profile.retirement_age).toFixed(1)} y1={PAD_TA}
                x2={xPos(profile.retirement_age).toFixed(1)} y2={HA - PAD_BA}
                stroke="var(--ios-finance)" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.7"
              />
              <text x={xPos(profile.retirement_age) + 4} y={PAD_TA + 12} fontSize="10" fill="var(--ios-finance)">
                Retire {profile.retirement_age}
              </text>
              {windfallAmount > 0 && (
                <text x={xPos(profile.retirement_age) + 4} y={PAD_TA + 24} fontSize="9" fill="var(--ios-finance)">
                  +{fmtLarge(windfallAmount)} windfall
                </text>
              )}
            </g>
          )}

          <g clipPath="url(#panelAClip)">
            {/* Monte-Carlo band + median */}
            {showMC && mcBandPath && (
              <path d={mcBandPath} fill="var(--ios-finance)" fillOpacity="0.12" stroke="none" />
            )}
            {showMC && mcMedianPath && (
              <path d={mcMedianPath} fill="none" stroke="var(--ios-finance)" strokeWidth="1.25" strokeDasharray="2 3" opacity="0.7" />
            )}

            {/* Deterministic portfolio: accumulation / drawdown / depleted */}
            {preRetirementPoints.length > 1 && (
              <path d={portfolioPath(preRetirementPoints)} fill="none" stroke="var(--ios-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {healthyRetiredPoints.length > 1 && (
              <path d={portfolioPath(healthyRetiredPoints)} fill="none" stroke="var(--ios-finance)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {depletedPoints.length > 1 && (
              <path d={portfolioPath(depletedPoints)} fill="none" stroke="var(--ios-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Market-shock path */}
            {shockResult && shockPath && (
              <path d={shockPath} fill="none" stroke="var(--ios-red)" strokeWidth="1.75" strokeDasharray="6 4" strokeLinecap="round" opacity="0.85" />
            )}
          </g>

          {/* Dot at retirement */}
          {profile.retirement_age >= profile.current_age && profile.retirement_age <= profile.life_expectancy && (
            <circle cx={xPos(profile.retirement_age).toFixed(1)} cy={yPosA(portfolioByAge.get(profile.retirement_age) ?? 0).toFixed(1)} r="4" fill="var(--ios-finance)" />
          )}
          {/* Dot at depletion */}
          {depletionAge != null && (
            <circle cx={xPos(depletionAge).toFixed(1)} cy={yPosA(0).toFixed(1)} r="4" fill="var(--ios-red)" />
          )}

          {/* Hover guide (Panel A) */}
          {hoveredAge != null && (
            <line
              x1={xPos(hoveredAge).toFixed(1)} y1={PAD_TA}
              x2={xPos(hoveredAge).toFixed(1)} y2={HA - PAD_BA}
              stroke="var(--ios-label-3)" strokeWidth="1" strokeDasharray="3,3" opacity="0.5"
            />
          )}

          {/* Hover detection bands */}
          {ages.map((age) => (
            <rect
              key={age}
              x={xPos(age) - chartW / (2 * Math.max(ages.length - 1, 1))}
              y={PAD_TA}
              width={chartW / Math.max(ages.length - 1, 1)}
              height={chartHA}
              fill="transparent"
              onMouseEnter={() => setHoveredAge(age)}
            />
          ))}

          {/* Tooltip */}
          {hoveredAge != null && (() => {
            const tooltipLines: { label: string; val: string; color: string }[] = [
              { label: "Portfolio", val: fmtLarge(hoveredPortfolio ?? 0), color: "var(--ios-finance)" },
              ...(shown["jobIncome"] && (hoveredJobIncome ?? 0) > 0
                ? [{ label: "Job income", val: fmtLarge(hoveredJobIncome ?? 0), color: "var(--ios-green)" }] : []),
              ...(shown["ss"] && (hoveredSS ?? 0) > 0
                ? [{ label: "Soc. Sec.", val: fmtLarge(hoveredSS ?? 0), color: "var(--ios-tint)" }] : []),
              ...(shown["pension"] && (hoveredPension ?? 0) > 0
                ? [{ label: "Pension", val: fmtLarge(hoveredPension ?? 0), color: "var(--ios-orange)" }] : []),
              ...(shown["expenses"] && (hoveredExpenses ?? 0) > 0
                ? [{ label: "Expenses", val: fmtLarge(hoveredExpenses ?? 0), color: "var(--ios-red)" }] : []),
            ];
            const tx = Math.min(xPos(hoveredAge) + 8, W - PAD_R - 140);
            const ty = PAD_TA + 4;
            const boxH = 18 + tooltipLines.length * 15;
            return (
              <g>
                <rect x={tx} y={ty} width={138} height={boxH} rx="6" fill="var(--ios-cell)" stroke="var(--ios-separator)" strokeWidth="1" opacity="0.96" />
                <text x={tx + 10} y={ty + 12} fontSize="10" fontWeight="600" fill="var(--ios-label)">
                  Age {hoveredAge}
                </text>
                {tooltipLines.map((line, li) => (
                  <text key={li} x={tx + 10} y={ty + 24 + li * 15} fontSize="10" fill={line.color}>
                    {line.label}: {line.val}
                  </text>
                ))}
              </g>
            );
          })()}
        </svg>

        {/* ── Panel B: Annual cash flow ── */}
        <div className="ios-caption" style={{ color: "var(--ios-label-2)", margin: "8px 0 2px", fontWeight: 600 }}>
          Annual cash flow
        </div>
        <svg
          viewBox={`0 0 ${W} ${HB}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          aria-label="Annual cash flow projection"
          onMouseLeave={() => setHoveredAge(null)}
        >
          <defs>
            <clipPath id="panelBClip">
              <rect x={PAD_L} y={PAD_TB} width={chartW} height={chartHB} />
            </clipPath>
          </defs>

          {/* Y axis grid + labels */}
          {yTickValuesB.map((val, i) => {
            const y = yPosB(val).toFixed(1);
            return (
              <g key={i}>
                <line
                  x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                  stroke="var(--ios-separator)" strokeWidth="1"
                  strokeDasharray={i === 0 ? undefined : "4,4"}
                />
                <text x={PAD_L - 6} y={parseFloat(y) + 4} textAnchor="end" fontSize="10" fill="var(--ios-label-2)">
                  {fmtLarge(val)}
                </text>
              </g>
            );
          })}

          {/* Retirement marker */}
          {profile.retirement_age > profile.current_age && profile.retirement_age <= profile.life_expectancy && (
            <line
              x1={xPos(profile.retirement_age).toFixed(1)} y1={PAD_TB}
              x2={xPos(profile.retirement_age).toFixed(1)} y2={HB - PAD_BB}
              stroke="var(--ios-finance)" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.5"
            />
          )}

          <g clipPath="url(#panelBClip)">
            {shown["jobIncome"] && (
              <path d={cashPath(jobIncomeByAge)} fill="none" stroke="var(--ios-green)" strokeWidth="1.75" strokeDasharray="5 3" strokeLinecap="round" />
            )}
            {shown["ss"] && (
              <path d={cashPath(ssIncomeByAge)} fill="none" stroke="var(--ios-tint)" strokeWidth="1.75" strokeLinecap="round" />
            )}
            {shown["pension"] && (
              <path d={cashPath(pensionIncomeByAge)} fill="none" stroke="var(--ios-orange)" strokeWidth="1.75" strokeLinecap="round" />
            )}
            {shown["expenses"] && (
              <path d={cashPath(expensesByAge)} fill="none" stroke="var(--ios-red)" strokeWidth="1.75" strokeDasharray="7 3" strokeLinecap="round" />
            )}
          </g>

          {/* Hover guide (Panel B) */}
          {hoveredAge != null && (
            <line
              x1={xPos(hoveredAge).toFixed(1)} y1={PAD_TB}
              x2={xPos(hoveredAge).toFixed(1)} y2={HB - PAD_BB}
              stroke="var(--ios-label-3)" strokeWidth="1" strokeDasharray="3,3" opacity="0.5"
            />
          )}

          {/* X-axis age labels (shared axis) */}
          {xLabelAges.map((a) => (
            <text key={a} x={xPos(a).toFixed(1)} y={HB - PAD_BB + 18} textAnchor="middle" fontSize="10" fill="var(--ios-label-2)">
              {a}
            </text>
          ))}

          {/* Hover detection bands */}
          {ages.map((age) => (
            <rect
              key={age}
              x={xPos(age) - chartW / (2 * Math.max(ages.length - 1, 1))}
              y={PAD_TB}
              width={chartW / Math.max(ages.length - 1, 1)}
              height={chartHB}
              fill="transparent"
              onMouseEnter={() => setHoveredAge(age)}
            />
          ))}
        </svg>

        {/* Legend */}
        <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
          <span className="ios-footnote" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ios-label-2)" }}>
            <span style={{ width: 16, height: 3, background: "var(--ios-green)", display: "inline-block", borderRadius: 2 }} />
            Accumulation
          </span>
          <span className="ios-footnote" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ios-label-2)" }}>
            <span style={{ width: 16, height: 3, background: "var(--ios-finance)", display: "inline-block", borderRadius: 2 }} />
            Drawdown
          </span>
          {depletionAge != null && (
            <span className="ios-footnote" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ios-label-2)" }}>
              <span style={{ width: 16, height: 3, background: "var(--ios-red)", display: "inline-block", borderRadius: 2 }} />
              Depleted
            </span>
          )}
          {shockResult && (
            <span className="ios-footnote" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ios-label-2)" }}>
              <span style={{ width: 16, height: 3, background: "var(--ios-red)", display: "inline-block", borderRadius: 2, opacity: 0.85 }} />
              −{parseInt(shockPct, 10)}% shock at {shockAge}
            </span>
          )}
          {showMC && (
            <span className="ios-footnote" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ios-label-2)" }}>
              <span style={{ width: 16, height: 8, background: "var(--ios-finance)", display: "inline-block", borderRadius: 2, opacity: 0.2 }} />
              10–90% range
            </span>
          )}
        </div>

        {/* Shock outcome note */}
        {shockResult && (
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 8, lineHeight: 1.4 }}>
            With a one-time −{parseInt(shockPct, 10)}% market hit at age {shockAge}, the portfolio{" "}
            {shockResult.depletionAge != null
              ? <>now depletes at <strong style={{ color: "var(--ios-red)" }}>age {shockResult.depletionAge}</strong>.</>
              : <><strong style={{ color: "var(--ios-green)" }}>still survives</strong> your plan.</>}
          </div>
        )}
        {showMC && (
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 6, lineHeight: 1.4 }}>
            {MC_SIMS} simulations · returns drawn from N({Math.round(weightedReturn * 100)}%, {Math.round(MC_STDEV * 100)}%). Success rate{" "}
            <strong style={{ color: mc.successRate >= 0.8 ? "var(--ios-green)" : mc.successRate >= 0.5 ? "var(--ios-orange)" : "var(--ios-red)" }}>
              {Math.round(mc.successRate * 100)}%
            </strong>{" "}of plans keep a positive balance to age {profile.life_expectancy}.
          </div>
        )}
      </div>

      {/* Bridge job note */}
      {hasBridgeJob && (
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "7px 4px 0", lineHeight: 1.4 }}>
          Part-time / consulting income is modeled as a bridge job reducing portfolio withdrawals.
        </div>
      )}

      {/* Scenario comparison */}
      <div className="ios-group-header" style={{ padding: "16px 0 7px" }}>SCENARIO COMPARISON</div>
      <div className="ios-list" style={{ margin: 0 }}>
        <BarRows
          items={(
            [
              { key: "lean", label: "Lean & Purposeful", result: leanResult },
              { key: "balanced", label: "Balanced Living", result: balancedResult },
              { key: "abundant", label: "Abundant & Active", result: abundantResult },
            ] as const
          ).map(({ key, label, result: r }) => {
            const retirementYears = profile.life_expectancy - profile.retirement_age;
            const survivedYears =
              r.depletionAge != null
                ? Math.max(0, r.depletionAge - profile.retirement_age)
                : retirementYears;
            const active = scenario.selected_scenario === key;
            return {
              label: active ? `${label} · Current` : label,
              value: survivedYears,
              display:
                r.depletionAge != null
                  ? `Depletes age ${r.depletionAge}`
                  : `Survives to ${profile.life_expectancy}`,
              color: r.depletionAge != null ? "var(--ios-finance)" : "var(--ios-green)",
            };
          })}
        />
      </div>

      {/* Key age table */}
      <div className="ios-group-header" style={{ padding: "16px 0 7px" }}>PORTFOLIO AT KEY AGES</div>
      <div className="ios-list" style={{ margin: 0 }}>
        {tableAges.map((age) => {
          const val = portfolioByAge.get(age) ?? 0;
          const isRetired = age >= profile.retirement_age;
          const isDepleted = depletionAge != null && age >= depletionAge;
          return (
            <Cell
              key={age}
              chevron={false}
              title={
                <span className="ios-num">
                  Age {age}
                  {age === profile.retirement_age && (
                    <span className="ios-caption" style={{ color: "var(--ios-finance)", marginLeft: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      retire
                    </span>
                  )}
                </span>
              }
              subtitle={isRetired ? "Retirement" : "Accumulation"}
              trailing={
                <span
                  className="ios-num"
                  style={{ color: isDepleted ? "var(--ios-red)" : val > 0 ? "var(--ios-label)" : "var(--ios-label-2)" }}
                >
                  {isDepleted ? "Depleted" : fmtLarge(val)}
                </span>
              }
            />
          );
        })}
      </div>

      <div style={{ height: 12 }} />
    </div>
  );
}
