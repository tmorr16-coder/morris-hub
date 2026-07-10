"use client";

import { useState } from "react";
import { Cell, Chip, Sparkline, BarRows, RadialGauge } from "@/components/ios";
import type { RetirementProfile, RetirementAccount, RetirementIncome, RetirementScenario } from "../types";

interface Props {
  profile: RetirementProfile;
  accounts: RetirementAccount[];
  incomes: RetirementIncome[];
  scenario: RetirementScenario;
}

interface ProjectionResult {
  portfolioByAge: Map<number, number>;
  jobIncomeByAge: Map<number, number>;    // salary pre-ret + bridge/part_time post-ret (annual $)
  ssIncomeByAge: Map<number, number>;     // Social Security income (annual $)
  pensionIncomeByAge: Map<number, number>;
  expensesByAge: Map<number, number>;     // annual expenses post-retirement only
  nestEgg: number;
  safeMonthlyWithdrawal: number;
  depletionAge: number | null;
  runway: number | string;
  baseAnnualSpend: number;
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

function project(
  profile: RetirementProfile,
  accounts: RetirementAccount[],
  incomes: RetirementIncome[],
  scenario: RetirementScenario
): ProjectionResult {
  const monthlySpend = getSelectedSpend(scenario);
  const baseAnnualSpend =
    monthlySpend * 12 + scenario.annual_travel + scenario.monthly_health_premium * 12;

  let portfolio = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const portfolioByAge    = new Map<number, number>();
  const jobIncomeByAge    = new Map<number, number>();
  const ssIncomeByAge     = new Map<number, number>();
  const pensionIncomeByAge = new Map<number, number>();
  const expensesByAge     = new Map<number, number>();
  let nestEgg = 0;
  let depletionAge: number | null = null;

  const totalBal = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const weightedReturn =
    totalBal > 0
      ? accounts.reduce(
          (s, a) =>
            s + ((a.balance ?? 0) / totalBal) * (a.return_override ?? profile.base_return),
          0
        )
      : profile.base_return;

  for (let age = profile.current_age; age <= profile.life_expectancy; age++) {
    const yearsFromNow = age - profile.current_age;
    const isRetired = age >= profile.retirement_age;

    if (age === profile.retirement_age) {
      portfolio += scenario.housing_windfall;
      nestEgg = portfolio;
    }

    if (age > profile.current_age) {
      portfolio *= 1 + weightedReturn;
    }

    if (!isRetired) {
      portfolio += accounts.reduce(
        (s, a) => s + a.monthly_contribution * 12 * (1 + a.employer_match_pct / 100),
        0
      );
      // Bonuses and vesting stock awards add to the portfolio during employment.
      // Growth rate is applied so the bonus compounds with salary over time.
      for (const inc of incomes) {
        if (inc.type !== "bonus" && inc.type !== "stock_award") continue;
        const startAge = inc.start_age ?? profile.current_age;
        const endAge = inc.end_age ?? (
          inc.type === "stock_award" && inc.vest_years != null
            ? startAge + inc.vest_years       // vest_years defines the window
            : profile.retirement_age - 1      // default: through end of career
        );
        if (age < startAge || age > endAge) continue;
        const yearsIntoGrant = age - startAge;
        const growthFactor = inc.annual_growth_pct
          ? Math.pow(1 + inc.annual_growth_pct / 100, yearsIntoGrant)
          : 1;
        portfolio += inc.monthly_amount * growthFactor; // monthly_amount stores annual amount for these types
      }
    } else {
      const inflFactor = Math.pow(1 + profile.inflation_rate, yearsFromNow);
      const adjSpend = baseAnnualSpend * inflFactor;

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

      const netWithdrawal = Math.max(0, adjSpend - retirementIncome);
      portfolio = Math.max(0, portfolio - netWithdrawal);

      if (portfolio === 0 && depletionAge === null) {
        depletionAge = age;
      }
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
      const growth = inc.annual_growth_pct
        ? Math.pow(1 + inc.annual_growth_pct / 100, age - start)
        : 1;
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

    // Expenses (post-retirement only)
    expensesByAge.set(age, isRetired ? Math.round(baseAnnualSpend * inflFactor) : 0);
  }

  if (nestEgg === 0) {
    nestEgg = portfolioByAge.get(profile.retirement_age) ?? 0;
  }

  const safeMonthlyWithdrawal = (nestEgg * 0.04) / 12;
  const runway =
    depletionAge != null ? depletionAge - profile.retirement_age : "lifetime";

  return { portfolioByAge, jobIncomeByAge, ssIncomeByAge, pensionIncomeByAge, expensesByAge, nestEgg, safeMonthlyWithdrawal, depletionAge, runway, baseAnnualSpend };
}

function projectForScenario(
  profile: RetirementProfile,
  accounts: RetirementAccount[],
  incomes: RetirementIncome[],
  scenario: RetirementScenario,
  scenarioKey: "lean" | "balanced" | "abundant"
): { depletionAge: number | null; nestEgg: number } {
  const overrideScenario = { ...scenario, selected_scenario: scenarioKey };
  const r = project(profile, accounts, incomes, overrideScenario);
  return { depletionAge: r.depletionAge, nestEgg: r.nestEgg };
}

const SERIES = [
  { key: "portfolio" as const, label: "Portfolio balance", color: "var(--ios-finance)" },
  { key: "jobIncome" as const, label: "Job / bridge income", color: "var(--ios-green)" },
  { key: "ss" as const, label: "Social Security", color: "var(--ios-tint)" },
  { key: "pension" as const, label: "Pension", color: "var(--ios-orange)" },
  { key: "expenses" as const, label: "Annual expenses", color: "var(--ios-red)" },
];

export default function ProjectionTab({ profile, accounts, incomes, scenario }: Props) {
  const [shown, setShown] = useState<Record<string, boolean>>({
    portfolio: true, jobIncome: true, ss: true, pension: true, expenses: true,
  });
  function toggle(key: string) { setShown((s) => ({ ...s, [key]: !s[key] })); }

  const [hoveredAge, setHoveredAge] = useState<number | null>(null);

  const result = project(profile, accounts, incomes, scenario);
  const { portfolioByAge, jobIncomeByAge, ssIncomeByAge, pensionIncomeByAge, expensesByAge,
          nestEgg, safeMonthlyWithdrawal, depletionAge, runway } = result;

  const annualWithdrawalNeed = getSelectedSpend(scenario) * 12 + scenario.annual_travel + scenario.monthly_health_premium * 12;
  const safeAnnualWithdrawal = nestEgg * 0.04;
  const gap = annualWithdrawalNeed - safeAnnualWithdrawal;
  const gapMonthly = gap / 12;

  // Scenario comparison
  const leanResult = projectForScenario(profile, accounts, incomes, scenario, "lean");
  const balancedResult = projectForScenario(profile, accounts, incomes, scenario, "balanced");
  const abundantResult = projectForScenario(profile, accounts, incomes, scenario, "abundant");

  // SVG chart
  const W = 800;
  const H = 300;
  const PADDING = { top: 24, right: 80, bottom: 40, left: 72 }; // wider right for income axis
  const chartW = W - PADDING.left - PADDING.right;
  const chartH = H - PADDING.top - PADDING.bottom;

  const ages = Array.from({ length: profile.life_expectancy - profile.current_age + 1 }, (_, i) => profile.current_age + i);
  const values = ages.map((a) => portfolioByAge.get(a) ?? 0);

  // Y-axis scale: exclude housing_windfall spike so pre-retirement growth is visible.
  // The windfall adds to the portfolio at retirement age in one jump — if we include it
  // in maxVal the entire chart collapses to the bottom to make room for the spike.
  const windfallAmount = scenario.housing_windfall ?? 0;
  const valuesForScale = ages.map((a) => {
    const v = portfolioByAge.get(a) ?? 0;
    // Subtract windfall from the retirement-age value for scaling purposes only
    return a === profile.retirement_age && windfallAmount > 0 ? v - windfallAmount : v;
  });
  const maxValRaw = Math.max(...valuesForScale, 1);
  const maxVal = maxValRaw * 1.1; // 10% headroom

  // Right axis: income/expenses scale
  const incomeValues = ages.flatMap((a) => [
    jobIncomeByAge.get(a) ?? 0,
    ssIncomeByAge.get(a) ?? 0,
    pensionIncomeByAge.get(a) ?? 0,
    expensesByAge.get(a) ?? 0,
  ]);
  const maxIncome = Math.max(...incomeValues, 1);

  function xPos(age: number) {
    return PADDING.left + ((age - profile.current_age) / (profile.life_expectancy - profile.current_age)) * chartW;
  }

  function yPos(val: number) {
    return PADDING.top + chartH - (val / maxVal) * chartH;
  }

  function yPosIncome(val: number) {
    return PADDING.top + chartH - (val / maxIncome) * chartH;
  }

  function toIncomePath(map: Map<number, number>): string {
    return ages
      .map((a, i) => {
        const x = xPos(a).toFixed(1);
        const y = yPosIncome(map.get(a) ?? 0).toFixed(1);
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  }

  // Build path segments: pre-retirement (green), retirement with value (bronze), depleted (red)
  const preRetirementPoints = ages.filter((a) => a <= profile.retirement_age);
  const retiredPoints = ages.filter((a) => a >= profile.retirement_age);
  const depletedPoints = depletionAge != null ? retiredPoints.filter((a) => a >= depletionAge!) : [];
  const healthyRetiredPoints = depletionAge != null
    ? retiredPoints.filter((a) => a <= depletionAge!)
    : retiredPoints;

  function toPath(pts: number[]): string {
    return pts
      .map((a, i) => {
        const x = xPos(a).toFixed(1);
        const y = yPos(portfolioByAge.get(a) ?? 0).toFixed(1);
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  }

  // Y axis labels
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxVal * i) / yTicks);

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

  // Health hue for the headline sparkline / gauge — red when the portfolio runs
  // dry within the plan, green when it outlives the plan.
  const healthColor = depletionAge != null ? "var(--ios-red)" : "var(--ios-green)";

  // Plan-confidence ratio: share of retirement years the portfolio survives.
  const retirementSpan = profile.life_expectancy - profile.retirement_age;
  const survivedSpan =
    depletionAge != null ? Math.max(0, depletionAge - profile.retirement_age) : retirementSpan;
  const survivalRatio = retirementSpan > 0 ? Math.min(1, survivedSpan / retirementSpan) : 1;

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
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {SERIES.map((s) => (
            <Chip key={s.key} small selected={!!shown[s.key]} onClick={() => toggle(s.key)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color, display: "inline-block" }} />
                {s.label}
              </span>
            </Chip>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          aria-label="Portfolio projection chart"
          onMouseLeave={() => setHoveredAge(null)}
        >
          <defs>
            {/* Clip chart lines to the chart area — prevents windfall/income spikes from overflowing */}
            <clipPath id="chartArea">
              <rect x={PADDING.left} y={PADDING.top} width={chartW} height={chartH} />
            </clipPath>
          </defs>

          {/* Y axis grid lines + labels */}
          {yTickValues.map((val, i) => {
            const y = yPos(val).toFixed(1);
            return (
              <g key={i}>
                <line
                  x1={PADDING.left}
                  y1={y}
                  x2={W - PADDING.right}
                  y2={y}
                  stroke="var(--ios-separator)"
                  strokeWidth="1"
                  strokeDasharray={i === 0 ? undefined : "4,4"}
                />
                <text
                  x={PADDING.left - 6}
                  y={parseFloat(y) + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--ios-label-2)"
                >
                  {fmtLarge(val)}
                </text>
              </g>
            );
          })}

          {/* Retirement age vertical marker */}
          {profile.retirement_age > profile.current_age &&
            profile.retirement_age <= profile.life_expectancy && (
              <g>
                <line
                  x1={xPos(profile.retirement_age).toFixed(1)}
                  y1={PADDING.top}
                  x2={xPos(profile.retirement_age).toFixed(1)}
                  y2={H - PADDING.bottom}
                  stroke="var(--ios-finance)"
                  strokeWidth="1.5"
                  strokeDasharray="6,4"
                  opacity="0.7"
                />
                <text
                  x={xPos(profile.retirement_age) + 4}
                  y={PADDING.top + 12}
                  fontSize="10"
                  fill="var(--ios-finance)"
                >
                  Retire {profile.retirement_age}
                </text>
                {/* Windfall annotation — explains any spike at retirement */}
                {windfallAmount > 0 && (
                  <text
                    x={xPos(profile.retirement_age) + 4}
                    y={PADDING.top + 24}
                    fontSize="9"
                    fill="var(--ios-finance)"
                  >
                    +{fmtLarge(windfallAmount)} windfall
                  </text>
                )}
              </g>
            )}

          {/* All data lines clipped to chart area */}
          <g clipPath="url(#chartArea)">

          {/* Path: pre-retirement (accumulation) */}
          {shown["portfolio"] && preRetirementPoints.length > 1 && (
            <path
              d={toPath(preRetirementPoints)}
              fill="none"
              stroke="var(--ios-green)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Path: retirement healthy (drawdown) */}
          {shown["portfolio"] && healthyRetiredPoints.length > 1 && (
            <path
              d={toPath(healthyRetiredPoints)}
              fill="none"
              stroke="var(--ios-finance)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Path: depleted */}
          {shown["portfolio"] && depletedPoints.length > 1 && (
            <path
              d={toPath(depletedPoints)}
              fill="none"
              stroke="var(--ios-red)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* ── Income / expense series (right Y-axis scale) ── */}
          {shown["jobIncome"] && (
            <path
              d={toIncomePath(jobIncomeByAge)}
              fill="none"
              stroke="var(--ios-green)"
              strokeWidth="1.5"
              strokeDasharray="5 3"
              strokeLinecap="round"
            />
          )}
          {shown["ss"] && (
            <path
              d={toIncomePath(ssIncomeByAge)}
              fill="none"
              stroke="var(--ios-tint)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )}
          {shown["pension"] && (
            <path
              d={toIncomePath(pensionIncomeByAge)}
              fill="none"
              stroke="var(--ios-orange)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )}
          {shown["expenses"] && (
            <path
              d={toIncomePath(expensesByAge)}
              fill="none"
              stroke="var(--ios-red)"
              strokeWidth="1.5"
              strokeDasharray="7 3"
              strokeLinecap="round"
            />
          )}

          </g>{/* end clipPath group */}

          {/* Right Y-axis: income/expense scale */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const val = maxIncome * pct;
            const y = yPosIncome(val).toFixed(1);
            return (
              <g key={`ri-${i}`}>
                <text
                  x={W - PADDING.right + 6}
                  y={+y + 4}
                  fontSize="9"
                  fill="var(--ios-label-3)"
                >
                  {fmtLarge(val)}
                </text>
              </g>
            );
          })}
          <text
            x={W - 10}
            y={PADDING.top + chartH / 2}
            fontSize="9"
            fill="var(--ios-label-3)"
            textAnchor="middle"
            transform={`rotate(-90, ${W - 10}, ${PADDING.top + chartH / 2})`}
          >
            Income / yr →
          </text>

          {/* X-axis age labels */}
          {[profile.current_age, profile.retirement_age, profile.life_expectancy].map((a) => {
            if (a < profile.current_age || a > profile.life_expectancy) return null;
            return (
              <text
                key={a}
                x={xPos(a).toFixed(1)}
                y={H - PADDING.bottom + 16}
                textAnchor="middle"
                fontSize="10"
                fill="var(--ios-label-2)"
              >
                {a}
              </text>
            );
          })}

          {/* Dot at retirement */}
          {shown["portfolio"] && profile.retirement_age >= profile.current_age &&
            profile.retirement_age <= profile.life_expectancy && (
              <circle
                cx={xPos(profile.retirement_age).toFixed(1)}
                cy={yPos(portfolioByAge.get(profile.retirement_age) ?? 0).toFixed(1)}
                r="4"
                fill="var(--ios-finance)"
              />
            )}

          {/* Dot at depletion */}
          {shown["portfolio"] && depletionAge != null && (
            <circle
              cx={xPos(depletionAge).toFixed(1)}
              cy={yPos(0).toFixed(1)}
              r="4"
              fill="var(--ios-red)"
            />
          )}

          {/* Hover detection: one transparent rect per age band */}
          {ages.map((age) => (
            <rect
              key={age}
              x={xPos(age) - chartW / (2 * Math.max(ages.length - 1, 1))}
              y={PADDING.top}
              width={chartW / Math.max(ages.length - 1, 1)}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoveredAge(age)}
            />
          ))}

          {/* Tooltip */}
          {hoveredAge != null && (() => {
            const tooltipLines: { label: string; val: string; color: string }[] = [
              { label: "Portfolio", val: fmtLarge(hoveredPortfolio ?? 0), color: "var(--ios-finance)" },
              ...(shown["jobIncome"] && (hoveredJobIncome ?? 0) > 0
                ? [{ label: "Job income", val: fmtLarge(hoveredJobIncome ?? 0), color: "var(--ios-green)" }]
                : []),
              ...(shown["ss"] && (hoveredSS ?? 0) > 0
                ? [{ label: "Soc. Sec.", val: fmtLarge(hoveredSS ?? 0), color: "var(--ios-tint)" }]
                : []),
              ...(shown["pension"] && (hoveredPension ?? 0) > 0
                ? [{ label: "Pension", val: fmtLarge(hoveredPension ?? 0), color: "var(--ios-orange)" }]
                : []),
              ...(shown["expenses"] && (hoveredExpenses ?? 0) > 0
                ? [{ label: "Expenses", val: fmtLarge(hoveredExpenses ?? 0), color: "var(--ios-red)" }]
                : []),
            ];
            const tx = Math.min(xPos(hoveredAge) + 8, W - PADDING.right - 140);
            const ty = PADDING.top + 4;
            const boxH = 18 + tooltipLines.length * 15;
            return (
              <g>
                <line
                  x1={xPos(hoveredAge).toFixed(1)}
                  y1={PADDING.top}
                  x2={xPos(hoveredAge).toFixed(1)}
                  y2={H - PADDING.bottom}
                  stroke="var(--ios-label-3)"
                  strokeWidth="1"
                  strokeDasharray="3,3"
                  opacity="0.5"
                />
                <rect x={tx} y={ty} width={138} height={boxH} rx="6"
                  fill="var(--ios-cell)" stroke="var(--ios-separator)" strokeWidth="1" opacity="0.96" />
                <text x={tx + 10} y={ty + 12} fontSize="10" fontWeight="600"
                  fill="var(--ios-label)">
                  Age {hoveredAge}
                </text>
                {tooltipLines.map((line, li) => (
                  <text key={li} x={tx + 10} y={ty + 24 + li * 15} fontSize="10"
                    fill={line.color}>
                    {line.label}: {line.val}
                  </text>
                ))}
              </g>
            );
          })()}
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
        </div>
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
