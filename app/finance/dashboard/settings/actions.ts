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
