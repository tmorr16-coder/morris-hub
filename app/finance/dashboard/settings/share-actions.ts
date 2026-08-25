"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireFinanceAccess } from "@/lib/finance/access";

export interface PlatformMember {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface AccountShare {
  id: string;
  account_id: string;
  grantee_user_id: string;
  include_in_portfolio: boolean;
  created_at: string;
  grantee: PlatformMember | null;
}

export interface SharedWithMe {
  id: string;
  account_id: string;
  owner_user_id: string;
  include_in_portfolio: boolean;
  created_at: string;
  account: {
    id: string;
    name: string;
    type: string;
    subtype: string | null;
    mask: string | null;
    current_balance: number | null;
    institution_name: string | null;
  };
  owner: PlatformMember | null;
}

/** List all other platform members (for the share picker). */
export async function getPlatformMembers(): Promise<PlatformMember[]> {
  const { user } = await requireFinanceAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data } = await service
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .neq("id", user.id)
    .order("full_name", { ascending: true });

  return (data ?? []) as PlatformMember[];
}

/** Share a single account with another platform member. */
export async function shareAccount(
  accountId: string,
  granteeUserId: string
): Promise<{ error?: string }> {
  const { user } = await requireFinanceAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Verify ownership through the item join
  const { data: acct } = await service
    .schema("finance")
    .from("accounts")
    .select("id, plaid_items!inner(user_id)")
    .eq("id", accountId)
    .maybeSingle()
      .is("deleted_at", null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!acct || (acct as any).plaid_items?.user_id !== user.id) {
    return { error: "Account not found or access denied" };
  }
  if (granteeUserId === user.id) return { error: "Cannot share with yourself" };

  const { error } = await service
    .schema("finance")
    .from("account_shares")
    .insert({
      owner_user_id: user.id,
      grantee_user_id: granteeUserId,
      account_id: accountId,
      include_in_portfolio: false,
    });

  if (error) {
    if (error.code === "23505") return { error: "Already shared with this person" };
    return { error: error.message };
  }

  revalidatePath("/finance/dashboard/settings");
  revalidatePath("/finance/dashboard");
  return {};
}

/** Remove a share (owner only). */
export async function revokeShare(shareId: string): Promise<{ error?: string }> {
  const { user } = await requireFinanceAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { error } = await service
    .schema("finance")
    .from("account_shares")
    .delete()
    .eq("id", shareId)
    .eq("owner_user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/finance/dashboard/settings");
  revalidatePath("/finance/dashboard");
  return {};
}

/** Grantee toggles whether a shared account is included in their net position. */
export async function toggleIncludeInPortfolio(
  shareId: string,
  include: boolean
): Promise<{ error?: string }> {
  const { user } = await requireFinanceAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { error } = await service
    .schema("finance")
    .from("account_shares")
    .update({ include_in_portfolio: include })
    .eq("id", shareId)
    .eq("grantee_user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/finance/dashboard");
  return {};
}
