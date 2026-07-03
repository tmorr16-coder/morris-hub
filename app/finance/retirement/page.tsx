export const dynamic = "force-dynamic";

import { loadPlan } from "./actions";
import { LargeTitle } from "@/components/ios";
import RetirementClient from "./_components/RetirementClient";

export default async function RetirementPage() {
  const plan = await loadPlan();

  return (
    <div className="ios-scroll">
      <LargeTitle
        title="Retirement"
        subtitle="Model income, expenses & lifestyle scenarios"
      />

      <div style={{ padding: "0 16px" }}>
        <RetirementClient
          profile={plan.profile}
          accounts={plan.accounts}
          incomes={plan.incomes}
          expenses={plan.expenses}
          debts={plan.debts}
          scenario={plan.scenario}
          plaidAccounts={plan.plaidAccounts}
          savedAccounts={plan.savedAccounts}
          sharedAccounts={plan.sharedAccounts}
        />
      </div>

      <div style={{ height: 12 }} />
    </div>
  );
}
