import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) return redirect("/career/settings?linkedin=error");

  // Decode user ID from state
  let userId: string;
  try {
    userId = Buffer.from(state, "base64url").toString("utf8");
  } catch {
    return redirect("/career/settings?linkedin=error");
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/career/linkedin/callback`;

  if (!clientId || !clientSecret) return redirect("/career/settings?linkedin=error");

  // Exchange code for access token
  let accessToken: string;
  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("No access token");
    accessToken = tokenData.access_token;
  } catch (e) {
    console.error("[linkedin/callback] token exchange failed:", e);
    return redirect("/career/settings?linkedin=error");
  }

  // Fetch profile via OpenID Connect userinfo endpoint
  let profile: { name?: string; given_name?: string; family_name?: string; email?: string; picture?: string; sub?: string } = {};
  try {
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    profile = await profileRes.json();
  } catch (e) {
    console.error("[linkedin/callback] profile fetch failed:", e);
    // Continue — save what we have
  }

  // Save to career_profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const updates: Record<string, unknown> = {
    user_id: userId,
    linkedin_connected: true,
    linkedin_connected_at: new Date().toISOString(),
    linkedin_name: profile.name ?? null,
    linkedin_picture_url: profile.picture ?? null,
    linkedin_email: profile.email ?? null,
  };

  await service.schema("career").from("career_profile")
    .upsert(updates, { onConflict: "user_id" });

  return redirect("/career/settings?linkedin=connected");
}
