// Sorting and filtering for search results.
//
// The provider returns everything it has; shopping happens here, against the
// offers already on screen. Pure functions so the panel of controls and the
// list can't disagree about what "cheapest" or "morning" means.

import type { FlightOffer, HotelOffer } from "./travel-search";

export type FlightSort = "price" | "duration" | "departure" | "stops";
export type HotelSort = "recommended" | "price" | "guests" | "rating" | "name";

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
  minRating: number | null;      // star class
  minGuestScore: number | null;  // what guests said, out of 5
  maxPrice: number | null;
  pricedOnly: boolean;
  preferredOnly: boolean;        // only brands you collect with
}

export const EMPTY_HOTEL_FILTERS: HotelFilters = {
  minRating: null, minGuestScore: null, maxPrice: null, pricedOnly: false, preferredOnly: false,
};

export function filterHotels(
  offers: HotelOffer[],
  f: HotelFilters,
  isPreferred: (h: HotelOffer) => boolean = () => false,
): HotelOffer[] {
  return offers.filter((h) => {
    if (f.pricedOnly && h.price == null) return false;
    if (f.minRating != null && (h.rating ?? 0) < f.minRating) return false;
    // A property with no guest score isn't evidence of a bad one — but when
    // you ask for "4.0+ guests" you mean rated, so unrated drops out.
    if (f.minGuestScore != null && (h.guestScore ?? 0) < f.minGuestScore) return false;
    if (f.maxPrice != null && h.price != null && h.price > f.maxPrice) return false;
    if (f.preferredOnly && !isPreferred(h)) return false;
    return true;
  });
}

export function sortHotels(
  offers: HotelOffer[],
  sort: HotelSort,
  score: (h: HotelOffer) => number = () => 0,
): HotelOffer[] {
  const out = [...offers];
  switch (sort) {
    case "recommended": return out.sort((a, b) => score(b) - score(a));
    case "guests": return out.sort((a, b) => (b.guestScore ?? 0) - (a.guestScore ?? 0) || (b.reviews ?? 0) - (a.reviews ?? 0));
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

// ── Recommendation ──────────────────────────────────────────────────────
// "Should I book this one?" is a mix of how guests rate it, how many said so,
// its class, and whether it's a brand you actually collect points with. A 4.9
// from six reviews is noise; a 4.4 from three thousand is a signal.

export interface Recommendation {
  score: number;            // 0–100, for ordering
  label: string | null;     // badge text, when it earns one
  reasons: string[];        // why, in plain words
}

export function recommendHotel(
  h: { guestScore?: number | null; reviews?: number | null; rating: number | null; price: number | null },
  opts: { preferred?: boolean; cheapest?: number | null } = {},
): Recommendation {
  const reasons: string[] = [];
  let score = 0;

  const guests = h.guestScore ?? null;
  const reviews = h.reviews ?? 0;
  if (guests != null) {
    // Weight the score by how much evidence sits behind it.
    const confidence = Math.min(1, reviews / 300);
    score += (guests / 5) * 60 * (0.45 + 0.55 * confidence);
    if (guests >= 4.5 && reviews >= 300) reasons.push(`${guests.toFixed(1)}★ from ${reviews.toLocaleString()} guests`);
    else if (guests >= 4.3 && reviews >= 100) reasons.push(`Well reviewed (${guests.toFixed(1)})`);
    else if (reviews > 0 && reviews < 50) reasons.push(`Only ${reviews} reviews`);
  }
  if (h.rating) score += h.rating * 4;
  if (opts.preferred) { score += 15; reasons.push("A brand you collect with"); }
  if (h.price != null && opts.cheapest != null && h.price <= opts.cheapest * 1.1) {
    score += 10;
    reasons.push("Among the cheapest here");
  }

  const label =
    score >= 70 ? "Recommended" :
    opts.preferred ? "Your brand" :
    guests != null && guests >= 4.6 && reviews >= 500 ? "Guest favourite" : null;

  return { score: Math.round(score), label, reasons };
}
