export const dynamic = "force-dynamic";

import { loadPlan } from "../retirement/actions";
import { buildTaxSnapshot } from "./_lib/snapshot";
import { LargeTitle } from "@/components/ios";
import TaxClient from "./_components/TaxClient";

export default async function TaxPage() {
  const plan = await loadPlan();

  if (!plan.profile || !plan.scenario) {
    return (
      <div className="ios-scroll">
        <LargeTitle title="Tax" subtitle="Your tax picture & strategy" />
        <div className="ios-list" style={{ margin: "8px 16px", padding: 18 }}>
          <div className="ios-subhead" style={{ color: "var(--ios-label)", lineHeight: 1.5 }}>
            Set up your <a href="/finance/retirement" style={{ color: "var(--ios-tint)" }}>retirement plan</a> first —
            your income, accounts and filing status power the tax analysis here.
          </div>
        </div>
      </div>
    );
  }

  const snapshot = buildTaxSnapshot(
    plan.profile, plan.accounts, plan.incomes, plan.expenses, plan.debts, plan.scenario,
  );

  return (
    <div className="ios-scroll">
      <LargeTitle title="Tax" subtitle="Your tax picture & strategy" />
      <div style={{ padding: "0 16px" }}>
        <a href="/finance/tax/estimate" className="ios-list" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "0 0 8px", padding: 16, textDecoration: "none" }}>
          <div>
            <div className="ios-headline" style={{ color: "var(--ios-label)" }}>Next-year tax estimator →</div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
              Model your refund or payment · upload W-2s &amp; prior returns · explore adjustments
            </div>
          </div>
          <span style={{ color: "var(--ios-label-3)", fontSize: 20 }}>›</span>
        </a>
        <TaxClient snapshot={snapshot} />
      </div>
      <p className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "8px 20px 0", lineHeight: 1.5 }}>
        Estimates based on the income and accounts in your retirement plan and a simplified tax model. Educational only —
        not tax advice. Confirm any move with a qualified CPA or tax attorney; limits and brackets change yearly.
      </p>
      <div style={{ height: 12 }} />
    </div>
  );
}
