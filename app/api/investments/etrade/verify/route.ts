import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";
import { getAccessToken, getAccounts, encryptToken } from "@/lib/etrade";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let body: { requestToken: string; pin: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { requestToken, pin } = body;
  if (!requestToken || !pin) {
    return Response.json({ error: "requestToken and pin required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Look up stored request token secret for this user
  const { data: state } = await service
    .schema("hub")
    .from("etrade_oauth_state")
    .select("request_token_secret")
    .eq("request_token", requestToken)
    .eq("user_id", userId)
    .maybeSingle();

  if (!state) {
    return Response.json({ error: "Session expired — start the connection again" }, { status: 400 });
  }

  // Exchange request token + PIN for access token
  let accessToken: string;
  let accessTokenSecret: string;
  try {
    const tokens = await getAccessToken(requestToken, state.request_token_secret, pin.trim());
    accessToken = tokens.token;
    accessTokenSecret = tokens.secret;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[etrade/verify] exchange failed:", msg);
    return Response.json({ error: msg }, { status: 401 });
  }

  // Pick the best account for trading:
  // Prefer active, non-IRA, non-CLOSED individual brokerage accounts
  let accountIdKey = "";
  let accountName = "";
  try {
    const accounts = await getAccounts(accessToken, accessTokenSecret);
    const active = accounts.filter((a) => a.accountStatus === "ACTIVE");
    const brokerage =
      active.find((a) => a.institutionType === "BROKERAGE" && a.accountMode !== "IRA" && a.accountType !== "IRA") ??
      active.find((a) => a.institutionType === "BROKERAGE") ??
      active[0] ??
      accounts[0];
    if (brokerage) {
      accountIdKey = brokerage.accountIdKey;
      accountName = brokerage.accountName || brokerage.accountType;
    }
  } catch (err) {
    console.error("[etrade/verify] accounts fetch failed:", err);
  }

  // Persist encrypted tokens
  const { error: saveErr } = await service
    .schema("hub")
    .from("etrade_connections")
    .upsert(
      {
        user_id: userId,
        access_token: encryptToken(accessToken),
        access_token_secret: encryptToken(accessTokenSecret),
        account_id_key: accountIdKey,
        account_name: accountName,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (saveErr) {
    return Response.json({ error: saveErr.message }, { status: 500 });
  }

  // Clean up temp state
  await service.schema("hub").from("etrade_oauth_state").delete().eq("request_token", requestToken);

  return Response.json({ ok: true, accountName });
}
