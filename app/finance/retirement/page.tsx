export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireFinanceAccess } from "@/lib/finance/access";
import { loadPlan } from "./actions";
import RetirementClient from "./_components/RetirementClient";

export default async function RetirementPage() {
  const plan = await loadPlan();

  return (
    <div>
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 28px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 className="serif" style={{ fontSize: 36, marginBottom: 8 }}>
            Retirement{" "}
            <span style={{ fontStyle: "italic", color: "var(--color-bronze-dark)" }}>Planner</span>
          </h1>
          <p style={{ fontSize: 14, color: "var(--color-ink-3)", lineHeight: 1.6 }}>
            Model your retirement across accounts, income, expenses, and lifestyle scenarios.
          </p>
        </div>

        <RetirementClient
          profile={plan.profile}
          accounts={plan.accounts}
          incomes={plan.incomes}
          expenses={plan.expenses}
          debts={plan.debts}
          scenario={plan.scenario}
          plaidAccounts={plan.plaidAccounts}
        />
      </main>

      <footer
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "24px 28px",
          borderTop: "1px solid var(--color-rule)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--color-ink-3)",
        }}
      >
        <span>Secured · TLS · AES-256-GCM</span>
        <span>finance.morrisai.family</span>
      </footer>
    </div>
  );
}
