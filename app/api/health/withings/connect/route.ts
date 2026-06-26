import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.WITHINGS_CLIENT_ID;
  const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL;

  if (!clientId || !siteUrl) {
    return NextResponse.json(
      { error: "WITHINGS_CLIENT_ID or NEXT_PUBLIC_SITE_URL not set" },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();

  const authUrl = new URL("https://account.withings.com/oauth2_user/authorize2");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", `${siteUrl}/api/health/withings/callback`);
  authUrl.searchParams.set("scope", "user.metrics,user.info,user.activity");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("withings_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   600, // 10 minutes
    path:     "/",
  });
  return response;
}
