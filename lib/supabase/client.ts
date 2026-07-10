import { createBrowserClient } from "@supabase/ssr";

const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

export function createClient() {
  return createBrowserClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key"),
    COOKIE_DOMAIN
      ? { cookieOptions: { domain: COOKIE_DOMAIN, path: "/", sameSite: "lax" } }
      : undefined
  );
}
