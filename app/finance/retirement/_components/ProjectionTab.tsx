"use client";

import { useMemo, useState } from "react";
import { Cell, Chip, Segmented, Sparkline, BarRows, RadialGauge } from "@/components/ios";
import type { RetirementProfile, RetirementAccount, RetirementIncome, RetirementScenario, RetirementExpense, RetirementDebt } from "../types";
import { retirementIncomeAt } from "../_lib/cashflow";
import { buildCtx, returnForAge, runProjection, project, projectForScenario } from "../_lib/projection";

/** Earliest age retirement income meaningfully flows (SS claim age, else retirement). */
function ssStartAge(incomes: RetirementIncome[]): number {
  const ss = incomes.filter((i) => i.type === "social_security").map((i) => i.ss_claim_age ?? 67);
  return ss.length ? Math.min(...ss) : 0;
}

interface Props {
  profile: RetirementProfile;
  accounts: RetirementAccount[];
  incomes: RetirementIncome[];
  scenario: RetirementScenario;
  expenses: RetirementExpense[];
  debts: RetirementDebt[];
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
  // Display in today's (real) dollars vs future (nominal) dollars.
  const [realDollars, setRealDollars] = useState<boolean>(false);
  // Zoom: restrict the chart x-axis to an age window (y-axis rescales to fit).
  const [zoomStart, setZoomStart] = useState<number>(profile.current_age);
  const [zoomEnd, setZoomEnd] = useState<number>(profile.life_expectancy);

  const rawResult = project(profile, accounts, incomes, expenses, debts, scenario);

  // Deflator: nominal $ at `age` → today's dollars.
  const inflAt = (age: number) => Math.pow(1 + profile.inflation_rate, age - profile.current_age);
  const dv = (v: number, age: number) => (realDollars ? v / inflAt(age) : v);
  function deflateMap(m: Map<number, number>): Map<number, number> {
    if (!realDollars) return m;
    const r = new Map<number, number>();
    m.forEach((v, k) => r.set(k, v / inflAt(k)));
    return r;
  }

  // Legacy is judged on nominal figures (goal is today's-$ → nominal at end of plan),
  // independent of the display toggle.
  const lifeInflFactor = Math.pow(1 + profile.inflation_rate, profile.life_expectancy - profile.current_age);
  const legacyGoalNominal = (scenario.legacy_goal ?? 0) * lifeInflFactor;
  const hasLegacyGoal = (scenario.legacy_goal ?? 0) > 0;
  const legacyMetRaw = !hasLegacyGoal || rawResult.finalBalance >= legacyGoalNominal;

  // Net worth today (incl. home): investable portfolio + home value − all debts.
  // The home is NOT part of the spendable retirement portfolio above.
  const currentPortfolio = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const homeValue = scenario.home_value ?? 0;
  const totalDebt = debts.reduce((s, d) => s + (d.balance ?? 0), 0);
  const netWorth = currentPortfolio + homeValue - totalDebt;

  // Roth-conversion impact: compare the current plan (conversions on) with an
  // identical plan that skips them. Lifetime tax = income tax + IRMAA in retirement.
  const rothOn = !!scenario.roth_convert_enabled && (scenario.roth_convert_annual ?? 0) > 0;
  const noRothResult = useMemo(
    () => (rothOn ? project(profile, accounts, incomes, expenses, debts, { ...scenario, roth_convert_enabled: false }) : null),
    [rothOn, profile, accounts, incomes, expenses, debts, scenario],
  );
  const lifetimeTax = (r: typeof rawResult) => {
    let s = 0;
    for (let a = profile.retirement_age; a <= profile.life_expectancy; a++) s += (r.taxByAge.get(a) ?? 0) + (r.irmaaByAge.get(a) ?? 0);
    return s;
  };

  const result = realDollars ? {
    ...rawResult,
    portfolioByAge: deflateMap(rawResult.portfolioByAge),
    jobIncomeByAge: deflateMap(rawResult.jobIncomeByAge),
    ssIncomeByAge: deflateMap(rawResult.ssIncomeByAge),
    pensionIncomeByAge: deflateMap(rawResult.pensionIncomeByAge),
    expensesByAge: deflateMap(rawResult.expensesByAge),
    nestEgg: rawResult.nestEgg / inflAt(profile.retirement_age),
    safeMonthlyWithdrawal: rawResult.safeMonthlyWithdrawal / inflAt(profile.retirement_age),
    finalBalance: rawResult.finalBalance / inflAt(profile.life_expectancy),
  } : rawResult;

  const { portfolioByAge, jobIncomeByAge, ssIncomeByAge, pensionIncomeByAge, expensesByAge,
          nestEgg, safeMonthlyWithdrawal, depletionAge, runway, weightedReturn, finalBalance } = result;
  const legacyMet = legacyMetRaw;

  // Net need = lifestyle spend LESS the retirement income (SS/pension/bridge) that
  // covers part of it — the portfolio only has to fund the remainder. Evaluated at
  // the first full retirement year the income actually flows (SS often starts later).
  const grossAnnualNeed = getSelectedSpend(scenario) * 12 + scenario.annual_travel + scenario.monthly_health_premium * 12;
  const retIncomeAtRet = retirementIncomeAt(incomes, Math.max(profile.retirement_age, ssStartAge(incomes)), profile);
  const annualWithdrawalNeed = Math.max(0, grossAnnualNeed - retIncomeAtRet);
  const safeAnnualWithdrawal = nestEgg * 0.04;
  const gap = annualWithdrawalNeed - safeAnnualWithdrawal;
  const gapMonthly = gap / 12;
  // The plan actually falls short only if the detailed year-by-year model depletes.
  // Otherwise never contradict it with a "shortfall" headline.
  const showGap = gap > 0 && depletionAge != null;

  // Scenario comparison
  const leanResult = projectForScenario(profile, accounts, incomes, expenses, debts, scenario, "lean");
  const balancedResult = projectForScenario(profile, accounts, incomes, expenses, debts, scenario, "balanced");
  const abundantResult = projectForScenario(profile, accounts, incomes, expenses, debts, scenario, "abundant");

  const ages = Array.from({ length: zoomEnd - zoomStart + 1 }, (_, i) => zoomStart + i);
  const values = ages.map((a) => portfolioByAge.get(a) ?? 0);

  // ── Market-shock path (deterministic returns + one-year hit) ──────────────
  const shockFraction = parseInt(shockPct, 10) / 100;
  const shockResult = useMemo(() => {
    if (shockFraction <= 0) return null;
    const ctx = buildCtx(profile, accounts, incomes, expenses, debts, scenario);
    return runProjection(ctx, (age) => returnForAge(ctx, age), {
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
      const { byAge, final } = runProjection(ctx, (age) => returnForAge(ctx, age) + nextNormal(rng) * MC_STDEV);
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
    return PAD_L + ((age - zoomStart) / Math.max(1, zoomEnd - zoomStart)) * chartW;
  }

  // Panel A y-scale: exclude the housing-windfall spike so pre-retirement growth
  // stays visible; include the shock path and Monte-Carlo p90 when shown.
  const windfallAmount = scenario.housing_windfall ?? 0;
  const zBand = mc.band.filter((b) => b.age >= zoomStart && b.age <= zoomEnd);
  const scaleVals: number[] = ages.map((a) => {
    const v = portfolioByAge.get(a) ?? 0;
    return a === profile.retirement_age && windfallAmount > 0 ? v - dv(windfallAmount, profile.retirement_age) : v;
  });
  if (showMC) scaleVals.push(...zBand.map((b) => dv(b.p90, b.age)));
  if (shockResult) scaleVals.push(...ages.map((a) => dv(shockResult.byAge.get(a) ?? 0, a)));
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
    const top = zBand.map((b, i) => `${i === 0 ? "M" : "L"}${xPos(b.age).toFixed(1)},${yPosA(dv(b.p90, b.age)).toFixed(1)}`).join(" ");
    const bottom = zBand.slice().reverse().map((b) => `L${xPos(b.age).toFixed(1)},${yPosA(dv(b.p10, b.age)).toFixed(1)}`).join(" ");
    return `${top} ${bottom} Z`;
  })();
  const mcMedianPath = showMC
    ? zBand.map((b, i) => `${i === 0 ? "M" : "L"}${xPos(b.age).toFixed(1)},${yPosA(dv(b.p50, b.age)).toFixed(1)}`).join(" ")
    : "";

  const shockPath = shockResult
    ? ages.map((a, i) => `${i === 0 ? "M" : "L"}${xPos(a).toFixed(1)},${yPosA(dv(shockResult.byAge.get(a) ?? 0, a)).toFixed(1)}`).join(" ")
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
  const healthColor = depletionAge != null || !legacyMet ? "var(--ios-red)" : "var(--ios-green)";

  // Plan-confidence ratio: share of retirement years the portfolio survives, and
  // — if a legacy goal is set — whether the plan also funds that bequest.
  const retirementSpan = profile.life_expectancy - profile.retirement_age;
  const survivedSpan =
    depletionAge != null ? Math.max(0, depletionAge - profile.retirement_age) : retirementSpan;
  let survivalRatio = retirementSpan > 0 ? Math.min(1, survivedSpan / retirementSpan) : 1;
  if (depletionAge == null && hasLegacyGoal && !legacyMet) {
    survivalRatio = Math.min(survivalRatio, legacyGoalNominal > 0 ? finalBalance / legacyGoalNominal : 1);
  }

  const xLabelAges = [zoomStart, profile.retirement_age, Math.round((zoomStart + zoomEnd) / 2), zoomEnd]
    .filter((a, idx, arr) => a >= zoomStart && a <= zoomEnd && arr.indexOf(a) === idx)
    .sort((a, b) => a - b);

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
              {depletionAge != null
                ? `funds run out at ${depletionAge}`
                : !legacyMet
                  ? `ends below your ${fmtLarge(scenario.legacy_goal)} legacy goal`
                  : "outlives your plan"}
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

      {/* Net worth today (incl. home) */}
      {homeValue > 0 && (
        <div className="ios-list" style={{ margin: "0 0 8px", padding: 16 }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Net worth today · incl. home
          </div>
          <div className="ios-num" style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{fmtLarge(netWorth)}</div>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>
            Portfolio {fmtLarge(currentPortfolio)} + home {fmtLarge(homeValue)}
            {totalDebt > 0 ? <> − debts {fmtLarge(totalDebt)}</> : null}
            {scenario.home_address ? <span style={{ color: "var(--ios-label-3)" }}> · {scenario.home_address}</span> : null}
          </div>
        </div>
      )}

      {/* Roth-conversion impact */}
      {rothOn && noRothResult && (() => {
        const taxWith = lifetimeTax(rawResult);
        const taxWithout = lifetimeTax(noRothResult);
        const endWith = rawResult.finalBalance;
        const endWithout = noRothResult.finalBalance;
        const taxSaved = taxWithout - taxWith;
        return (
          <div className="ios-list" style={{ margin: "0 0 8px", padding: 16 }}>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Roth-conversion impact
            </div>
            <div className="ios-subhead" style={{ color: taxSaved >= 0 ? "var(--ios-green)" : "var(--ios-red)", marginTop: 4, lineHeight: 1.5 }}>
              <strong>{taxSaved >= 0 ? "Saves" : "Costs"} {fmtLarge(Math.abs(taxSaved))}</strong> in lifetime tax + IRMAA
              {" "}and ends with <strong>{fmtLarge(endWith - endWithout >= 0 ? endWith - endWithout : 0)}</strong> more.
            </div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 6 }}>
              Lifetime tax: {fmtLarge(taxWith)} with conversions vs {fmtLarge(taxWithout)} without · ending balance {fmtLarge(endWith)} vs {fmtLarge(endWithout)}
            </div>
          </div>
        );
      })()}

      {/* Gap / surplus callout */}
      {nestEgg > 0 && (
        <div className="ios-list" style={{ margin: "0 0 8px", padding: 16 }}>
          <div className="ios-subhead" style={{ color: "var(--ios-label)", lineHeight: 1.5 }}>
            {showGap ? (
              <>
                <strong style={{ color: "var(--ios-orange)" }}>Gap: {fmtMoney(gapMonthly)}/mo</strong> — after Social Security,
                pension and bridge income, your projected safe withdrawal still falls short and the plan depletes at{" "}
                {depletionAge}. Consider extending contributions, reducing scenario spend, or delaying retirement.
              </>
            ) : (
              <>
                <strong style={{ color: "var(--ios-green)" }}>On track</strong> — after Social Security, pension and bridge
                income, your portfolio {depletionAge != null ? "covers your plan" : "outlives your plan"} at this spending level.
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
        <Cell
          chevron={false}
          title="Estate at end of plan"
          subtitle={hasLegacyGoal ? (legacyMet ? `meets your ${fmtLarge(scenario.legacy_goal)} goal` : `below your ${fmtLarge(scenario.legacy_goal)} goal`) : "no legacy goal set"}
          trailing={
            <span className="ios-num" style={{ color: hasLegacyGoal ? (legacyMet ? "var(--ios-green)" : "var(--ios-red)") : "var(--ios-label)" }}>
              {fmtLarge(finalBalance)}
            </span>
          }
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
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>Dollars</span>
            <Chip small selected={realDollars} onClick={() => setRealDollars((v) => !v)}>
              {realDollars ? "Today's $" : "Future $"}
            </Chip>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>Zoom · ages</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="number" min={profile.current_age} max={zoomEnd - 1} value={zoomStart}
                onChange={(e) => setZoomStart(Math.max(profile.current_age, Math.min(zoomEnd - 1, parseInt(e.target.value) || profile.current_age)))}
                style={{ width: 56, padding: "6px 8px", border: "1px solid var(--ios-separator)", borderRadius: 8, background: "var(--ios-bg)", color: "var(--ios-label)", fontSize: 14, outline: "none" }} />
              <span className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>–</span>
              <input type="number" min={zoomStart + 1} max={profile.life_expectancy} value={zoomEnd}
                onChange={(e) => setZoomEnd(Math.min(profile.life_expectancy, Math.max(zoomStart + 1, parseInt(e.target.value) || profile.life_expectancy)))}
                style={{ width: 56, padding: "6px 8px", border: "1px solid var(--ios-separator)", borderRadius: 8, background: "var(--ios-bg)", color: "var(--ios-label)", fontSize: 14, outline: "none" }} />
              {(zoomStart !== profile.current_age || zoomEnd !== profile.life_expectancy) && (
                <button onClick={() => { setZoomStart(profile.current_age); setZoomEnd(profile.life_expectancy); }}
                  style={{ padding: 0, color: "var(--ios-tint)", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>Reset</button>
              )}
            </div>
          </div>
        </div>
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>
          {realDollars
            ? "Shown in today's dollars (inflation-adjusted) — what the money is worth in today's purchasing power."
            : "Shown in future (nominal) dollars. Toggle “Today's $” to see inflation-adjusted values."}
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
