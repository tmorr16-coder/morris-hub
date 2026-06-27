import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";
import { getRequestToken, getAuthorizationUrl } from "@/lib/etrade";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/investments/etrade/callback`;

  let requestToken: string;
  let requestTokenSecret: string;
  try {
    const tokens = await getRequestToken(callbackUrl);
    requestToken = tokens.token;
    requestTokenSecret = tokens.secret;
  } catch (err) {
    console.error("[etrade/connect] request token failed:", err);
    return Response.json({ error: "Could not reach E*TRADE" }, { status: 502 });
  }

  // Store request token keyed by token value so callback can look it up
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("etrade_oauth_state")
    .upsert(
      { request_token: requestToken, user_id: userId, request_token_secret: requestTokenSecret },
      { onConflict: "request_token" }
    );

  if (error) {
    console.error("[etrade/connect] DB error:", error.message);
    return Response.json({ error: "DB error storing OAuth state" }, { status: 500 });
  }

  redirect(getAuthorizationUrl(requestToken));
}
