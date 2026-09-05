/**
 * useCurrentUser — who is signed in, without a round trip.
 *
 * This hook gates the landing and sign-in screens, so whatever it does sits
 * directly between opening the app and seeing anything. It used to call
 * `supabase.auth.getUser()`, which is a request to Supabase's /auth/v1/user
 * endpoint — from the phone, over cellular, before the sign-in card could be
 * drawn. `app/login/page.tsx` rendered "Loading…" for the whole of it.
 *
 * `getClaims()` verifies the token's signature in the browser with WebCrypto
 * instead. This project signs with an asymmetric key (ES256), so no round trip
 * is needed beyond one cached fetch of the public key, shared process-wide.
 * If the token is ever symmetric, auth-js falls back to the network call on its
 * own, so this is never slower than what it replaces.
 *
 * What it is for: deciding whether to send an already-signed-in visitor to
 * /home, and reading an id for a client-side insert. It is not a security
 * boundary — the server verifies independently and row-level security scopes
 * every write.
 *
 * The result is cached for the browser session and shared by every caller
 * (multiple simultaneous callers await the same promise), and it is invalidated
 * when the auth state changes.
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** The subset of the signed-in user that the JWT itself carries. */
export interface AuthUser {
  id: string;
  email: string | null;
}

// Session-scoped cache — persists across component mounts/unmounts.
let cachedUserPromise: Promise<AuthUser | null> | null = null;

async function readUser(): Promise<AuthUser | null> {
  try {
    const { data, error } = await createClient().auth.getClaims();
    if (error || !data?.claims?.sub) return null;
    const claims = data.claims as Record<string, unknown>;
    return {
      id: claims.sub as string,
      email: typeof claims.email === "string" ? claims.email : null,
    };
  } catch {
    return null; // graceful degradation: treat as signed out
  }
}

/**
 * The current user, or null when signed out.
 *
 * `loading` is true only until the token is decoded, which is local work — so
 * prefer rendering the real UI immediately over blocking on it.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!cachedUserPromise) cachedUserPromise = readUser();
    cachedUserPromise.then((u) => {
      if (!active) return;
      setUser(u);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  // Invalidate on sign-in / sign-out and pick up the new identity.
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      cachedUserPromise = null;
    });
    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}

/**
 * Drop the cached user so the next read is fresh.
 * Call after something changes the session out of band.
 */
export function resetCurrentUserCache() {
  cachedUserPromise = null;
}
