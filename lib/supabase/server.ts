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

export function createServiceClient() {
  return createSupabaseClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-key"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
