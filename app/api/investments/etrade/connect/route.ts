import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";
import { getRequestToken, getAuthorizationUrl } from "@/lib/etrade";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // Validate env vars before attempting — surfaces missing config clearly
  if (!process.env.ETRADE_CONSUMER_KEY || !process.env.ETRADE_CONSUMER_SECRET) {
    return Response.json(
      { error: "ETRADE_CONSUMER_KEY / ETRADE_CONSUMER_SECRET not set in environment" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://morrisai.family";
  const callbackUrl = `${appUrl}/api/investments/etrade/callback`;

  let requestToken: string;
  let requestTokenSecret: string;
  try {
    const tokens = await getRequestToken(callbackUrl);
    requestToken = tokens.token;
    requestTokenSecret = tokens.secret;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[etrade/connect] request token failed:", msg);
    // Surface the E*TRADE error body so we can see what went wrong
    return Response.json({ error: msg }, { status: 502 });
  }

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

  redirect(getAuthorizationUrl(requestToken));
}
