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
