/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";

import { createServiceClient } from "@/lib/supabase/server";
import { requireFinanceAccess } from "@/lib/finance/access";
import { LargeTitle, Group } from "@/components/ios";
import SettingsClient, { type AccountRow } from "./_components/SettingsClient";
import PinSettings from "./_components/PinSettings";
import type { AccountShare, PlatformMember } from "./share-actions";

export default async function SettingsPage() {
  const { user } = await requireFinanceAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const [prefsResult, itemRowsResult] = await Promise.all([
    service.schema("hub").from("preferences").select("finance_pin").eq("user_id", user.id).maybeSingle(),
    service.schema("finance").from("plaid_items").select("id, institution_name").eq("user_id", user.id).order("institution_name", { ascending: true }),
  ]);

  // Use auth.admin.listUsers() — bypasses PostgREST/RLS entirely, uses
  // the service role key directly against the Supabase Auth API.
  const { data: { users: allUsers } } = await service.auth.admin.listUsers({ perPage: 200 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentPin: string | null = (prefsResult.data as any)?.finance_pin ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemIds = ((itemRowsResult.data as any[]) ?? []).map((r) => r.id);

  // Build member list from auth users — excludes current user, sorted by email
  const members: PlatformMember[] = (allUsers ?? [])
    .filter((u: any) => u.id !== user.id)
    .map((u: any) => ({
      id: u.id,
      full_name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
      email: u.email ?? null,
      avatar_url: u.user_metadata?.avatar_url ?? u.user_metadata?.picture ?? null,
    }))
    .sort((a: any, b: any) => (a.email ?? "").localeCompare(b.email ?? ""));

  let accounts: AccountRow[] = [];
  let existingShares: AccountShare[] = [];

  if (itemIds.length > 0) {
    const [acctResult, sharesResult] = await Promise.all([
      service.schema("finance").from("accounts")
        .select("id, item_id, name, official_name, type, subtype, mask, current_balance, is_hidden")
        .in("item_id", itemIds)
        .is("deleted_at", null)
        .order("type", { ascending: true })
        .order("name", { ascending: true }),
      service.schema("finance").from("account_shares")
        .select("id, account_id, grantee_user_id, include_in_portfolio, created_at")
        .eq("owner_user_id", user.id),
    ]);

    accounts = (acctResult.data ?? []) as AccountRow[];

    // Attach grantee info to each share — reuse the members list (already
    // fetched via auth.admin.listUsers, which bypasses the profiles RLS block).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawShares = (sharesResult.data ?? []) as any[];
    const memberById = new Map(members.map((m) => [m.id, m]));
    existingShares = rawShares.map((s) => ({
      ...s,
      grantee: memberById.get(s.grantee_user_id) ?? null,
    })) as AccountShare[];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemMap = new Map<string, string>(((itemRowsResult.data as any[]) ?? []).map((r) => [r.id, r.institution_name]));

  return (
    <div className="ios-scroll">
      <LargeTitle title="Settings" subtitle="PIN & account visibility" />

      {/* PIN */}
      <Group header="Security">
        <div style={{ padding: 16 }}>
          <PinSettings currentPin={currentPin} />
        </div>
      </Group>

      {/* Account visibility */}
      <Group
        header="Account visibility"
        footer="Toggle accounts off to exclude them from your dashboard totals and insights. Sync continues in the background."
      >
        <div style={{ padding: 16 }}>
          <SettingsClient
            initialAccounts={accounts}
            itemNameById={Object.fromEntries(itemMap)}
            members={members}
            initialShares={existingShares}
          />
        </div>
      </Group>

      <div style={{ height: 12 }} />
    </div>
  );
}
