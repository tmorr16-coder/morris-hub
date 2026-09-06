import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { withAuthRetry } from "./auth-retry";

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

/** How an attempt to read the signed-in user from Supabase failed, if it did. */
export interface AuthFailure {
  message: string;
  status?: number;
  code?: string;
}

/**
 * The signed-in user, fetched at most once per request — with the reason when
 * there is none.
 *
 * `supabase.auth.getUser()` is not a cookie read — it makes a network call to
 * Supabase's /auth/v1/user endpoint to verify the JWT. A layout and the page
 * beneath it both need the user, so calling it directly meant paying for that
 * round-trip twice on every navigation. React's `cache()` scopes one result to
 * one render pass, so the layout's call and the page's call share it.
 *
 * The reason matters because "no user" is two different situations. Supabase
 * can refuse a token whose signature is perfectly good — the session behind it
 * was ended by a sign-out elsewhere or a refresh-token rotation — and it can
 * also simply be unreachable for a moment (rate limit, outage). A gate that
 * treats both as "signed out" bounces the visitor to a page that checks the
 * token locally, finds it good, and sends them straight back. That loop ran
 * about a thousand times an hour and looked, on the phone, like flashing.
 *
 * Rate limits are retried here, since they were the one failure the old
 * per-request cache handled and the rewrite dropped.
 */
const fetchUserResult = cache(async (): Promise<{ user: User | null; error: AuthFailure | null }> => {
  const supabase = await createClient();
  try {
    return await withAuthRetry(
      async () => {
        const { data: { user }, error } = await supabase.auth.getUser();
        // getUser() reports a rate limit as a value, not a throw; the retry
        // helper only sees throws.
        if (error && error.status === 429) throw error;
        return { user, error: error ? { message: error.message, status: error.status, code: error.code } : null };
      },
      { maxAttempts: 3, initialDelayMs: 100 },
    );
  } catch (e) {
    const err = e as { message?: string; status?: number; code?: string };
    return { user: null, error: { message: err?.message ?? String(e), status: err?.status, code: err?.code } };
  }
});

export async function getCurrentUserResult() {
  return fetchUserResult();
}

/**
 * The signed-in user, or null. Prefer this over
 * `(await createClient()).auth.getUser()` in any server component. Route
 * handlers can use it too; they just have nothing to dedupe against, since
 * each one authenticates a single time.
 */
export const getCurrentUser = cache(async () => (await fetchUserResult()).user);

/**
 * Whether a failed user read says nothing about the session — the service was
 * rate-limiting, down, or unreachable — as opposed to Supabase having looked at
 * the token and declined it.
 */
export function isTransientAuthError(error: AuthFailure | null | undefined): boolean {
  if (!error) return false;
  if (error.status === 429 || (error.status != null && error.status >= 500)) return true;
  if (error.status == null && /fetch failed|network|ECONN|ETIMEDOUT|timeout|socket/i.test(error.message)) return true;
  return false;
}

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
