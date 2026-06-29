import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://morrisai.family";
  const errorUrl = `${appUrl}/career/settings?linkedin=error`;
  const successUrl = `${appUrl}/career/settings?linkedin=connected`;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) return NextResponse.redirect(errorUrl);

  // Decode user ID from state
  let userId: string;
  try {
    userId = Buffer.from(state, "base64url").toString("utf8");
    if (!userId || userId.length < 10) throw new Error("Invalid state");
  } catch {
    return NextResponse.redirect(errorUrl);
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = `${appUrl}/api/career/linkedin/callback`;

  if (!clientId || !clientSecret) return NextResponse.redirect(errorUrl);

  // Exchange code for access token
  let accessToken: string;
  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error("[linkedin/callback] no access_token:", tokenData);
      return NextResponse.redirect(errorUrl);
    }
    accessToken = tokenData.access_token;
  } catch (e) {
    console.error("[linkedin/callback] token exchange failed:", e);
    return NextResponse.redirect(errorUrl);
  }

  // Fetch profile via OpenID Connect userinfo endpoint
  let profile: { name?: string; given_name?: string; picture?: string; email?: string } = {};
  try {
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    profile = await profileRes.json();
  } catch (e) {
    console.error("[linkedin/callback] profile fetch failed:", e);
    // continue — save what we have
  }

  // Save to career_profile via upsert
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service.schema("career").from("career_profile").upsert(
    {
      user_id: userId,
      linkedin_connected: true,
      linkedin_connected_at: new Date().toISOString(),
      linkedin_name: profile.name ?? profile.given_name ?? null,
      linkedin_picture_url: profile.picture ?? null,
      linkedin_email: profile.email ?? null,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[linkedin/callback] upsert error:", error.message);
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(successUrl);
}
