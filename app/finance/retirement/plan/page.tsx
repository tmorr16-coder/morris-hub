export const dynamic = "force-dynamic";

// The retirement plan as a document. Every figure comes from the same engine
// the module's tabs use, run once on the server; the page is plain markup that
// prints to PDF from the browser, so it can be handed to a spouse, a parent or
// an advisor who will never open the app.

import Link from "next/link";
import { requireFinanceAccess } from "@/lib/finance/access";
import { loadPlan } from "../actions";
import { buildPlanReport, bucketLabel, fmtUSD, fmtCompact, fmtPct, type PlanReport } from "../_lib/plan-report";
import { bucketOf, type TaxBucket } from "../_lib/cashflow";
import { PlanToolbar, PlanNarrative } from "./PlanActions";
import styles from "./plan.module.css";

const INCOME_TYPE_LABEL: Record<string, string> = {
  salary: "Salary", social_security: "Social Security", pension: "Pension", bonus: "Bonus",
  stock_award: "Stock award", part_time: "Part-time", other: "Other",
};
const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  "401k": "401(k)", roth: "Roth IRA", roth_ira: "Roth IRA", traditional_ira: "Traditional IRA", ira: "IRA",
  hsa: "HSA", brokerage: "Brokerage", pension: "Pension", Other: "Other", other: "Other",
};
const BUCKET_COLOR: Record<TaxBucket, string> = { pretax: "#2f6f5e", roth: "#6aa88f", taxable: "#c9a44a", hsa: "#7a8ea6" };

function label(map: Record<string, string>, key: string): string {
  return map[key] ?? key.replace(/_/g, " ");
}
function ageWindow(start: number | null, end: number | null): string {
  if (start == null && end == null) return "Ongoing";
  return `${start ?? "now"} – ${end ?? "end"}`;
}

export default async function PlanDocumentPage() {
  const { user } = await requireFinanceAccess();
  const plan = await loadPlan();

  if (!plan.profile || !plan.scenario) {
    return (
      <div className="ios-scroll" style={{ padding: 16 }}>
        <div className={styles.doc}>
          <PlanToolbar />
          <h1 className={styles.title}>No plan yet</h1>
          <p className={styles.lede}>
            The document is built from the retirement plan. <Link href="/finance/retirement">Set up the plan</Link> first, then come back here.
          </p>
        </div>
      </div>
    );
  }

  const r: PlanReport = buildPlanReport({
    profile: plan.profile,
    accounts: plan.accounts,
    incomes: plan.incomes,
    expenses: plan.expenses,
    debts: plan.debts,
    scenario: plan.scenario,
  });
  const { profile, accounts, incomes, expenses, debts, scenario } = r.inputs;
  const p = r.projection;
  const mc = r.monteCarlo;

  const household = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "Household";
  const generated = new Date(r.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const lasts = p.depletionAge == null;
  const successGood = mc.successRate >= 0.8;

  return (
    <div className="ios-scroll" style={{ padding: "8px 8px 24px" }}>
      <article className={styles.doc}>
        <PlanToolbar />

        {/* ── Cover ─────────────────────────────────────────────────────── */}
        <header className={styles.cover}>
          <div className={styles.eyebrow}>Retirement plan</div>
          <h1 className={styles.title}>{household}</h1>
          <p className={styles.subtitle}>
            Prepared {generated} · retiring at {profile.retirement_age} in {r.retirementYear} · planned through age {profile.life_expectancy} ({r.planEndYear})
            {profile.spouse_enabled && profile.spouse_name ? ` · with ${profile.spouse_name}` : ""}
          </p>
        </header>

        {/* ── Headline ─────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.h2}>At a glance</h2>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Nest egg at {profile.retirement_age}</div>
              <div className={styles.statValue}>{fmtCompact(p.nestEgg)}</div>
              <div className={styles.statNote}>{fmtCompact(r.nestEggReal)} in today&rsquo;s dollars</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Safe withdrawal</div>
              <div className={styles.statValue}>{fmtUSD(p.safeMonthlyWithdrawal)}<span className={styles.muted} style={{ fontSize: 13 }}>/mo</span></div>
              <div className={styles.statNote}>4% of the nest egg, first year</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Lasts until</div>
              <div className={`${styles.statValue} ${lasts ? styles.good : styles.bad}`}>{lasts ? `Age ${profile.life_expectancy}` : `Age ${p.depletionAge}`}</div>
              <div className={styles.statNote}>{lasts ? `Ends with ${fmtCompact(p.finalBalance)}` : `${p.depletionAge! - profile.retirement_age} years of retirement funded`}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Chance of success</div>
              <div className={`${styles.statValue} ${successGood ? styles.good : styles.bad}`}>{fmtPct(mc.successRate, 0)}</div>
              <div className={styles.statNote}>400 market simulations</div>
            </div>
          </div>

          <div className={lasts && successGood ? styles.callout : styles.calloutWarn}>
            <strong>{lasts ? "On the expected path the money lasts." : `On the expected path the money runs out at ${p.depletionAge}.`}</strong>{" "}
            In {fmtPct(mc.successRate, 0)} of simulated markets the portfolio never depletes
            {mc.failures > 0 && mc.medianDepletionAge != null
              ? `; when it does, it typically happens around age ${Math.round(mc.medianDepletionAge)}, and in the worst tenth of outcomes by ${Math.round(mc.earlyDepletionAge ?? mc.medianDepletionAge)}`
              : ""}.
            A bad-but-not-broken outcome (10th percentile) still ends with {fmtCompact(mc.p10Final)}; the median ends with {fmtCompact(mc.medianFinal)}.
          </div>
        </section>

        <PlanNarrative />

        {/* ── Household & assumptions ──────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.h2}>Household and assumptions</h2>
          <div className={styles.two}>
            <div>
              <table className={styles.table}>
                <tbody>
                  <tr><td>Current age</td><td className={styles.num}>{profile.current_age}</td></tr>
                  <tr><td>Retirement age</td><td className={styles.num}>{profile.retirement_age} ({r.retirementYear})</td></tr>
                  <tr><td>Plan horizon</td><td className={styles.num}>Age {profile.life_expectancy} ({r.planEndYear})</td></tr>
                  {profile.spouse_enabled && (
                    <tr><td>Spouse</td><td className={styles.num}>{profile.spouse_name ?? "—"}, age {profile.spouse_age ?? "—"}, retiring {profile.spouse_retirement_age ?? "—"}</td></tr>
                  )}
                  <tr><td>Tax filing</td><td className={styles.num}>{profile.spouse_enabled ? "Married filing jointly" : "Single"}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <table className={styles.table}>
                <tbody>
                  <tr><td>Return before retirement</td><td className={styles.num}>{fmtPct(p.weightedReturn)} <span className={styles.muted}>(balance-weighted)</span></td></tr>
                  <tr><td>Return in retirement</td><td className={styles.num}>{fmtPct(profile.retirement_return ?? p.weightedReturn)}</td></tr>
                  <tr><td>Inflation</td><td className={styles.num}>{fmtPct(profile.inflation_rate)}</td></tr>
                  <tr><td>State tax</td><td className={styles.num}>{(scenario.state_tax_rate ?? 5).toFixed(1)}%</td></tr>
                  <tr><td>Market volatility (simulation)</td><td className={styles.num}>12% a year, fat left tail</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Net worth today ──────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.h2}>Where things stand today</h2>
          <div className={styles.stats}>
            <div className={styles.stat}><div className={styles.statLabel}>Investable portfolio</div><div className={styles.statValue}>{fmtCompact(r.netWorth.portfolio)}</div></div>
            {r.netWorth.unvested > 0 && <div className={styles.stat}><div className={styles.statLabel}>Unvested stock</div><div className={styles.statValue}>{fmtCompact(r.netWorth.unvested)}</div><div className={styles.statNote}>not yet yours; not in the projection</div></div>}
            {r.netWorth.home > 0 && <div className={styles.stat}><div className={styles.statLabel}>Home</div><div className={styles.statValue}>{fmtCompact(r.netWorth.home)}</div></div>}
            <div className={styles.stat}><div className={styles.statLabel}>Debt</div><div className={`${styles.statValue} ${r.netWorth.debt > 0 ? styles.bad : ""}`}>{r.netWorth.debt > 0 ? `−${fmtCompact(r.netWorth.debt)}` : "None"}</div></div>
            <div className={styles.stat}><div className={styles.statLabel}>Net worth</div><div className={styles.statValue}>{fmtCompact(r.netWorth.total)}</div>{r.netWorth.unvested > 0 && <div className={styles.statNote}>{fmtCompact(r.netWorth.potential)} if all stock vests</div>}</div>
          </div>

          <p className={styles.lede} style={{ marginBottom: 4 }}>Tax character of the portfolio</p>
          <div className={styles.mix}>
            {(Object.keys(r.taxMixPct) as TaxBucket[]).map((k) => (
              r.taxMixPct[k] > 0 ? <div key={k} className={styles.mixSeg} style={{ width: `${r.taxMixPct[k] * 100}%`, background: BUCKET_COLOR[k] }} title={bucketLabel(k)} /> : null
            ))}
          </div>
          <div className={styles.legend}>
            {(Object.keys(r.taxMixPct) as TaxBucket[]).map((k) => (
              <span key={k}><span className={styles.swatch} style={{ background: BUCKET_COLOR[k] }} />{bucketLabel(k)} {fmtPct(r.taxMixPct[k], 0)} · {fmtCompact(r.taxMix[k])}</span>
            ))}
          </div>
          <p className={styles.statNote} style={{ marginTop: 8 }}>
            Withdrawals are sequenced taxable → pre-tax → Roth → HSA. Pre-tax money is taxed as income when withdrawn and subject to required distributions from age 73.
          </p>
        </section>

        {/* ── Accounts ─────────────────────────────────────────────────── */}
        <section className={`${styles.section} ${styles.sectionFlow}`}>
          <h2 className={styles.h2}>Accounts</h2>
          <p className={styles.lede}>Saving {fmtUSD(r.contributions.monthly)} a month ({fmtUSD(r.contributions.annual)} a year) before employer match.</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Account</th><th>Type</th><th>Tax</th><th>Owner</th><th className={styles.num}>Balance</th><th className={styles.num}>Monthly</th><th className={styles.num}>Match</th></tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}{a.plaid_account_id && <span className={styles.muted}> · linked</span>}{a.unvested_value ? <div className={styles.muted}>+ {fmtUSD(a.unvested_value)} unvested</div> : null}</td>
                    <td>{label(ACCOUNT_TYPE_LABEL, a.type)}</td>
                    <td>{bucketLabel(bucketOf(a))}</td>
                    <td>{a.owner}</td>
                    <td className={styles.num}>{fmtUSD(a.balance)}</td>
                    <td className={styles.num}>{a.monthly_contribution ? fmtUSD(a.monthly_contribution) : "—"}</td>
                    <td className={styles.num}>{a.employer_match_pct ? `${a.employer_match_pct}%` : "—"}</td>
                  </tr>
                ))}
                <tr className={styles.strong}><td colSpan={4}>Total</td><td className={styles.num}>{fmtUSD(r.netWorth.portfolio)}</td><td className={styles.num}>{fmtUSD(r.contributions.monthly)}</td><td /></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Income ───────────────────────────────────────────────────── */}
        <section className={`${styles.section} ${styles.sectionFlow}`}>
          <h2 className={styles.h2}>Income</h2>
          <p className={styles.lede}>
            In the first full year of retirement, Social Security, pensions and other retirement income cover {fmtUSD(r.retirementIncomeAtStart)} a year.
            The portfolio has to fund the remaining {fmtUSD(r.annualWithdrawalNeed)}; the 4% rule allows {fmtUSD(r.safeAnnualWithdrawal)}.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Source</th><th>Type</th><th>Owner</th><th className={styles.num}>Amount</th><th>When</th><th className={styles.num}>Growth</th></tr>
              </thead>
              <tbody>
                {incomes.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td>{label(INCOME_TYPE_LABEL, i.type)}</td>
                    <td>{i.owner}</td>
                    <td className={styles.num}>{fmtUSD(i.monthly_amount)} <span className={styles.muted}>{i.frequency === "annual" ? "/yr" : i.frequency === "one_time" ? "once" : "/mo"}</span></td>
                    <td>
                      {i.type === "social_security"
                        ? `Claim at ${i.ss_claim_age ?? i.start_age ?? profile.retirement_age}`
                        : i.type === "stock_award" && i.vest_years
                        ? `${i.start_age ?? profile.current_age} for ${i.vest_years} yrs`
                        : ageWindow(i.start_age, i.end_age)}
                    </td>
                    <td className={styles.num}>{i.annual_growth_pct ? `${i.annual_growth_pct}%/yr` : "—"}</td>
                  </tr>
                ))}
                {incomes.length === 0 && <tr><td colSpan={6} className={styles.muted}>No income entered.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Lifestyle & scenarios ────────────────────────────────────── */}
        <section className={`${styles.section} ${styles.sectionBreak}`}>
          <h2 className={styles.h2}>Retirement lifestyle</h2>
          <p className={styles.lede}>
            Planned spending of {fmtUSD(r.monthlySpend)} a month, plus {fmtUSD(scenario.annual_travel)} a year for travel and {fmtUSD(scenario.monthly_health_premium)} a month for healthcare — {fmtUSD(r.annualLifestyleSpend)} a year in today&rsquo;s dollars, growing with inflation.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Scenario</th><th className={styles.num}>Monthly spend</th><th className={styles.num}>Nest egg</th><th className={styles.num}>Money lasts</th></tr>
              </thead>
              <tbody>
                {r.scenarios.map((s) => (
                  <tr key={s.key} className={s.selected ? styles.rowMark : undefined}>
                    <td>{s.label}{s.selected && <span className={styles.muted}> · chosen</span>}</td>
                    <td className={styles.num}>{fmtUSD(s.monthlySpend)}</td>
                    <td className={styles.num}>{fmtCompact(s.nestEgg)}</td>
                    <td className={`${styles.num} ${s.depletionAge == null ? styles.good : styles.bad}`}>{s.depletionAge == null ? "Whole plan" : `To age ${s.depletionAge}`}</td>
                  </tr>
                ))}
                {scenario.selected_scenario === "custom" && (
                  <tr className={styles.rowMark}><td>Custom · chosen</td><td className={styles.num}>{fmtUSD(scenario.custom_monthly_spend)}</td><td className={styles.num}>{fmtCompact(p.nestEgg)}</td><td className={`${styles.num} ${lasts ? styles.good : styles.bad}`}>{lasts ? "Whole plan" : `To age ${p.depletionAge}`}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <table className={styles.table} style={{ marginTop: 14 }}>
            <tbody>
              <tr><td>Healthcare before 65</td><td className={styles.num}>{fmtUSD(scenario.health_premium_pre65 ?? scenario.monthly_health_premium)}/mo</td></tr>
              <tr><td>Healthcare from 65 (Medicare)</td><td className={styles.num}>{fmtUSD(scenario.health_premium_medicare ?? scenario.monthly_health_premium)}/mo</td></tr>
              {scenario.ltc_enabled && <tr><td>Long-term care</td><td className={styles.num}>{fmtUSD(scenario.ltc_monthly_cost ?? 0)}/mo for {scenario.ltc_years ?? "—"} years{scenario.ltc_start_age ? ` from ${scenario.ltc_start_age}` : ""}</td></tr>}
              {scenario.tithe_enabled && <tr><td>Giving</td><td className={styles.num}>{scenario.tithe_pct ?? 10}% of {scenario.tithe_basis ?? "gross"} income{(scenario.offering_monthly ?? 0) > 0 ? ` + ${fmtUSD(scenario.offering_monthly ?? 0)}/mo` : ""}</td></tr>}
              {scenario.survivor_enabled && <tr><td>Survivor transition</td><td className={styles.num}>At age {scenario.survivor_age ?? "—"}, spending {scenario.survivor_spend_pct ?? 75}%</td></tr>}
              {scenario.spending_smile_enabled && <tr><td>Spending curve</td><td className={styles.num}>Drifts down mid-retirement, back up late</td></tr>}
              {scenario.housing_windfall > 0 && <tr><td>Housing windfall at retirement</td><td className={styles.num}>{fmtUSD(scenario.housing_windfall)}</td></tr>}
              {r.roth && <tr><td>Roth conversions</td><td className={styles.num}>{fmtUSD(scenario.roth_convert_annual ?? 0)}/yr, ages {scenario.roth_convert_start_age ?? profile.retirement_age}–{scenario.roth_convert_end_age ?? 72}</td></tr>}
              {r.legacy && <tr><td>Legacy goal</td><td className={`${styles.num} ${r.legacy.met ? styles.good : styles.bad}`}>{fmtUSD(r.legacy.goal)} today&rsquo;s dollars · {r.legacy.met ? "met" : "not met"} ({fmtCompact(r.legacy.finalBalance)} vs {fmtCompact(r.legacy.goalNominal)} needed)</td></tr>}
            </tbody>
          </table>
        </section>

        {/* ── Outflows today ───────────────────────────────────────────── */}
        <section className={`${styles.section} ${styles.sectionFlow}`}>
          <h2 className={styles.h2}>Expenses and debts</h2>
          <p className={styles.lede}>
            Today: {fmtUSD(r.expenses.essentialMonthly)} a month essential, {fmtUSD(r.expenses.discretionaryMonthly)} discretionary, {fmtUSD(r.debtPayments.monthly)} in debt and lease payments.
            Items with an end date stop on that date; the rest continue through working years.
          </p>
          <div className={styles.two}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Expense</th><th className={styles.num}>Monthly</th><th>Until</th></tr></thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}><td>{e.name}{!e.essential && <span className={styles.muted}> · discretionary</span>}</td><td className={styles.num}>{fmtUSD(e.monthly_amount)}</td><td>{e.end_date ?? "—"}</td></tr>
                  ))}
                  {expenses.length === 0 && <tr><td colSpan={3} className={styles.muted}>None entered.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Debt</th><th className={styles.num}>Balance</th><th className={styles.num}>Payment</th></tr></thead>
                <tbody>
                  {debts.map((d) => (
                    <tr key={d.id}>
                      <td>{d.name}<div className={styles.muted}>{d.subtype === "lease" ? `Lease · ${d.lease_months_remaining ?? "—"} months left · ${d.lease_end_decision ?? "undecided"} at term` : `${d.type}${d.rate_pct != null ? ` · ${d.rate_pct}%` : ""}`}</div></td>
                      <td className={styles.num}>{d.subtype === "lease" ? "—" : fmtUSD(d.balance ?? 0)}</td>
                      <td className={styles.num}>{fmtUSD(d.subtype === "lease" ? d.lease_monthly_payment ?? 0 : d.monthly_payment ?? 0)}/mo</td>
                    </tr>
                  ))}
                  {debts.length === 0 && <tr><td colSpan={3} className={styles.muted}>None.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Stress tests ─────────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.h2}>Stress tests</h2>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>−20% market at {r.shock.age}</div>
              <div className={`${styles.statValue} ${r.shock.depletionAge == null ? styles.good : styles.bad}`}>{r.shock.depletionAge == null ? "Still lasts" : `Out at ${r.shock.depletionAge}`}</div>
              <div className={styles.statNote}>{r.shock.depletionAge == null ? `Ends with ${fmtCompact(r.shock.finalBalance)}` : "A crash in the first retirement year"}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Worst tenth of markets</div>
              <div className={`${styles.statValue} ${mc.earlyDepletionAge == null ? styles.good : styles.bad}`}>{mc.earlyDepletionAge == null ? "Lasts" : `Out by ${Math.round(mc.earlyDepletionAge)}`}</div>
              <div className={styles.statNote}>10th-percentile ending balance {fmtCompact(mc.p10Final)}</div>
            </div>
            {r.roth && (
              <div className={styles.stat}>
                <div className={styles.statLabel}>Roth conversions</div>
                <div className={`${styles.statValue} ${r.roth.saved >= 0 ? styles.good : styles.bad}`}>{r.roth.saved >= 0 ? `Save ${fmtCompact(r.roth.saved)}` : `Cost ${fmtCompact(-r.roth.saved)}`}</div>
                <div className={styles.statNote}>lifetime retirement tax + Medicare surcharges</div>
              </div>
            )}
          </div>
        </section>

        {/* ── Projection ───────────────────────────────────────────────── */}
        <section className={`${styles.section} ${styles.sectionBreak} ${styles.sectionFlow}`}>
          <h2 className={styles.h2}>Projection</h2>
          <p className={styles.lede}>Portfolio balance by age, in future dollars. The shaded band is the range between the 10th and 90th percentile of simulated markets; the solid line is the expected path.</p>
          <PathChart r={r} />
          <div className={styles.legend}>
            <span><span className={styles.swatch} style={{ background: "#2f6f5e" }} />Expected path</span>
            <span><span className={styles.swatch} style={{ background: "#c5dcd4", height: 10 }} />10th–90th percentile</span>
            <span><span className={styles.swatch} style={{ background: "#b3261e", height: 1, borderTop: "2px dashed #b3261e" }} />Retirement at {profile.retirement_age}</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.milestones}`} style={{ marginTop: 14 }}>
              <colgroup>
                <col style={{ width: "13%" }} /><col style={{ width: "8%" }} /><col style={{ width: "13%" }} /><col style={{ width: "12%" }} />
                <col style={{ width: "11%" }} /><col style={{ width: "10%" }} /><col style={{ width: "12%" }} /><col style={{ width: "11%" }} /><col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr><th>Age</th><th>Year</th><th className={styles.num}>Portfolio</th><th className={styles.num}>Work income</th><th className={styles.num}>Social Security</th><th className={styles.num}>Pension</th><th className={styles.num}>Spending &amp; tax</th><th className={styles.num}>Tax</th><th className={styles.num}>RMD</th></tr>
              </thead>
              <tbody>
                {r.milestones.map((m) => (
                  <tr key={m.age} className={m.note ? styles.rowMark : undefined}>
                    <td>{m.age}{m.note && <div className={styles.muted} style={{ fontWeight: 400 }}>{m.note}</div>}</td>
                    <td>{m.year}</td>
                    <td className={styles.num}>{fmtCompact(m.portfolio)}</td>
                    <td className={styles.num}>{m.jobIncome ? fmtCompact(m.jobIncome) : "—"}</td>
                    <td className={styles.num}>{m.ss ? fmtCompact(m.ss) : "—"}</td>
                    <td className={styles.num}>{m.pension ? fmtCompact(m.pension) : "—"}</td>
                    <td className={styles.num}>{fmtCompact(m.outflow)}</td>
                    <td className={styles.num}>{m.tax ? fmtCompact(m.tax) : "—"}</td>
                    <td className={styles.num}>{m.rmd ? fmtCompact(m.rmd) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.statNote}>Every fifth year is shown, plus the years where something changes. Before retirement, &ldquo;Spending &amp; tax&rdquo; is the entered outflows plus wage tax; after, it is lifestyle spending, healthcare, entered outflows, giving, income tax and Medicare surcharges.</p>
        </section>

        <p className={styles.fine}>
          Prepared from the retirement plan in morrisai.family on {generated}. Projections are estimates for planning and discussion only, and depend entirely on the assumptions listed above — returns, inflation, tax rules as they stand today, and the spending and income figures entered. Linked account balances are as of their last sync. This is not financial, tax, or investment advice; review it with a qualified professional before acting on it.
        </p>
      </article>
    </div>
  );
}

/** A print-safe SVG of the expected path with the simulation band behind it. */
function PathChart({ r }: { r: PlanReport }) {
  const { profile } = r.inputs;
  const W = 760, H = 240, PL = 58, PR = 12, PT = 12, PB = 28;
  const cw = W - PL - PR, ch = H - PT - PB;
  const ages = r.path.map((x) => x.age);
  const a0 = ages[0], a1 = ages[ages.length - 1];
  const maxV = Math.max(1, ...r.path.map((x) => x.value), ...r.monteCarlo.band.map((b) => b.p90));
  // Round the top of the axis to a clean number.
  const mag = Math.pow(10, Math.floor(Math.log10(maxV)));
  const top = Math.ceil(maxV / (mag / 2)) * (mag / 2);
  const x = (age: number) => PL + ((age - a0) / Math.max(1, a1 - a0)) * cw;
  const y = (v: number) => PT + ch - (Math.max(0, v) / top) * ch;
  const line = r.path.map((pt, i) => `${i === 0 ? "M" : "L"}${x(pt.age).toFixed(1)},${y(pt.value).toFixed(1)}`).join(" ");
  const band = r.monteCarlo.band;
  const bandPath = band.length
    ? band.map((b, i) => `${i === 0 ? "M" : "L"}${x(b.age).toFixed(1)},${y(b.p90).toFixed(1)}`).join(" ")
      + " " + band.slice().reverse().map((b) => `L${x(b.age).toFixed(1)},${y(b.p10).toFixed(1)}`).join(" ") + " Z"
    : "";
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  const ageTicks: number[] = [];
  for (let a = Math.ceil(a0 / 5) * 5; a <= a1; a += 5) ageTicks.push(a);
  return (
    <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projected portfolio balance by age">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="#e4e4e8" strokeWidth={1} />
          <text x={PL - 6} y={y(t) + 4} fontSize={10} fill="#8a8a8f" textAnchor="end">{fmtCompact(t)}</text>
        </g>
      ))}
      {bandPath && <path d={bandPath} fill="#c5dcd4" opacity={0.6} />}
      <line x1={x(profile.retirement_age)} x2={x(profile.retirement_age)} y1={PT} y2={PT + ch} stroke="#b3261e" strokeWidth={1.5} strokeDasharray="5 4" />
      <path d={line} fill="none" stroke="#2f6f5e" strokeWidth={2.25} strokeLinejoin="round" />
      {ageTicks.map((a) => (
        <text key={a} x={x(a)} y={H - 8} fontSize={10} fill="#8a8a8f" textAnchor="middle">{a}</text>
      ))}
    </svg>
  );
}
