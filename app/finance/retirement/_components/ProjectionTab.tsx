"use client";

import type { RetirementProfile, RetirementAccount, RetirementIncome, RetirementScenario } from "../types";

interface Props {
  profile: RetirementProfile;
  accounts: RetirementAccount[];
  incomes: RetirementIncome[];
  scenario: RetirementScenario;
}

interface ProjectionResult {
  portfolioByAge: Map<number, number>;
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
  const portfolioByAge = new Map<number, number>();
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
        const endAge = inc.end_age ?? (profile.retirement_age - 1);
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
  }

  if (nestEgg === 0) {
    nestEgg = portfolioByAge.get(profile.retirement_age) ?? 0;
  }

  const safeMonthlyWithdrawal = (nestEgg * 0.04) / 12;
  const runway =
    depletionAge != null ? depletionAge - profile.retirement_age : "lifetime";

  return { portfolioByAge, nestEgg, safeMonthlyWithdrawal, depletionAge, runway, baseAnnualSpend };
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

const KEY_AGES = [0, 5, 10, 15, 20, 25];

export default function ProjectionTab({ profile, accounts, incomes, scenario }: Props) {
  const result = project(profile, accounts, incomes, scenario);
  const { portfolioByAge, nestEgg, safeMonthlyWithdrawal, depletionAge, runway, baseAnnualSpend } =
    result;

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
  const PADDING = { top: 24, right: 24, bottom: 40, left: 72 };
  const chartW = W - PADDING.left - PADDING.right;
  const chartH = H - PADDING.top - PADDING.bottom;

  const ages = Array.from({ length: profile.life_expectancy - profile.current_age + 1 }, (_, i) => profile.current_age + i);
  const values = ages.map((a) => portfolioByAge.get(a) ?? 0);
  const maxVal = Math.max(...values, 1);

  function xPos(age: number) {
    return PADDING.left + ((age - profile.current_age) / (profile.life_expectancy - profile.current_age)) * chartW;
  }

  function yPos(val: number) {
    return PADDING.top + chartH - (val / maxVal) * chartH;
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

  return (
    <div>
      {/* Metric cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <MetricCard
          label="Nest egg at retirement"
          value={fmtLarge(nestEgg)}
          sub={`at age ${profile.retirement_age}`}
        />
        <MetricCard
          label="Safe monthly withdrawal"
          value={fmtMoney(safeMonthlyWithdrawal)}
          sub="4% rule"
        />
        <MetricCard
          label="Portfolio depletion"
          value={depletionAge != null ? `Age ${depletionAge}` : "Outlives plan"}
          sub={depletionAge != null ? "funds exhausted" : "surplus at end of life"}
          valueColor={depletionAge != null ? "var(--color-red)" : "var(--color-green)"}
        />
        <MetricCard
          label="Retirement runway"
          value={runway === "lifetime" ? "Lifetime" : `${runway} years`}
          sub={runway === "lifetime" ? "portfolio survives" : "from retirement"}
        />
      </div>

      {/* Gap / surplus alert */}
      {nestEgg > 0 && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            background:
              gap > 0
                ? "rgba(180, 130, 40, 0.08)"
                : "rgba(60, 130, 80, 0.08)",
            border: `1px solid ${gap > 0 ? "rgba(180,130,40,0.3)" : "rgba(60,130,80,0.3)"}`,
            marginBottom: 24,
            fontSize: 13,
            color: gap > 0 ? "#8B6A00" : "var(--color-green)",
            lineHeight: 1.5,
          }}
        >
          {gap > 0 ? (
            <>
              <strong>Gap: {fmtMoney(gapMonthly)}/mo</strong> — your projected safe withdrawal falls short of your planned spend.
              Consider extending contributions, reducing scenario spend, or delaying retirement.
            </>
          ) : (
            <>
              <strong>Surplus: {fmtMoney(Math.abs(gapMonthly))}/mo</strong> — your plan is on track. The 4% rule supports your lifestyle scenario.
            </>
          )}
        </div>
      )}

      {/* SVG Chart */}
      <div
        style={{
          background: "var(--color-paper-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "20px",
          boxShadow: "var(--shadow-card)",
          marginBottom: 24,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-ink-3)",
            marginBottom: 12,
          }}
        >
          Portfolio projection
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          aria-label="Portfolio projection chart"
        >
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
                  stroke="var(--color-rule)"
                  strokeWidth="1"
                  strokeDasharray={i === 0 ? undefined : "4,4"}
                />
                <text
                  x={PADDING.left - 6}
                  y={parseFloat(y) + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--color-ink-3)"
                  fontFamily="var(--font-geist-mono, monospace)"
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
                  stroke="var(--color-bronze)"
                  strokeWidth="1.5"
                  strokeDasharray="6,4"
                  opacity="0.7"
                />
                <text
                  x={xPos(profile.retirement_age) + 4}
                  y={PADDING.top + 12}
                  fontSize="10"
                  fill="var(--color-bronze-dark)"
                  fontFamily="var(--font-geist, system-ui)"
                >
                  Retire {profile.retirement_age}
                </text>
              </g>
            )}

          {/* Path: pre-retirement (green) */}
          {preRetirementPoints.length > 1 && (
            <path
              d={toPath(preRetirementPoints)}
              fill="none"
              stroke="var(--color-green)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Path: retirement healthy (bronze) */}
          {healthyRetiredPoints.length > 1 && (
            <path
              d={toPath(healthyRetiredPoints)}
              fill="none"
              stroke="var(--color-bronze)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Path: depleted (red) */}
          {depletedPoints.length > 1 && (
            <path
              d={toPath(depletedPoints)}
              fill="none"
              stroke="var(--color-red)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

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
                fill="var(--color-ink-3)"
                fontFamily="var(--font-geist, system-ui)"
              >
                {a}
              </text>
            );
          })}

          {/* Dot at retirement */}
          {profile.retirement_age >= profile.current_age &&
            profile.retirement_age <= profile.life_expectancy && (
              <circle
                cx={xPos(profile.retirement_age).toFixed(1)}
                cy={yPos(portfolioByAge.get(profile.retirement_age) ?? 0).toFixed(1)}
                r="4"
                fill="var(--color-bronze)"
              />
            )}

          {/* Dot at depletion */}
          {depletionAge != null && (
            <circle
              cx={xPos(depletionAge).toFixed(1)}
              cy={yPos(0).toFixed(1)}
              r="4"
              fill="var(--color-red)"
            />
          )}
        </svg>

        {/* Legend */}
        <div style={{ display: "flex", gap: 20, marginTop: 10, fontSize: 11, color: "var(--color-ink-3)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 16, height: 3, background: "var(--color-green)", display: "inline-block", borderRadius: 2 }} />
            Accumulation
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 16, height: 3, background: "var(--color-bronze)", display: "inline-block", borderRadius: 2 }} />
            Drawdown
          </span>
          {depletionAge != null && (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 16, height: 3, background: "var(--color-red)", display: "inline-block", borderRadius: 2 }} />
              Depleted
            </span>
          )}
        </div>
      </div>

      {/* Scenario comparison */}
      <div
        style={{
          background: "var(--color-paper-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "20px 24px",
          boxShadow: "var(--shadow-card)",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-ink-3)",
            marginBottom: 16,
          }}
        >
          Scenario comparison
        </div>
        {(
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
          const pct = retirementYears > 0 ? (survivedYears / retirementYears) * 100 : 0;
          const active = scenario.selected_scenario === key;
          return (
            <div key={key} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: active ? "var(--color-ink)" : "var(--color-ink-3)",
                  fontWeight: active ? 600 : 400,
                  marginBottom: 5,
                }}
              >
                <span>{label}</span>
                <span className="mono">
                  {r.depletionAge != null
                    ? `Depletes age ${r.depletionAge}`
                    : "Survives to " + profile.life_expectancy}
                </span>
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 5,
                  background: "var(--color-paper-deep)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, pct)}%`,
                    borderRadius: 5,
                    background: r.depletionAge != null ? "var(--color-bronze)" : "var(--color-green)",
                    transition: "width 300ms",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Key age table */}
      <div
        style={{
          background: "var(--color-paper-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "20px 24px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-ink-3)",
            marginBottom: 14,
          }}
        >
          Portfolio at key ages
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--color-ink-3)",
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--color-rule)",
                }}
              >
                Age
              </th>
              <th
                style={{
                  textAlign: "left",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--color-ink-3)",
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--color-rule)",
                }}
              >
                Phase
              </th>
              <th
                style={{
                  textAlign: "right",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--color-ink-3)",
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--color-rule)",
                }}
              >
                Portfolio value
              </th>
            </tr>
          </thead>
          <tbody>
            {tableAges.map((age) => {
              const val = portfolioByAge.get(age) ?? 0;
              const isRetired = age >= profile.retirement_age;
              const isDepleted = depletionAge != null && age >= depletionAge;
              return (
                <tr key={age} style={{ borderBottom: "1px solid var(--color-rule)" }}>
                  <td className="mono" style={{ padding: "10px 0", fontSize: 14, color: "var(--color-ink)", fontWeight: age === profile.retirement_age ? 600 : 400 }}>
                    {age}
                    {age === profile.retirement_age && (
                      <span style={{ fontSize: 9, color: "var(--color-bronze-dark)", marginLeft: 6, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        retire
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 0", fontSize: 12, color: "var(--color-ink-3)" }}>
                    {isRetired ? "Retirement" : "Accumulation"}
                  </td>
                  <td
                    className="mono"
                    style={{
                      padding: "10px 0",
                      fontSize: 14,
                      textAlign: "right",
                      fontWeight: 500,
                      color: isDepleted
                        ? "var(--color-red)"
                        : val > 0
                        ? "var(--color-ink)"
                        : "var(--color-ink-3)",
                    }}
                  >
                    {isDepleted ? "Depleted" : fmtLarge(val)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  valueColor = "var(--color-ink)",
}: {
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-paper-card)",
        border: "1px solid var(--color-rule)",
        borderRadius: 12,
        padding: "18px 20px",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 500, color: valueColor, lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}
