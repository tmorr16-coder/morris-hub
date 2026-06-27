// Debug: verify stored accountIdKey against live E*TRADE accounts list
// DELETE after confirming E*TRADE orders work
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";
import { decryptToken, getAccounts } from "@/lib/etrade";

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

  if (!conn) return Response.json({ error: "No E*TRADE connection stored" });

  const storedKey = conn.account_id_key as string;

  let liveAccounts: unknown[] = [];
  let liveError: string | null = null;
  try {
    const token = decryptToken(conn.access_token);
    const secret = decryptToken(conn.access_token_secret);
    liveAccounts = await getAccounts(token, secret);
  } catch (e) {
    liveError = (e as Error).message;
  }

  return Response.json({
    storedKey,
    storedKeyEncoded: encodeURIComponent(storedKey),
    accountName: conn.account_name,
    liveAccounts,
    liveError,
    keyMatchesLive: liveAccounts.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => a.accountIdKey === storedKey
    ),
  });
}
