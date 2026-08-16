/* eslint-disable @typescript-eslint/no-explicit-any */
// SerpApi travel provider — real Google Flights + Google Hotels data.
// Instant-access alternative to Duffel (no business review needed).
// Reads SERPAPI_API_KEY. Free tier ~100 searches/mo, then paid.
//
// Docs: https://serpapi.com/google-flights-api · https://serpapi.com/google-hotels-api

import { fetchWithRetry } from "./http-retry";
import type {
  FlightOffer, FlightSegment, HotelOffer, FlightSearchParams, HotelSearchParams, CarOffer, CarSearchParams,
} from "./duffel";

const BASE = "https://serpapi.com/search.json";

export function serpapiConfigured(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY);
}

async function serpGet(params: Record<string, string | number | undefined>): Promise<any> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  qs.set("api_key", process.env.SERPAPI_API_KEY ?? "");
  const res = await fetchWithRetry(`${BASE}?${qs.toString()}`, {}, { label: "SerpApi" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`SerpApi failed (${res.status}): ${(data.error ?? "").toString().slice(0, 200)}`);
  }
  return data;
}

function minutesToStr(min: number | undefined): string {
  if (!min || min <= 0) return "";
  const h = Math.floor(min / 60), m = min % 60;
  return [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ");
}

const CABIN_CLASS: Record<string, number> = { ECONOMY: 1, PREMIUM_ECONOMY: 2, BUSINESS: 3, FIRST: 4 };

function mapSeg(s: any): FlightSegment {
  const fn: string = s.flight_number ?? "";
  const codeMatch = fn.match(/^([A-Z]{1,3})\s?\d+/);
  const code = codeMatch ? codeMatch[1] : (s.airline ?? "").slice(0, 2).toUpperCase();
  return {
    from: s.departure_airport?.id ?? "",
    to: s.arrival_airport?.id ?? "",
    departAt: s.departure_airport?.time ?? "",
    arriveAt: s.arrival_airport?.time ?? "",
    carrier: code,
    carrierName: s.airline ?? "",
    flightNumber: fn.replace(/\s/g, ""),
    duration: minutesToStr(s.duration),
  };
}

export async function searchFlights(p: FlightSearchParams): Promise<FlightOffer[]> {
  const roundTrip = Boolean(p.returnDate);
  const data = await serpGet({
    engine: "google_flights",
    departure_id: p.origin.toUpperCase(),
    arrival_id: p.destination.toUpperCase(),
    outbound_date: p.departDate,
    return_date: roundTrip ? p.returnDate : undefined,
    type: roundTrip ? 1 : 2,
    travel_class: CABIN_CLASS[p.cabin ?? "ECONOMY"] ?? 1,
    adults: p.adults ?? 1,
    stops: p.nonStop ? 1 : 0,
    currency: p.currency ?? "USD",
    hl: "en",
    gl: "us",
  });

  const items: any[] = [...(data.best_flights ?? []), ...(data.other_flights ?? [])];
  const offers: FlightOffer[] = items.slice(0, p.maxResults ?? 30).map((it, idx) => {
    const segs: FlightSegment[] = (it.flights ?? []).map(mapSeg);
    const carriers: string[] = Array.from(new Set(segs.map((s) => s.carrier).filter(Boolean)));
    const stops = it.layovers?.length ?? Math.max(0, segs.length - 1);
    return {
      id: it.departure_token ?? it.booking_token ?? `serp-${idx}`,
      price: typeof it.price === "number" ? it.price : parseFloat(it.price ?? "0") || 0,
      currency: p.currency ?? "USD",
      cabin: p.cabin ?? "ECONOMY",
      stops,
      carriers,
      totalDuration: minutesToStr(it.total_duration),
      outbound: segs,
      inbound: null, // Google Flights returns return legs via a follow-up token; price shown is the round-trip total.
      seatsLeft: null,
    };
  });
  return offers;
}

function starClass(prop: any): number | null {
  if (typeof prop.extracted_hotel_class === "number") return prop.extracted_hotel_class;
  const m = (prop.hotel_class ?? "").match(/(\d)/);
  return m ? Number(m[1]) : null;
}

export async function searchHotels(p: HotelSearchParams): Promise<HotelOffer[]> {
  const data = await serpGet({
    engine: "google_hotels",
    q: p.query,
    check_in_date: p.checkIn,
    check_out_date: p.checkOut,
    adults: p.adults ?? 1,
    currency: p.currency ?? "USD",
    hl: "en",
    gl: "us",
  });

  const props: any[] = data.properties ?? [];
  const minRating = p.ratings?.length ? Math.min(...p.ratings) : 0;

  const mapped: HotelOffer[] = props.map((h, idx) => {
    const total = h.total_rate?.extracted_lowest;
    const nightly = h.rate_per_night?.extracted_lowest;
    return {
      id: h.property_token ?? `serp-hotel-${idx}`,
      name: h.name ?? "Hotel",
      chain: null,
      cityCode: p.query,
      rating: starClass(h),
      guestScore: typeof h.overall_rating === "number" ? h.overall_rating : null,
      reviews: typeof h.reviews === "number" ? h.reviews : null,
      amenities: Array.isArray(h.amenities) ? h.amenities.slice(0, 8).map((a: any) => String(a)) : [],
      link: h.link ?? null,
      thumbnail: h.images?.[0]?.thumbnail ?? null,
      price: typeof total === "number" ? total : (typeof nightly === "number" ? nightly : null),
      currency: p.currency ?? "USD",
      checkIn: p.checkIn,
      checkOut: p.checkOut,
      latitude: h.gps_coordinates?.latitude ?? null,
      longitude: h.gps_coordinates?.longitude ?? null,
      address: h.type ?? null,
    };
  });

  const filtered = minRating > 0 ? mapped.filter((h) => h.rating == null || h.rating >= minRating) : mapped;
  return filtered.slice(0, p.maxResults ?? 30);
}

export async function cheapestFlightPrice(p: FlightSearchParams): Promise<number | null> {
  const offers = await searchFlights({ ...p, maxResults: 30 });
  if (!offers.length) return null;
  return Math.min(...offers.map((o) => o.price));
}

// ── Additional travel tools (used by the AI travel agent) ────────────

export interface PlaceResult {
  name: string;
  rating: number | null;
  reviews: number | null;
  type: string | null;
  address: string | null;
  price: string | null;
}

/** Top attractions / things to do at a destination (SerpApi Google Maps). */
export async function thingsToDo(city: string, maxResults = 12): Promise<PlaceResult[]> {
  const data = await serpGet({ engine: "google_maps", type: "search", q: `top things to do in ${city}`, hl: "en" });
  const rows: any[] = data.local_results ?? [];
  return rows.slice(0, maxResults).map((r) => ({
    name: r.title,
    rating: r.rating ?? null,
    reviews: r.reviews ?? null,
    type: r.type ?? (Array.isArray(r.types) ? r.types[0] : null),
    address: r.address ?? null,
    price: r.price ?? null,
  }));
}

/** Rental-car options / offices at a destination (SerpApi Google Maps). */
export async function carRentals(city: string, maxResults = 10): Promise<PlaceResult[]> {
  const data = await serpGet({ engine: "google_maps", type: "search", q: `car rental in ${city}`, hl: "en" });
  const rows: any[] = data.local_results ?? [];
  return rows.slice(0, maxResults).map((r) => ({
    name: r.title,
    rating: r.rating ?? null,
    reviews: r.reviews ?? null,
    type: r.type ?? "Car rental",
    address: r.address ?? null,
    price: r.price ?? null,
  }));
}

export interface EventResult {
  title: string;
  date: string | null;
  venue: string | null;
  address: string | null;
  link: string | null;
}

/** Events (concerts, sports, festivals) at a destination (SerpApi Google Events). */
export async function searchEvents(city: string, when?: string, maxResults = 12): Promise<EventResult[]> {
  const q = when ? `events in ${city} ${when}` : `events in ${city}`;
  const data = await serpGet({ engine: "google_events", q, hl: "en" });
  const rows: any[] = data.events_results ?? [];
  return rows.slice(0, maxResults).map((e) => ({
    title: e.title,
    date: e.date?.when ?? e.date?.start_date ?? null,
    venue: e.venue?.name ?? null,
    address: Array.isArray(e.address) ? e.address.join(", ") : (e.address ?? null),
    link: e.link ?? null,
  }));
}

/**
 * Car rental options near a city.
 *
 * This is agency search (Google Maps local results), so it returns companies,
 * their ratings and where they are — not per-day quotes. Anything the listing
 * happens to price is passed through, but most rows have no price, and the UI
 * says so rather than implying we shopped rates. A real rates engine can be
 * dropped in behind this signature later without the callers changing.
 */
/**
 * Bookable car rates, when the account's plan carries a car-rentals engine.
 *
 * Written against the documented response shape; it has never been run against
 * the live engine from here, so it is defensive throughout — an unexpected
 * payload yields an empty list, and the caller falls back to agency search
 * rather than showing nothing. Set CAR_RATES_ENGINE to the engine name to turn
 * it on (e.g. "google_car_rentals"); unset means "don't try".
 */
export function carRatesConfigured(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY && process.env.CAR_RATES_ENGINE);
}

/**
 * Returns the cars plus a short description of the payload's shape. When the
 * engine answers but nothing maps, that description is what turns "no rates"
 * into a fixable report: it names the keys the provider actually sent, without
 * echoing any of their values.
 */
export async function carRates(p: CarSearchParams): Promise<{ offers: CarOffer[]; shape: string | null }> {
  if (!carRatesConfigured()) return { offers: [], shape: null };
  const days = rentalDays(p.pickUp, p.dropOff);

  const data = await serpGet({
    engine: process.env.CAR_RATES_ENGINE,
    q: p.city,
    pickup_date: p.pickUp,
    return_date: p.dropOff,
    currency: "USD",
    hl: "en",
    gl: "us",
  });

  // Providers disagree on the container name; take whichever is an array.
  const rows: any[] = [data.car_rentals, data.rentals, data.results, data.cars, data.local_results]
    .find((x) => Array.isArray(x) && x.length) ?? [];

  // Key names only — never values, which can carry personal or licensed data.
  const topKeys = Object.keys(data ?? {}).filter((k) => k !== "search_metadata" && k !== "search_parameters");
  const arrayKeys = topKeys.filter((k) => Array.isArray((data as any)[k]));
  const shape = rows.length
    ? null
    : `engine replied with: ${topKeys.slice(0, 10).join(", ") || "nothing"}${arrayKeys.length ? ` (lists: ${arrayKeys.join(", ")})` : " (no lists)"}`;

  const offers = rows.slice(0, p.maxResults ?? 20).map((r, idx): CarOffer => {
    const total = num(r.total_price ?? r.price?.total ?? r.extracted_price ?? r.price);
    const perDay = num(r.price_per_day ?? r.daily_rate ?? r.price?.per_day) ?? (total != null && days ? Math.round(total / days) : null);
    return {
      id: String(r.id ?? r.booking_token ?? `rate-${idx}`),
      company: String(r.company ?? r.provider ?? r.supplier ?? r.title ?? "Rental"),
      type: r.car_class ?? r.type ?? r.category ?? null,
      rating: num(r.rating),
      reviews: num(r.reviews),
      address: r.pickup_location ?? r.address ?? null,
      phone: r.phone ?? null,
      price: total,
      perDay,
      currency: r.currency ?? "USD",
      link: r.link ?? r.booking_link ?? null,
      source: "rates",
      vehicle: r.car_name ?? r.model ?? r.name ?? null,
      seats: num(r.seats ?? r.passengers),
      transmission: r.transmission ?? null,
      unlimitedMileage: typeof r.unlimited_mileage === "boolean" ? r.unlimited_mileage : null,
    };
  }).filter((c) => c.company);

  // Rows found but no prices parsed is the other fixable case — say which keys
  // the first row carries so the mapping can be corrected.
  const priced = offers.filter((c) => c.price != null || c.perDay != null).length;
  const rowShape = rows.length && !priced
    ? `found ${rows.length} rows but no price — row keys: ${Object.keys(rows[0] ?? {}).slice(0, 14).join(", ")}`
    : null;

  return { offers, shape: shape ?? rowShape };
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v.replace(/[^0-9.]/g, "")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Whole days between pick-up and drop-off, for a per-day figure. */
export function rentalDays(pickUp?: string, dropOff?: string): number | null {
  if (!pickUp || !dropOff) return null;
  const ms = Date.parse(`${dropOff}T12:00:00Z`) - Date.parse(`${pickUp}T12:00:00Z`);
  const days = Math.round(ms / 86400000);
  return days > 0 ? days : null;
}

export async function searchCars(p: CarSearchParams): Promise<CarOffer[]> {
  const data = await serpGet({ engine: "google_maps", type: "search", q: `car rental in ${p.city}`, hl: "en" });
  const rows: any[] = data.local_results ?? [];
  return rows.slice(0, p.maxResults ?? 20).map((r, idx) => ({
    id: r.place_id ?? `serp-car-${idx}`,
    company: r.title ?? "Car rental",
    type: r.type ?? null,
    rating: typeof r.rating === "number" ? r.rating : null,
    reviews: typeof r.reviews === "number" ? r.reviews : null,
    address: r.address ?? null,
    phone: r.phone ?? null,
    price: typeof r.price === "number" ? r.price : null,
    perDay: null,
    currency: null,
    link: r.website ?? null,
    source: "agency" as const,
  }));
}
