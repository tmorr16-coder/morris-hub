// Robust base-URL resolution. NEXT_PUBLIC_SITE_URL is the canonical production
// origin, but it isn't set in every environment (notably Vercel Preview), which
// used to produce "undefined/api/..." or relative "/api/..." URLs that crash
// server-side fetch(). These helpers never return an empty/undefined base.

const STABLE_PROD = "https://morrisai.family";

/**
 * Base URL for SERVER-SIDE self-referential fetches (a server action / route
 * calling one of our own /api routes). Prefers the configured site URL, then
 * the current Vercel deployment (`VERCEL_URL`, always set on Vercel — works on
 * preview too), then localhost for local dev.
 */
export function serverBaseUrl(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) return site.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/**
 * Stable PUBLIC origin for URLs shown to users or registered with third parties
 * (the Apple Health webhook URL, OAuth redirect URIs). Always resolves to the
 * production domain so we never hand out an ephemeral preview URL that expires.
 */
export function publicOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || STABLE_PROD).replace(/\/$/, "");
}
