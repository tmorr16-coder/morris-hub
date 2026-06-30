export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireFinanceAccess } from "@/lib/finance/access";
import { createServiceClient } from "@/lib/supabase/server";
import { loadPlan } from "../retirement/actions";
import type { RetirementAccount, RetirementDebt } from "../retirement/types";
import PortfolioClient from "./_components/PortfolioClient";

export interface ManualItem {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  balance: number;
  as_of_date: string | null;
}

export interface PlaidInvestmentAccount {
  id: string;
  name: string;
  subtype: string | null;
  balance: number;
  mask: string | null;
}

export default async function PortfolioPage() {
  const { user } = await requireFinanceAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const [plan, manualResult, plaidResult] = await Promise.all([
    loadPlan(),
    service
      .schema("finance")
      .from("manual_accounts")
      .select("id, name, institution, account_type, balance, as_of_date")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    // Plaid investment accounts — shown separately if not already in retirement planner
    service
      .schema("finance")
      .from("accounts")
      .select("id, name, subtype, current_balance, mask")
      .eq("user_id", user.id)
      .eq("type", "investment")
      .eq("is_hidden", false),
  ]);

  const manualItems: ManualItem[] = (manualResult.data ?? []) as ManualItem[];

  // Plaid investment accounts not already linked in the retirement planner
  const linkedPlaidIds = new Set(
    (plan.accounts as RetirementAccount[])
      .map((a) => a.plaid_account_id)
      .filter(Boolean)
  );
  const plaidInvestmentAccounts: PlaidInvestmentAccount[] = (
    (plaidResult.data ?? []) as Array<{
      id: string; name: string; subtype: string | null;
      current_balance: number | null; mask: string | null;
    }>
  )
    .filter((a) => !linkedPlaidIds.has(a.id))
    .map((a) => ({
      id: a.id,
      name: a.name,
      subtype: a.subtype,
      balance: a.current_balance ?? 0,
      mask: a.mask,
    }));

  const hasAlpaca = !!(
    process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET
  );

  return (
    <PortfolioClient
      retirementAccounts={plan.accounts as RetirementAccount[]}
      retirementDebts={plan.debts as RetirementDebt[]}
      hasProfile={!!plan.profile}
      manualItems={manualItems}
      plaidInvestmentAccounts={plaidInvestmentAccounts}
      hasAlpaca={hasAlpaca}
    />
  );
}
