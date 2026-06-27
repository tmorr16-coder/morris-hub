import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getAccessToken, getAccounts, encryptToken } from "@/lib/etrade";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const oauthToken = searchParams.get("oauth_token");
  const verifier = searchParams.get("oauth_verifier");

  if (!oauthToken || !verifier) {
    return Response.json({ error: "Missing OAuth params" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Look up stored request token secret
  const { data: state, error: stateErr } = await service
    .schema("hub")
    .from("etrade_oauth_state")
    .select("user_id, request_token_secret")
    .eq("request_token", oauthToken)
    .maybeSingle();

  if (stateErr || !state) {
    console.error("[etrade/callback] state lookup failed:", stateErr?.message);
    redirect("/investments/stocks?etrade=error");
  }

  const { user_id: userId, request_token_secret: requestTokenSecret } = state;

  // Exchange for access token
  let accessToken: string;
  let accessTokenSecret: string;
  try {
    const tokens = await getAccessToken(oauthToken, requestTokenSecret, verifier);
    accessToken = tokens.token;
    accessTokenSecret = tokens.secret;
  } catch (err) {
    console.error("[etrade/callback] access token exchange failed:", err);
    redirect("/investments/stocks?etrade=error");
  }

  // Look up accounts to get the primary brokerage account
  let accountIdKey = "";
  let accountName = "";
  try {
    const accounts = await getAccounts(accessToken, accessTokenSecret);
    const brokerage = accounts.find((a) => a.institutionType === "BROKERAGE") ?? accounts[0];
    if (brokerage) {
      accountIdKey = brokerage.accountIdKey;
      accountName = brokerage.accountName || brokerage.accountType;
    }
  } catch (err) {
    console.error("[etrade/callback] accounts fetch failed:", err);
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
    console.error("[etrade/callback] save failed:", saveErr.message);
    redirect("/investments/stocks?etrade=error");
  }

  // Clean up temp state
  await service
    .schema("hub")
    .from("etrade_oauth_state")
    .delete()
    .eq("request_token", oauthToken);

  redirect("/investments/stocks?etrade=connected");
}
