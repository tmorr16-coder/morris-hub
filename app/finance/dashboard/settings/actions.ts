"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireFinanceAccess } from "@/lib/finance/access";

export async function setAccountHidden(
  accountId: string,
  hidden: boolean
): Promise<{ error?: string }> {
  // Auth check (admins can set anyone's; users only their own — enforced below).
  const { user } = await requireFinanceAccess();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Make sure the account belongs to this user before updating.
  const { data: acct } = await service
    .schema("finance")
    .from("accounts")
    .select("id, plaid_items!inner(user_id)")
    .eq("id", accountId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerId = (acct as any)?.plaid_items?.user_id;
  if (!ownerId || ownerId !== user.id) {
    return { error: "Account not found or access denied" };
  }

  const { error } = await service
    .schema("finance")
    .from("accounts")
    .update({ is_hidden: hidden, updated_at: new Date().toISOString() })
    .eq("id", accountId);

  if (error) return { error: error.message };

  revalidatePath("/finance/dashboard");
  revalidatePath("/finance/dashboard/insights");
  revalidatePath("/finance/dashboard/settings");
  return {};
}

/**
 * Permanently delete a linked account.
 *
 * Hiding and deleting are different things and the UI only offered the first:
 * a hidden account keeps its row, its balance history and its transactions, and
 * still appears in sharing and settings. This removes it.
 *
 * The row is soft-deleted rather than dropped, because lib/finance/sync.ts
 * re-inserts any SimpleFIN account it has no row for — a hard DELETE would be
 * undone on the next sync. The tombstone is what makes the deletion stick.
 * Its transactions are removed outright; they are the bulky part and nothing
 * needs them once the account is gone.
 */
export async function deleteLinkedAccount(accountId: string): Promise<{ error?: string }> {
  const { user } = await requireFinanceAccess();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Ownership runs through the item — finance.accounts has no user_id of its own.
  const { data: acct } = await service
    .schema("finance")
    .from("accounts")
    .select("id, plaid_items!inner(user_id)")
    .eq("id", accountId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerId = (acct as any)?.plaid_items?.user_id;
  if (!ownerId || ownerId !== user.id) {
    return { error: "Account not found or access denied" };
  }

  // Shares first — leaving them would point a family member at an account that
  // no longer resolves, and the confirmation promised they go.
  const { error: shareError } = await service
    .schema("finance")
    .from("account_shares")
    .delete()
    .eq("account_id", accountId);
  if (shareError) return { error: shareError.message };

  // Then transactions: if this fails we have not yet orphaned anything.
  const { error: txError } = await service
    .schema("finance")
    .from("transactions")
    .delete()
    .eq("account_id", accountId);
  if (txError) return { error: txError.message };

  const { error } = await service
    .schema("finance")
    .from("accounts")
    .update({ deleted_at: new Date().toISOString(), is_hidden: true, updated_at: new Date().toISOString() })
    .eq("id", accountId);
  if (error) return { error: error.message };

  revalidatePath("/finance/dashboard");
  revalidatePath("/finance/dashboard/insights");
  revalidatePath("/finance/dashboard/settings");
  return {};
}

/**
 * Disconnect an institution: its stored credential, every account under it, and
 * their transactions.
 *
 * There was no way to do this at all — a connection made once could never be
 * undone from the interface, which also meant the encrypted SimpleFIN access
 * URL stayed on file indefinitely. That credential is deleted here, so the
 * connection is genuinely severed rather than merely ignored.
 */
export async function disconnectInstitution(itemId: string): Promise<{ error?: string }> {
  const { user } = await requireFinanceAccess();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data: item } = await service
    .schema("finance")
    .from("plaid_items")
    .select("id, user_id")
    .eq("id", itemId)
    .maybeSingle();

  if (!item || (item as { user_id: string }).user_id !== user.id) {
    return { error: "Institution not found or access denied" };
  }

  const { data: acctRows } = await service
    .schema("finance")
    .from("accounts")
    .select("id")
    .eq("item_id", itemId);
  const acctIds = ((acctRows ?? []) as { id: string }[]).map((a) => a.id);

  if (acctIds.length > 0) {
    const { error: shareError } = await service
      .schema("finance")
      .from("account_shares")
      .delete()
      .in("account_id", acctIds);
    if (shareError) return { error: shareError.message };

    const { error: txError } = await service
      .schema("finance")
      .from("transactions")
      .delete()
      .in("account_id", acctIds);
    if (txError) return { error: txError.message };
  }

  // The accounts go for real here — with the item gone there is no sync left to
  // re-create them, so no tombstone is needed.
  const { error: acctError } = await service
    .schema("finance")
    .from("accounts")
    .delete()
    .eq("item_id", itemId);
  if (acctError) return { error: acctError.message };

  const { error } = await service
    .schema("finance")
    .from("plaid_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/finance/dashboard");
  revalidatePath("/finance/dashboard/insights");
  revalidatePath("/finance/dashboard/settings");
  return {};
}
