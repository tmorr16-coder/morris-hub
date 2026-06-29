import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";

// GET — shares for a given account (owner view) + pending received shares
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("account_id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  if (accountId) {
    // Return shares for a specific account (owner checking who they've shared with)
    const { data } = await service
      .schema("finance").from("manual_account_shares")
      .select("id, recipient_user_id, mode, accepted, created_at")
      .eq("account_id", accountId)
      .eq("owner_user_id", userId);
    return Response.json({ shares: data ?? [] });
  }

  // Return all pending shares received by this user (manual mode, not yet accepted)
  const { data: pending } = await service
    .schema("finance").from("manual_account_shares")
    .select("id, account_id, owner_user_id, mode, created_at")
    .eq("recipient_user_id", userId)
    .eq("accepted", false);

  return Response.json({ pending: pending ?? [] });
}

// POST — share an account with a specific person
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { account_id, recipient_user_id, mode = "auto" } = await request.json();
  if (!account_id || !recipient_user_id) {
    return Response.json({ error: "account_id and recipient_user_id required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Verify the user owns this account
  const { data: account } = await service.schema("finance").from("manual_accounts")
    .select("id").eq("id", account_id).eq("user_id", userId).maybeSingle();
  if (!account) return Response.json({ error: "Account not found or not yours" }, { status: 403 });

  const { error } = await service.schema("finance").from("manual_account_shares")
    .upsert(
      {
        account_id,
        owner_user_id: userId,
        recipient_user_id,
        mode,
        accepted: mode === "auto", // auto = immediately visible; manual = pending
      },
      { onConflict: "account_id,recipient_user_id" }
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

// DELETE — revoke a share
export async function DELETE(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { share_id, account_id, recipient_user_id } = await request.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  if (share_id) {
    await service.schema("finance").from("manual_account_shares")
      .delete().eq("id", share_id).eq("owner_user_id", userId);
  } else if (account_id && recipient_user_id) {
    await service.schema("finance").from("manual_account_shares")
      .delete().eq("account_id", account_id).eq("owner_user_id", userId).eq("recipient_user_id", recipient_user_id);
  }

  return Response.json({ ok: true });
}

// PATCH — recipient accepts a manual share
export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { share_id } = await request.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service.schema("finance").from("manual_account_shares")
    .update({ accepted: true })
    .eq("id", share_id)
    .eq("recipient_user_id", userId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
