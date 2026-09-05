import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

// Set in production to .morrisai.family so the auth cookie is shared across
// hub / health / finance subdomains (SSO). Leave unset on preview / localhost.
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key"),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
              })
            );
          } catch { /* read-only server contexts */ }
        },
      },
    }
  );
}

/**
 * The signed-in user, fetched at most once per request.
 *
 * `supabase.auth.getUser()` is not a cookie read — it makes a network call to
 * Supabase's /auth/v1/user endpoint to verify the JWT. A layout and the page
 * beneath it both need the user, so calling it directly meant paying for that
 * round-trip twice on every navigation. React's `cache()` scopes one result to
 * one render pass, so the layout's call and the page's call share it.
 *
 * Prefer this over `(await createClient()).auth.getUser()` in any server
 * component. Route handlers can use it too; they just have nothing to dedupe
 * against, since each one authenticates a single time.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

/**
 * The signed-in user's identity, verified locally, at most once per request.
 *
 * `getCurrentUser()` below is a network call: it asks Supabase's /auth/v1/user
 * endpoint to verify the JWT, and on a mobile connection that round trip is the
 * single most expensive thing between tapping "Sign in" and seeing a screen.
 *
 * This project signs its tokens with an asymmetric key (ES256 — see
 * /auth/v1/.well-known/jwks.json), so `getClaims()` can verify the signature
 * with WebCrypto right here, with no round trip at all. auth-js caches the
 * public key in a module-level `GLOBAL_JWKS` shared by every client in the
 * process for 10 minutes, so one request per container fetches it and the rest
 * verify locally.
 *
 * Use this wherever the question is "who is this, and is their token real?" —
 * a route gate, a user id for a query. It returns only what the JWT carries.
 * When you need the full, freshly-read user record (identities, or metadata
 * that may have changed since the token was issued), use `getCurrentUser()`.
 *
 * The trade-off getClaims() makes, and why it is the right one here: a locally
 * verified token is trusted until it expires, so a session revoked server-side
 * stays usable for the remainder of the access token's lifetime. Supabase
 * recommends exactly this for route gating with asymmetric keys. Row-level
 * security still runs on every query, so a revoked user can read nothing.
 *
 * Falls back to the network call by itself if the token ever turns out to be
 * symmetric (HS256), so this is never worse than what it replaces.
 */
export const getCurrentClaims = cache(async (): Promise<AuthClaims | null> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) return null;
    const c = data.claims as Record<string, unknown>;
    return {
      id: c.sub as string,
      email: typeof c.email === "string" ? c.email : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user_metadata: (c.user_metadata ?? {}) as Record<string, any>,
    };
  } catch {
    return null;
  }
});

export interface AuthClaims {
  id: string;
  email: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user_metadata: Record<string, any>;
}

export function createServiceClient() {
  return createSupabaseClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-key"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
