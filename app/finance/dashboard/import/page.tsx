/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";

import { requireFinanceAccess } from "@/lib/finance/access";
import { createServiceClient } from "@/lib/supabase/server";
import { LargeTitle, Group } from "@/components/ios";
import ImportClient from "./_components/ImportClient";
import QuickEntryForm from "./_components/QuickEntryForm";
import ManualAccountsList from "./_components/ManualAccountsList";
import SimpleFinConnect from "../_components/SimpleFinConnect";

interface ManualAccount {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  balance: number | null;
  as_of_date: string | null;
  currency: string;
  holdings: { name: string; value: number; pct: number | null; shares: number | null; price: number | null }[] | null;
  source: string;
  created_at: string;
  visible_to_family: boolean;
}

export default async function ImportPage() {
  const { user } = await requireFinanceAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data: rows } = await service
    .schema("finance")
    .from("manual_accounts")
    .select("id, name, institution, account_type, balance, as_of_date, currency, holdings, source, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch sharing flags separately — fails gracefully if migration not yet run
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharingMap = new Map<string, boolean>();
  try {
    const { data: sharingRows } = await service
      .schema("finance").from("manual_accounts")
      .select("id, visible_to_family").eq("user_id", user.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((sharingRows ?? []) as any[]).forEach((r) => sharingMap.set(r.id, r.visible_to_family ?? false));
  } catch { /* column not yet added */ }

  const accounts: ManualAccount[] = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rows ?? []) as any[]
  ).map((r) => ({ ...r, visible_to_family: sharingMap.get(r.id) ?? false }));

  return (
    <div className="ios-scroll">
      <LargeTitle title="Add accounts" subtitle="Connect a bank, or add accounts manually" />

      {/* Plaid — automatic bank/brokerage sync */}
      <Group
        header="Connect a bank"
        footer="Securely link a bank, card, or brokerage via Plaid to sync balances and transactions automatically."
      >
        <div style={{ padding: 16 }}>
          <SimpleFinConnect label="Connect with SimpleFIN" />
        </div>
      </Group>

      {/* Quick entry — manual path */}
      <Group
        header="Manual account entry"
        footer="Enter your 401k or other account balance directly. Paste the balance history rows from Alight to track monthly trends."
      >
        <div style={{ padding: 16 }}>
          <QuickEntryForm />
        </div>
      </Group>

      {/* File upload — secondary path */}
      <Group
        header="Upload statement"
        footer="Upload a PDF or CSV — Morris will extract the balance and holdings. Works best with holdings summaries, not transaction logs."
      >
        <div style={{ padding: 16 }}>
          <ImportClient userId={user.id} />
        </div>
      </Group>

      {/* Saved accounts */}
      {accounts.length > 0 && (
        <Group header="Saved accounts">
          <div style={{ padding: 16 }}>
            <ManualAccountsList initialAccounts={accounts} />
          </div>
        </Group>
      )}

      <div style={{ height: 12 }} />
    </div>
  );
}
