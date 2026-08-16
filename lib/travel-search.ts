// Unified travel-search entry point. Delegates to whichever provider is
// configured — Duffel (preferred, when its token is set) else SerpApi.
// Routes/UI import from here, so adding or swapping a provider is a one-file change.
//
// Robustness lives here rather than in the routes: if the preferred provider
// errors we fall back to the other one instead of showing a dead end, and
// identical searches inside a short window are served from memory so a retap
// doesn't re-bill a metered API.

import * as duffel from "./duffel";
import * as serp from "./serpapi-travel";
import type { FlightSearchParams, HotelSearchParams, FlightOffer, HotelOffer, CarOffer, CarSearchParams } from "./duffel";

export type {
  FlightOffer, FlightSegment, HotelOffer, FlightSearchParams, HotelSearchParams, CarOffer, CarSearchParams,
} from "./duffel";

export type TravelProvider = "duffel" | "serpapi" | null;

/** A search plus how it was served — the UI says so when it wasn't first choice. */
export interface SearchOutcome<T> {
  offers: T[];
  provider: Exclude<TravelProvider, null>;
  /** Set when the preferred provider failed and the backup answered instead. */
  fellBackFrom?: { provider: Exclude<TravelProvider, null>; reason: string };
  cached?: boolean;
}

/** Which provider will handle searches (Duffel wins if both are set). */
export function activeTravelProvider(): TravelProvider {
  if (duffel.duffelConfigured()) return "duffel";
  if (serp.serpapiConfigured()) return "serpapi";
  return null;
}

export function travelConfigured(): boolean {
  return activeTravelProvider() !== null;
}

function configured(p: Exclude<TravelProvider, null>): boolean {
  return p === "duffel" ? duffel.duffelConfigured() : serp.serpapiConfigured();
}

// ── tiny TTL cache ──────────────────────────────────────────────────────
// Per-instance only. Enough to absorb a double-tap or a back-and-forth
// between tabs without another metered call.
const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 50;
const cache = new Map<string, { at: number; value: unknown }>();

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) { cache.delete(key); return null; }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
}

/**
 * Run a search on the preferred provider, falling back to the other one if it
 * errors. An empty result is an answer, not a failure — we don't spend a second
 * provider call on it.
 */
async function run<P, T>(
  kind: string,
  params: P,
  fns: Record<Exclude<TravelProvider, null>, (p: P) => Promise<T[]>>,
): Promise<SearchOutcome<T>> {
  const primary = activeTravelProvider();
  if (!primary) throw new Error("No travel provider configured.");

  const key = `${kind}:${primary}:${JSON.stringify(params)}`;
  const hit = cacheGet<SearchOutcome<T>>(key);
  if (hit) return { ...hit, cached: true };

  const backup: Exclude<TravelProvider, null> = primary === "duffel" ? "serpapi" : "duffel";
  try {
    const offers = await fns[primary](params);
    const outcome: SearchOutcome<T> = { offers, provider: primary };
    cacheSet(key, outcome);
    return outcome;
  } catch (err) {
    const reason = (err as Error).message;
    if (!configured(backup)) throw err; // nothing to fall back to — surface the real error
    console.error(`[travel] ${kind} via ${primary} failed, trying ${backup}:`, reason);
    const offers = await fns[backup](params);
    const outcome: SearchOutcome<T> = { offers, provider: backup, fellBackFrom: { provider: primary, reason } };
    cacheSet(key, outcome);
    return outcome;
  }
}

export function searchFlights(p: FlightSearchParams): Promise<SearchOutcome<FlightOffer>> {
  return run("flights", p, { duffel: duffel.searchFlights, serpapi: serp.searchFlights });
}

export function searchHotels(p: HotelSearchParams): Promise<SearchOutcome<HotelOffer>> {
  return run("hotels", p, { duffel: duffel.searchHotels, serpapi: serp.searchHotels });
}

/**
 * Cars come from SerpApi only — Duffel has no car inventory, so there is no
 * second provider to fall back to and no point pretending otherwise.
 */
export function carsConfigured(): boolean {
  return serp.serpapiConfigured();
}

export async function searchCars(p: CarSearchParams): Promise<SearchOutcome<CarOffer>> {
  if (!serp.serpapiConfigured()) throw new Error("Car search needs a SerpApi token.");
  const key = `cars:serpapi:${JSON.stringify(p)}`;
  const hit = cacheGet<SearchOutcome<CarOffer>>(key);
  if (hit) return { ...hit, cached: true };
  const offers = await serp.searchCars(p);
  const outcome: SearchOutcome<CarOffer> = { offers, provider: "serpapi" };
  cacheSet(key, outcome);
  return outcome;
}

/** Cheapest fare for a watch check — falls back the same way, price only. */
export async function cheapestFlightPrice(p: FlightSearchParams): Promise<number | null> {
  const primary = activeTravelProvider();
  if (!primary) return null;
  const backup: Exclude<TravelProvider, null> = primary === "duffel" ? "serpapi" : "duffel";
  const fns = { duffel: duffel.cheapestFlightPrice, serpapi: serp.cheapestFlightPrice };
  try {
    return await fns[primary](p);
  } catch (err) {
    if (!configured(backup)) throw err;
    console.error(`[travel] price check via ${primary} failed, trying ${backup}:`, (err as Error).message);
    return fns[backup](p);
  }
}
