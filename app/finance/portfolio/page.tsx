export const dynamic = "force-dynamic";

import { requireFinanceAccess } from "@/lib/finance/access";
import { createServiceClient } from "@/lib/supabase/server";
import { loadPlan } from "../retirement/actions";
import type { RetirementAccount, RetirementDebt } from "../retirement/types";
import { LargeTitle, Group, BarRows } from "@/components/ios";
import { hasAlpacaConnection } from "@/lib/alpaca";
import PortfolioClient from "./_components/PortfolioClient";

// Roll individual account types up into a handful of asset classes for the
// allocation chart. Anything unmapped falls into "Other".
const ASSET_CLASS: Record<string, string> = {
  "401k": "Retirement",
  "roth_ira": "Retirement",
  "traditional_ira": "Retirement",
  "pension": "Retirement",
  "hsa": "HSA",
  "brokerage": "Brokerage",
  "other_investment": "Investments",
  "real_estate": "Real estate",
  "crypto": "Crypto",
  "other": "Other",
};
function assetClass(type: string): string {
  return ASSET_CLASS[type] ?? "Other";
}
function fmtUSD(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

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
    // My own manually-entered and imported accounts — EXCLUDE retirement types
    // (401k, IRA, HSA, pension) since those come exclusively from the retirement planner.
    // Custom Additions should only contain non-retirement assets (brokerage, real estate, crypto, etc.)
    service
      .schema("finance")
      .from("manual_accounts")
      .select("id, name, institution, account_type, balance, as_of_date, source")
      .eq("user_id", user.id)
      .not("account_type", "in", '("401k","roth_ira","traditional_ira","hsa","pension")')
      .order("created_at", { ascending: true }),
    // My Plaid investment accounts
    service
      .schema("finance")
      .from("accounts")
      .select("id, name, subtype, current_balance, mask")
      .eq("user_id", user.id)
      .eq("type", "investment")
      .eq("is_hidden", false),
    // Manual accounts shared WITH this user by others (excluding retirement types)
    service
      .schema("finance")
      .from("manual_account_shares")
      .select("id, account:manual_accounts!inner(id, name, institution, account_type, balance, as_of_date)")
      .eq("recipient_user_id", user.id)
      .eq("accepted", true)
      .not("account.account_type", "in", '("401k","roth_ira","traditional_ira","hsa","pension")'),
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

  // Per-user brokerage connection (own Alpaca keys, or owner/admin env fallback).
  const hasAlpaca = await hasAlpacaConnection(user.id);

  // ── Allocation by asset class (server-computed for the summary chart) ──────
  const allocation = new Map<string, number>();
  const addAlloc = (label: string, value: number) => {
    if (value > 0) allocation.set(label, (allocation.get(label) ?? 0) + value);
  };
  for (const a of plan.accounts as RetirementAccount[]) addAlloc(assetClass(a.type), a.balance ?? 0);
  for (const m of allManualItems) addAlloc(assetClass(m.account_type), m.balance ?? 0);
  for (const p of plaidInvestmentAccounts) addAlloc("Brokerage", p.balance ?? 0);
  const allocItems = [...allocation.entries()].sort((a, b) => b[1] - a[1]);
  const allocTotal = allocItems.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="ios-scroll">
      <LargeTitle title="Portfolio" subtitle="Investments, retirement & assets" />

      {allocItems.length > 0 && (
        <>
          <div className="ios-list" style={{ margin: "8px 16px 0", padding: 18 }}>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Total invested
            </div>
            <div className="ios-num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 2 }}>
              {fmtUSD(allocTotal)}
            </div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>
              {allocItems.length} asset {allocItems.length === 1 ? "class" : "classes"}
            </div>
          </div>

          <Group header="Allocation">
            <BarRows
              items={allocItems.map(([label, value]) => ({
                label,
                value,
                display: fmtUSD(value),
                color: "var(--ios-finance)",
              }))}
            />
          </Group>
        </>
      )}

      <div style={{ padding: "0 16px" }}>
        <PortfolioClient
          retirementAccounts={plan.accounts as RetirementAccount[]}
          retirementDebts={plan.debts as RetirementDebt[]}
          hasProfile={!!plan.profile}
          manualItems={allManualItems}
          plaidInvestmentAccounts={plaidInvestmentAccounts}
          hasAlpaca={hasAlpaca}
        />
      </div>

      <div style={{ height: 12 }} />
    </div>
  );
}
