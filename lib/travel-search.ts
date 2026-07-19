// Unified travel-search entry point. Delegates to whichever provider is
// configured — Duffel (preferred, when its token is set) else SerpApi.
// Routes/UI import from here, so adding or swapping a provider is a one-file change.

import * as duffel from "./duffel";
import * as serp from "./serpapi-travel";
import type { FlightSearchParams, HotelSearchParams } from "./duffel";

export type {
  FlightOffer, FlightSegment, HotelOffer, FlightSearchParams, HotelSearchParams,
} from "./duffel";

export type TravelProvider = "duffel" | "serpapi" | null;

/** Which provider will handle searches (Duffel wins if both are set). */
export function activeTravelProvider(): TravelProvider {
  if (duffel.duffelConfigured()) return "duffel";
  if (serp.serpapiConfigured()) return "serpapi";
  return null;
}

export function travelConfigured(): boolean {
  return activeTravelProvider() !== null;
}

export function searchFlights(p: FlightSearchParams) {
  return activeTravelProvider() === "duffel" ? duffel.searchFlights(p) : serp.searchFlights(p);
}

export function searchHotels(p: HotelSearchParams) {
  return activeTravelProvider() === "duffel" ? duffel.searchHotels(p) : serp.searchHotels(p);
}

export function cheapestFlightPrice(p: FlightSearchParams) {
  return activeTravelProvider() === "duffel" ? duffel.cheapestFlightPrice(p) : serp.cheapestFlightPrice(p);
}
