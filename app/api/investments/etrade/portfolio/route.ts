import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";
import { decryptToken, getBalance, getPortfolio } from "@/lib/etrade";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data: conn } = await service
    .schema("hub")
    .from("etrade_connections")
    .select("access_token, access_token_secret, account_id_key, account_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (!conn) return Response.json({ error: "Not connected" }, { status: 404 });

  let accessToken: string;
  let accessTokenSecret: string;
  try {
    accessToken = decryptToken(conn.access_token);
    accessTokenSecret = decryptToken(conn.access_token_secret);
  } catch {
    return Response.json({ error: "Token decryption failed — reconnect E*TRADE" }, { status: 401 });
  }

  const accountIdKey: string = conn.account_id_key;

  const [balance, positions] = await Promise.all([
    getBalance(accessToken, accessTokenSecret, accountIdKey),
    getPortfolio(accessToken, accessTokenSecret, accountIdKey),
  ]);

  return Response.json({
    accountName: conn.account_name,
    accountIdKey,
    balance,
    positions,
  });
}
