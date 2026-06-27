// Switch which E*TRADE account is used for orders without reconnecting
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";
import { decryptToken, getAccounts } from "@/lib/etrade";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data: conn } = await service
    .schema("hub").from("etrade_connections")
    .select("access_token, access_token_secret, account_id_key")
    .eq("user_id", userId).maybeSingle();

  if (!conn) return Response.json({ error: "Not connected" }, { status: 404 });

  const token = decryptToken(conn.access_token);
  const secret = decryptToken(conn.access_token_secret);
  const accounts = await getAccounts(token, secret);

  return Response.json({ current: conn.account_id_key, accounts });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { accountIdKey } = await request.json();
  if (!accountIdKey) return Response.json({ error: "accountIdKey required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub").from("etrade_connections")
    .update({ account_id_key: accountIdKey })
    .eq("user_id", userId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, accountIdKey });
}
