import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";

// LinkedIn OpenID Connect — no special approval needed
// Scopes: openid profile email (returns name, picture, headline via userinfo endpoint)
// Requires: LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET in env

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) return Response.json({ error: "LINKEDIN_CLIENT_ID not configured" }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/career/linkedin/callback`;
  const state = Buffer.from(userId).toString("base64url");

  // Store state so callback can verify
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  await service.schema("career").from("career_profile").upsert(
    { user_id: userId, linkedin_oauth_state: state },
    { onConflict: "user_id" }
  ).catch(() => {}); // ignore if column doesn't exist yet

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile email",
  });

  return Response.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
}
