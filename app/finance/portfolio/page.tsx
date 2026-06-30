export const dynamic = "force-dynamic";

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
  source?: string | null;   // "import" | "manual" | "shared"
  is_shared?: boolean;
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

  const [plan, myManualResult, plaidResult, sharedManualResult, sharedPlaidResult] = await Promise.all([
    loadPlan(),
    // My own manually-entered and imported accounts
    service
      .schema("finance")
      .from("manual_accounts")
      .select("id, name, institution, account_type, balance, as_of_date, source")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    // My Plaid investment accounts
    service
      .schema("finance")
      .from("accounts")
      .select("id, name, subtype, current_balance, mask")
      .eq("user_id", user.id)
      .eq("type", "investment")
      .eq("is_hidden", false),
    // Manual accounts shared WITH this user by others
    service
      .schema("finance")
      .from("manual_account_shares")
      .select("id, account:manual_accounts(id, name, institution, account_type, balance, as_of_date)")
      .eq("recipient_user_id", user.id)
      .eq("accepted", true),
    // Plaid accounts shared WITH this user and opted into portfolio
    service
      .schema("finance")
      .from("account_shares")
      .select("account:accounts(id, name, subtype, current_balance, mask)")
      .eq("grantee_user_id", user.id)
      .eq("include_in_portfolio", true),
  ]);

  // Own manual + imported accounts
  const myManualItems: ManualItem[] = (myManualResult.data ?? []) as ManualItem[];

  // Shared manual accounts (flagged so UI can label them)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharedManualItems: ManualItem[] = ((sharedManualResult.data ?? []) as any[])
    .filter((r) => r.account)
    .map((r) => ({ ...r.account, source: "shared", is_shared: true }));

  const allManualItems = [...myManualItems, ...sharedManualItems];

  // Plaid investment accounts — exclude those already linked to a retirement account
  const linkedPlaidIds = new Set(
    (plan.accounts as RetirementAccount[])
      .map((a) => a.plaid_account_id)
      .filter(Boolean)
  );

  const plaidInvestmentAccounts: PlaidInvestmentAccount[] = [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((plaidResult.data ?? []) as any[]).filter((a) => !linkedPlaidIds.has(a.id)).map((a) => ({
      id: a.id,
      name: a.name,
      subtype: a.subtype,
      balance: a.current_balance ?? 0,
      mask: a.mask,
    })),
    // Plaid accounts shared with this user (opted in to portfolio)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((sharedPlaidResult.data ?? []) as any[])
      .filter((r) => r.account && !linkedPlaidIds.has(r.account.id))
      .map((r) => ({
        id: r.account.id,
        name: `${r.account.name} (shared)`,
        subtype: r.account.subtype,
        balance: r.account.current_balance ?? 0,
        mask: r.account.mask,
      })),
  ];

  const hasAlpaca = !!(
    process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET
  );

  return (
    <PortfolioClient
      retirementAccounts={plan.accounts as RetirementAccount[]}
      retirementDebts={plan.debts as RetirementDebt[]}
      hasProfile={!!plan.profile}
      manualItems={allManualItems}
      plaidInvestmentAccounts={plaidInvestmentAccounts}
      hasAlpaca={hasAlpaca}
    />
  );
}
