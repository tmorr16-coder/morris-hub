"use client";

import { useMemo, useState } from "react";
import type {
  RetirementProfile, RetirementAccount, RetirementIncome, RetirementExpense, RetirementDebt, RetirementScenario,
} from "../types";
import { yearCashflow, type CashflowItem } from "../_lib/cashflow";

interface Props {
  profile: RetirementProfile;
  accounts: RetirementAccount[];
  incomes: RetirementIncome[];
  expenses: RetirementExpense[];
  debts: RetirementDebt[];
  scenario: RetirementScenario;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

const KIND_DOT: Record<string, string> = {
  salary: "var(--ios-green)", bonus: "var(--ios-green)", stock_award: "#34C759", part_time: "#30D158",
  other: "#30D158", social_security: "var(--ios-tint)", pension: "var(--ios-orange)", match: "#5E5CE6",
  expense: "var(--ios-red)", loan: "#FF6B6B", lease: "#FF6B6B", scenario: "#C97A3A",
};

// Read the wall clock in a plain function (not directly in render) so the
// projection and inspector anchor to the same "now" without tripping purity rules.
function clockContext(): { nowMs: number; currentYear: number } {
  const d = new Date();
  return { nowMs: d.getTime(), currentYear: d.getFullYear() };
}

export default function CashflowInspector({ profile, accounts, incomes, expenses, debts, scenario }: Props) {
  const { nowMs, currentYear } = useMemo(() => clockContext(), []);
  const [year, setYear] = useState<number>(() => clockContext().currentYear);

  const years = useMemo(
    () => Array.from({ length: profile.life_expectancy - profile.current_age + 1 }, (_, i) => currentYear + i),
    [currentYear, profile.life_expectancy, profile.current_age]
  );

  const selectedAge = profile.current_age + (year - currentYear);
  const cf = useMemo(
    () => yearCashflow({ profile, accounts, incomes, expenses, debts, scenario }, selectedAge, nowMs, currentYear),
    [profile, accounts, incomes, expenses, debts, scenario, selectedAge, nowMs, currentYear]
  );

  const drawdown = cf.isRetired ? Math.max(0, cf.totalOutflow - cf.totalInflow) : 0;
  // Income neither banked into the portfolio nor itemized as an expense — i.e.
  // living costs not yet entered. A large number here is the signal to add them.
  const untracked = cf.isRetired ? 0 : Math.max(0, cf.totalInflow - cf.savedToPortfolio - cf.totalOutflow);

  return (
    <div className="ios-list" style={{ margin: "0 0 8px", padding: 18 }}>
      {/* Header + year picker */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Annual cash flow
          </div>
          <div className="ios-subhead" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
            Age {selectedAge}{cf.isRetired ? " · retired" : " · working"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button aria-label="Previous year" onClick={() => setYear((y) => Math.max(years[0], y - 1))} style={stepBtn}>‹</button>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} style={yearSelect}>
            {years.map((y) => (
              <option key={y} value={y}>{y} · age {profile.current_age + (y - currentYear)}</option>
            ))}
          </select>
          <button aria-label="Next year" onClick={() => setYear((y) => Math.min(years[years.length - 1], y + 1))} style={stepBtn}>›</button>
        </div>
      </div>

      {/* Headline: estimated annual outflows for the selected year */}
      <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
        <Metric label="Total inflows" value={cf.totalInflow} color="var(--ios-green)" />
        <Metric label="Total outflows" value={cf.totalOutflow} color="var(--ios-red)" />
        <Metric
          label={cf.net >= 0 ? "Net surplus" : "Net shortfall"}
          value={Math.abs(cf.net)}
          color={cf.net >= 0 ? "var(--ios-green)" : "var(--ios-red)"}
          sign={cf.net >= 0 ? "+" : "−"}
        />
      </div>

      {/* Inflows */}
      <LedgerSection title="Inflows" items={cf.inflows} total={cf.totalInflow} totalLabel="Total inflows" />
      {/* Outflows */}
      <LedgerSection title="Outflows" items={cf.outflows} total={cf.totalOutflow} totalLabel="Total outflows" />

      {/* Estimated taxes — informational */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--ios-separator)" }}>
        <span className="ios-subhead" style={{ color: "var(--ios-label)" }}>Estimated income taxes</span>
        <span className="ios-num ios-subhead" style={{ fontWeight: 700, color: "var(--ios-label)" }}>
          {fmtMoney(cf.estimatedTax)}
          {cf.totalInflow > 0 && (
            <span className="ios-footnote" style={{ color: "var(--ios-label-2)", fontWeight: 400 }}>
              {" "}· {((cf.estimatedTax / (cf.isRetired ? Math.max(cf.totalOutflow, cf.totalInflow) : cf.totalInflow)) * 100).toFixed(0)}%
            </span>
          )}
        </span>
      </div>
      <div className="ios-footnote" style={{ color: "var(--ios-label-3)", marginTop: 4 }}>
        Federal brackets + state, on this year&apos;s income. Estimate for planning — not drawn from the portfolio here.
      </div>

      {/* Reconciliation note — how the year affects the portfolio */}
      <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 14, lineHeight: 1.5, paddingTop: 12, borderTop: "1px solid var(--ios-separator)" }}>
        {cf.isRetired ? (
          drawdown > 0 ? (
            <>Retired: outflows exceed income by <strong style={{ color: "var(--ios-red)" }}>{fmtMoney(drawdown)}</strong>, drawn from the portfolio this year.</>
          ) : (
            <>Retired: income covers spending — nothing drawn from the portfolio this year.</>
          )
        ) : (
          <>
            Working year: <strong style={{ color: "var(--ios-green)" }}>{fmtMoney(cf.savedToPortfolio)}</strong> is banked into
            the portfolio (contributions + employer match + bonuses/stock).{" "}
            {untracked > 1000 ? (
              <>About <strong style={{ color: "var(--ios-orange)" }}>{fmtMoney(untracked)}</strong> of income isn&apos;t
              itemized as an expense yet — add your living costs above so spending is fully accounted for.</>
            ) : (
              <>Entered outflows are covered by income and only draw on savings if they exceed it.</>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, color, sign }: { label: string; value: number; color: string; sign?: string }) {
  return (
    <div>
      <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 4 }}>{label}</div>
      <div className="ios-num" style={{ fontSize: 22, fontWeight: 700, color }}>{sign}{fmtMoney(value)}</div>
    </div>
  );
}

function LedgerSection({ title, items, total, totalLabel }: { title: string; items: CashflowItem[]; total: number; totalLabel: string }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="ios-group-header" style={{ padding: "0 0 6px" }}>{title}</div>
      {items.length === 0 ? (
        <div className="ios-footnote" style={{ color: "var(--ios-label-3)", padding: "2px 0" }}>None this year.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map((it, i) => (
            <div key={`${it.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--ios-separator)" }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: KIND_DOT[it.kind] ?? "var(--ios-label-3)", flexShrink: 0 }} />
              <span className="ios-subhead" style={{ flex: 1, minWidth: 0, color: "var(--ios-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
              <span className="ios-num ios-subhead" style={{ color: "var(--ios-label)", fontWeight: 600 }}>{fmtMoney(it.amount)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8 }}>
        <span className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{totalLabel}</span>
        <span className="ios-num ios-subhead" style={{ fontWeight: 700 }}>{fmtMoney(total)}</span>
      </div>
    </div>
  );
}

const stepBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, background: "var(--ios-fill)", color: "var(--ios-tint)",
  fontSize: 20, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};

const yearSelect: React.CSSProperties = {
  padding: "8px 10px", border: "1px solid var(--ios-separator)", borderRadius: 8,
  background: "var(--ios-bg)", color: "var(--ios-label)", fontSize: 15, outline: "none",
};
