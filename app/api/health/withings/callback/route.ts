import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";

interface WithingsTokenBody {
  userid:        number;
  access_token:  string;
  refresh_token: string;
  expires_in:    number;
  scope:         string;
  token_type:    string;
}

interface WithingsTokenResponse {
  status: number;
  body:   WithingsTokenBody;
  error?: string;
}

export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const settingsUrl = `${siteUrl}/health/settings/integrations`;

  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");

  // Validate state to prevent CSRF
  const storedState = request.cookies.get("withings_oauth_state")?.value;
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${settingsUrl}?error=invalid_state`);
  }

  if (!code) {
    return NextResponse.redirect(`${settingsUrl}?error=no_code`);
  }

  // Exchange authorization code for tokens
  let tokenData: WithingsTokenResponse;
  try {
    const res = await fetch("https://wbsapi.withings.net/v2/oauth2", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action:        "requesttoken",
        grant_type:    "authorization_code",
        client_id:     process.env.WITHINGS_CLIENT_ID!,
        client_secret: process.env.WITHINGS_CLIENT_SECRET!,
        code,
        redirect_uri:  `${siteUrl}/api/health/withings/callback`,
      }),
    });
    tokenData = (await res.json()) as WithingsTokenResponse;
  } catch (err) {
    console.error("[withings/callback] Token exchange fetch failed:", err);
    return NextResponse.redirect(`${settingsUrl}?error=fetch_failed`);
  }

  if (tokenData.status !== 0) {
    console.error("[withings/callback] Token exchange error:", tokenData.status, tokenData.error);
    return NextResponse.redirect(`${settingsUrl}?error=token_exchange`);
  }

  const { access_token, refresh_token, expires_in, scope } = tokenData.body;
  const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

  // Upsert tokens (one row per user; update on reconnect)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();

  const { error: dbErr } = await db.from("withings_tokens").upsert(
    {
      user_id:       userId,
      access_token,
      refresh_token,
      expires_at,
      scope,
      updated_at:    new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (dbErr) {
    console.error("[withings/callback] DB upsert failed:", dbErr.message);
    return NextResponse.redirect(`${settingsUrl}?error=db_error`);
  }

  console.log("[withings/callback] Tokens stored for user:", userId);

  const response = NextResponse.redirect(`${settingsUrl}?connected=1`);
  response.cookies.delete("withings_oauth_state");
  return response;
}
