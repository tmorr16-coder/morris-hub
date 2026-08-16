// Sorting and filtering for search results.
//
// The provider returns everything it has; shopping happens here, against the
// offers already on screen. Pure functions so the panel of controls and the
// list can't disagree about what "cheapest" or "morning" means.

import type { FlightOffer, HotelOffer } from "./travel-search";

export type FlightSort = "price" | "duration" | "departure" | "stops";
export type HotelSort = "price" | "rating" | "name";

export interface FlightFilters {
  maxStops: number | null;        // 0 = non-stop only
  airlines: string[];             // carrier codes to keep; empty = all
  maxPrice: number | null;
  departWindows: TimeWindow[];    // empty = any time
}

export type TimeWindow = "early" | "morning" | "afternoon" | "evening";

export const TIME_WINDOWS: { key: TimeWindow; label: string; from: number; to: number }[] = [
  { key: "early", label: "Before 6am", from: 0, to: 6 },
  { key: "morning", label: "6am–noon", from: 6, to: 12 },
  { key: "afternoon", label: "Noon–6pm", from: 12, to: 18 },
  { key: "evening", label: "After 6pm", from: 18, to: 24 },
];

export const EMPTY_FLIGHT_FILTERS: FlightFilters = {
  maxStops: null, airlines: [], maxPrice: null, departWindows: [],
};

/** Minutes out of "7h 45m" / "7h" / "45m", for duration sorting. */
export function durationMinutes(text: string | null | undefined): number {
  if (!text) return Number.MAX_SAFE_INTEGER;
  const h = Number(text.match(/(\d+)\s*h/i)?.[1] ?? 0);
  const m = Number(text.match(/(\d+)\s*m/i)?.[1] ?? 0);
  const total = h * 60 + m;
  return total > 0 ? total : Number.MAX_SAFE_INTEGER;
}

/** Local hour of departure, for the time-of-day filter. */
function departHour(offer: FlightOffer): number | null {
  const at = offer.outbound?.[0]?.departAt;
  if (!at) return null;
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? null : d.getHours();
}

export function inWindow(hour: number, window: TimeWindow): boolean {
  const w = TIME_WINDOWS.find((x) => x.key === window);
  return !!w && hour >= w.from && hour < w.to;
}

/** Every airline present in a result set, for building the filter chips. */
export function airlinesIn(offers: FlightOffer[]): string[] {
  return [...new Set(offers.flatMap((o) => o.carriers ?? []))].filter(Boolean).sort();
}

export function priceRange(offers: { price: number | null }[]): { min: number; max: number } | null {
  const prices = offers.map((o) => o.price).filter((p): p is number => typeof p === "number" && p > 0);
  if (!prices.length) return null;
  return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
}

export function filterFlights(offers: FlightOffer[], f: FlightFilters): FlightOffer[] {
  return offers.filter((o) => {
    if (f.maxStops != null && (o.stops ?? 0) > f.maxStops) return false;
    if (f.maxPrice != null && o.price > f.maxPrice) return false;
    if (f.airlines.length && !(o.carriers ?? []).some((c) => f.airlines.includes(c))) return false;
    if (f.departWindows.length) {
      const hour = departHour(o);
      // An offer with no departure time can't be excluded on time — keep it
      // rather than silently dropping a result the provider did give us.
      if (hour != null && !f.departWindows.some((w) => inWindow(hour, w))) return false;
    }
    return true;
  });
}

export function sortFlights(offers: FlightOffer[], sort: FlightSort): FlightOffer[] {
  const out = [...offers];
  switch (sort) {
    case "duration": return out.sort((a, b) => durationMinutes(a.totalDuration) - durationMinutes(b.totalDuration));
    case "departure": return out.sort((a, b) => (a.outbound?.[0]?.departAt ?? "").localeCompare(b.outbound?.[0]?.departAt ?? ""));
    case "stops": return out.sort((a, b) => (a.stops ?? 0) - (b.stops ?? 0) || a.price - b.price);
    default: return out.sort((a, b) => a.price - b.price);
  }
}

export interface HotelFilters {
  minRating: number | null;
  maxPrice: number | null;
  pricedOnly: boolean;
}

export const EMPTY_HOTEL_FILTERS: HotelFilters = { minRating: null, maxPrice: null, pricedOnly: false };

export function filterHotels(offers: HotelOffer[], f: HotelFilters): HotelOffer[] {
  return offers.filter((h) => {
    if (f.pricedOnly && h.price == null) return false;
    if (f.minRating != null && (h.rating ?? 0) < f.minRating) return false;
    if (f.maxPrice != null && h.price != null && h.price > f.maxPrice) return false;
    return true;
  });
}

export function sortHotels(offers: HotelOffer[], sort: HotelSort): HotelOffer[] {
  const out = [...offers];
  switch (sort) {
    case "rating": return out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "name": return out.sort((a, b) => a.name.localeCompare(b.name));
    default:
      // Unpriced listings sink to the bottom either way — they can't be compared.
      return out.sort((a, b) => {
        if (a.price == null && b.price == null) return 0;
        if (a.price == null) return 1;
        if (b.price == null) return -1;
        return a.price - b.price;
      });
  }
}
