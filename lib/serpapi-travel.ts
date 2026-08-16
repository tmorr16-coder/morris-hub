/* eslint-disable @typescript-eslint/no-explicit-any */
// SerpApi travel provider — real Google Flights + Google Hotels data.
// Instant-access alternative to Duffel (no business review needed).
// Reads SERPAPI_API_KEY. Free tier ~100 searches/mo, then paid.
//
// Docs: https://serpapi.com/google-flights-api · https://serpapi.com/google-hotels-api

import { fetchWithRetry } from "./http-retry";
import type {
  FlightOffer, FlightSegment, HotelOffer, FlightSearchParams, HotelSearchParams,
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
