// OOB flow: E*TRADE app registered as desktop type.
// Returns the auth URL + request token; frontend prompts user to open it, get the PIN, and paste it.
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";
import { getRequestToken, getAuthorizationUrl } from "@/lib/etrade";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  if (!process.env.ETRADE_CONSUMER_KEY || !process.env.ETRADE_CONSUMER_SECRET) {
    return Response.json({ error: "ETRADE_CONSUMER_KEY / ETRADE_CONSUMER_SECRET not set" }, { status: 500 });
  }

  let requestToken: string;
  let requestTokenSecret: string;
  try {
    // Pass "oob" for desktop-registered apps
    const tokens = await getRequestToken("oob");
    requestToken = tokens.token;
    requestTokenSecret = tokens.secret;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[etrade/connect] request token failed:", msg);
    return Response.json({ error: msg }, { status: 502 });
  }

  // Store request token so /verify can exchange it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error: dbErr } = await service
    .schema("hub")
    .from("etrade_oauth_state")
    .upsert(
      { request_token: requestToken, user_id: userId, request_token_secret: requestTokenSecret },
      { onConflict: "request_token" }
    );

  if (dbErr) {
    console.error("[etrade/connect] DB error:", dbErr.message);
    return Response.json({ error: `DB error: ${dbErr.message}` }, { status: 500 });
  }

  return Response.json({
    requestToken,
    authUrl: getAuthorizationUrl(requestToken),
  });
}
