/**
 * Centralized auth utilities, scoped to a single request.
 *
 * These wrap the two ways of establishing who is making a request:
 *
 * - `getCurrentClaims()` verifies the JWT's signature locally. No network.
 * - `getCurrentUser()` asks Supabase to verify it. One network round trip.
 *
 * Anything that needs only an id or a role goes through the first. Only a
 * caller that needs the full, freshly-read user record pays for the second.
 * Both are wrapped in React's `cache()`, so repeated calls within one request
 * share one result and nothing leaks between requests.
 *
 * Usage:
 * - requireUser(): throws if not authenticated, returns the full user object
 * - requireAdmin(): throws unless authenticated and an admin, returns {id, db}
 * - getCurrentUserId(): returns userId or null, never throws
 * - getUserOptional(): returns user object or null, never throws
 */

import { cache } from "react";
import { createServiceClient, getCurrentClaims, getCurrentUser } from "./server";
import type { User } from "@supabase/supabase-js";

/**
 * Why this module no longer keeps its own cache.
 *
 * It used to hold the signed-in user in two module-level variables:
 *
 *     let cachedUser: User | null | undefined;
 *     let cacheInitialized = false;
 *
 * described in a comment as "function-scoped, resets per async context". They
 * were neither. A module is evaluated once per server process and its bindings
 * outlive every request that process handles, so on a warm instance the first
 * authenticated request populated `cachedUser` and every later request — a
 * different person's, or nobody's — was handed that same identity by
 * `getCurrentUserId()`, `requireUser()` and `requireAdmin()`. The only reset
 * was an exported `resetAuthCache()` that nothing ever called.
 *
 * React's `cache()` is the thing that comment described: it keys on the current
 * request, so a second call inside one request is free and a call from the next
 * request starts clean. `resetAuthCache()` is gone with the cache it cleared.
 */

/**
 * Current user's id, or null. Verified locally — no round trip.
 *
 * This is the hot one: it stands in front of most API routes and server
 * actions in the app, which need an id to scope a query and nothing more.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const claims = await getCurrentClaims();
  return claims?.id ?? null;
}

/**
 * Full user record, or null. Costs one round trip to Supabase.
 *
 * Prefer `getCurrentUserId()` unless you genuinely need fields the JWT does not
 * carry, or metadata that may have changed since the token was issued.
 */
export async function getUserOptional(): Promise<User | null> {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

/** Full user record. Throws if not signed in. */
export async function requireUser(): Promise<User> {
  const user = await getUserOptional();
  if (!user) throw new Error("Authentication required");
  return user;
}

/** One `profiles.role` read per request, shared by the two checks below. */
const currentUserRole = cache(async (userId: string): Promise<string | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data } = await db
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (data as { role: string } | null)?.role ?? null;
});

/**
 * Require authentication AND the admin role.
 *
 * Returns the user id alongside a service client for administrative work.
 * Throws if the caller is not signed in, or is not an admin.
 */
export async function requireAdmin(): Promise<{ id: string; db: ReturnType<typeof createServiceClient> }> {
  const id = await getCurrentUserId();
  if (!id) throw new Error("Authentication required");
  if ((await currentUserRole(id)) !== "admin") {
    throw new Error("Admin access required");
  }
  return { id, db: createServiceClient() };
}

/** Whether the caller is an admin. False when signed out. Never throws. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const id = await getCurrentUserId();
  if (!id) return false;
  try {
    return (await currentUserRole(id)) === "admin";
  } catch {
    return false;
  }
}
