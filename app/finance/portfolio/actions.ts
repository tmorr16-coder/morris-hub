"use server";

import { revalidatePath } from "next/cache";
import { requireFinanceAccess } from "@/lib/finance/access";
import { createServiceClient } from "@/lib/supabase/server";

export async function addPortfolioItem(data: {
  name: string;
  institution: string | null;
  accountType: string;
  balance: number;
}): Promise<{ error?: string; id?: string }> {
  const { user } = await requireFinanceAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data: row, error } = await service
    .schema("finance")
    .from("manual_accounts")
    .insert({
      user_id: user.id,
      name: data.name,
      institution: data.institution,
      account_type: data.accountType,
      balance: data.balance,
      as_of_date: new Date().toISOString().slice(0, 10),
      currency: "USD",
      source: "manual",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/finance/portfolio");
  return { id: row.id };
}

export async function removePortfolioItem(id: string): Promise<{ error?: string }> {
  const { user } = await requireFinanceAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("finance")
    .from("manual_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/finance/portfolio");
  return {};
}

export async function updatePortfolioItem(
  id: string,
  balance: number
): Promise<{ error?: string }> {
  const { user } = await requireFinanceAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("finance")
    .from("manual_accounts")
    .update({ balance, as_of_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/finance/portfolio");
  return {};
}
