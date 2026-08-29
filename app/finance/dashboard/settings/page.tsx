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
    service.schema("finance").from("plaid_items").select("id, institution_name, status, last_synced_at, last_error, last_error_at").eq("user_id", user.id).order("institution_name", { ascending: true }),
  ]);

  // Use auth.admin.listUsers() — bypasses PostgREST/RLS entirely, uses
  // the service role key directly against the Supabase Auth API.
  const { data: { users: allUsers } } = await service.auth.admin.listUsers({ perPage: 200 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentPin: string | null = (prefsResult.data as any)?.finance_pin ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemIds = ((itemRowsResult.data as any[]) ?? []).map((r) => r.id);
  const itemsError: string | null = (itemRowsResult as any).error?.message ?? null;

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
  let loadError: string | null = null;
  const deletedByItem: Record<string, number> = {};

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

    // A failed query must not look like an empty account list. It did: `.data`
    // comes back null on error, `?? []` turned that into "no accounts", and the
    // page rendered as though the connection had nothing in it. A missing
    // column or a permissions change could silently empty this screen.
    if (acctResult.error) loadError = acctResult.error.message ?? "Could not load accounts.";
    accounts = (acctResult.data ?? []) as AccountRow[];

    // Deleted accounts are invisible everywhere by design, which makes "am I
    // missing an account?" unanswerable — you cannot tell a deleted one from
    // one the provider never sent. Count them so the arithmetic is checkable.
    try {
      const { data: delRows } = await service
        .schema("finance")
        .from("accounts")
        .select("id, item_id")
        .in("item_id", itemIds)
        .not("deleted_at", "is", null);
      for (const r of ((delRows ?? []) as { item_id: string }[])) {
        deletedByItem[r.item_id] = (deletedByItem[r.item_id] ?? 0) + 1;
      }
    } catch { /* pre-migration — the counts simply stay at zero */ }

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
  // Connection health, so a broken link says so instead of silently going stale.
  const itemHealth = Object.fromEntries(((itemRowsResult.data as any[]) ?? []).map((r) => [r.id, {
    status: (r.status ?? null) as string | null,
    lastSyncedAt: (r.last_synced_at ?? null) as string | null,
    lastError: (r.last_error ?? null) as string | null,
    lastErrorAt: (r.last_error_at ?? null) as string | null,
  }]));

  return (
    <div className="ios-scroll">
      <LargeTitle title="Settings" subtitle="PIN & account visibility" />

      {/* PIN */}
      <Group header="Security">
        <div style={{ padding: 16 }}>
          <PinSettings currentPin={currentPin} />
        </div>
      </Group>

      {/* A load failure says so. Rendering an empty list instead made a broken
          query look like an account-less connection. */}
      {(loadError || itemsError) && (
        <Group header="Couldn't load your accounts">
          <div style={{ padding: 16 }}>
            <div className="ios-subhead" style={{ color: "var(--ios-red)", lineHeight: 1.5 }}>
              {loadError ?? itemsError}
            </div>
            <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 8, lineHeight: 1.5 }}>
              The list below is empty because the query failed, not because there is nothing connected.
              If this mentions a missing column, a database migration still needs to be applied.
            </div>
          </div>
        </Group>
      )}

      {/* Account visibility */}
      <Group
        header="Account visibility"
        footer="Toggle accounts off to exclude them from your dashboard totals and insights. Sync continues in the background."
      >
        <div style={{ padding: 16 }}>
          <SettingsClient
            initialAccounts={accounts}
            itemNameById={Object.fromEntries(itemMap)}
            itemHealth={itemHealth}
            deletedByItem={deletedByItem}
            members={members}
            initialShares={existingShares}
          />
        </div>
      </Group>

      <div style={{ height: 12 }} />
    </div>
  );
}
