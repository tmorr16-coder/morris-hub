import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

// LinkedIn OpenID Connect — no special approval needed
// Scopes: openid profile email (returns name, picture, headline via userinfo endpoint)
// Requires: LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET in env

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/career/settings?linkedin=error&reason=not_configured", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://morrisai.family";
  const redirectUri = `${appUrl}/api/career/linkedin/callback`;

  // Encode userId in state — no DB write needed, verified in callback
  const state = Buffer.from(userId).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile email",
  });

  return NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params}`
  );
}
