/* eslint-disable @typescript-eslint/no-explicit-any */
// Duffel travel API client — real flight + hotel inventory.
// Replaces Amadeus Self-Service (decommissioned July 2026).
// Reads DUFFEL_ACCESS_TOKEN from the environment (test token = duffel_test_…,
// live = duffel_live_…). Search & offers are free; you only pay on booking.
//
// Docs: https://duffel.com/docs/api

import { fetchWithRetry } from "./http-retry";

const BASE = "https://api.duffel.com";
const VERSION = "v2";

export function duffelConfigured(): boolean {
  return Boolean(process.env.DUFFEL_ACCESS_TOKEN);
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.DUFFEL_ACCESS_TOKEN ?? ""}`,
    "Duffel-Version": VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function duffelPost(path: string, body: unknown): Promise<any> {
  const res = await fetchWithRetry(
    `${BASE}${path}`,
    { method: "POST", headers: headers(), body: JSON.stringify(body) },
    { label: `Duffel ${path}` },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Duffel ${path} failed (${res.status}): ${txt.slice(0, 300)}`);
  }
  return res.json();
}

async function duffelGet(path: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE}${path}`, { headers: headers() }, { label: `Duffel ${path}` });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Duffel ${path} failed (${res.status}): ${txt.slice(0, 300)}`);
  }
  return res.json();
}

// ── Normalized shapes returned to the app ────────────────────────────
export interface FlightSegment {
  from: string;
  to: string;
  departAt: string;
  arriveAt: string;
  carrier: string;
  carrierName: string;
  flightNumber: string;
  duration: string;
}
export interface FlightOffer {
  id: string;
  price: number;
  currency: string;
  cabin: string;
  stops: number;
  carriers: string[];
  totalDuration: string;
  outbound: FlightSegment[];
  inbound: FlightSegment[] | null;
  seatsLeft: number | null;
}

export interface HotelOffer {
  id: string;
  name: string;
  chain: string | null;
  cityCode: string;
  rating: number | null;
  price: number | null;
  currency: string | null;
  checkIn: string | null;
  checkOut: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

export interface FlightSearchParams {
  origin: string;        // IATA, e.g. "IND"
  destination: string;   // IATA
  departDate: string;    // YYYY-MM-DD
  returnDate?: string;   // YYYY-MM-DD (omit for one-way)
  adults?: number;
  cabin?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
  nonStop?: boolean;
  currency?: string;
  maxResults?: number;
  includedAirlines?: string[]; // IATA carrier codes to prefer (client-side highlight)
}

export interface HotelSearchParams {
  query: string;         // city name, e.g. "New York"
  checkIn: string;       // YYYY-MM-DD
  checkOut: string;      // YYYY-MM-DD
  adults?: number;
  ratings?: number[];    // minimum rating filter applied post-search
  currency?: string;     // display only; Duffel returns supplier currency
  chains?: string[];     // client-side highlight only
  maxResults?: number;
  radiusKm?: number;
}

function isoDur(d: string | undefined): string {
  if (!d) return "";
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return "";
  const h = m[1] ? `${m[1]}h` : "";
  const mm = m[2] ? `${m[2]}m` : "";
  return [h, mm].filter(Boolean).join(" ");
}

const CABIN_MAP: Record<string, string> = {
  ECONOMY: "economy",
  PREMIUM_ECONOMY: "premium_economy",
  BUSINESS: "business",
  FIRST: "first",
};

export async function searchFlights(p: FlightSearchParams): Promise<FlightOffer[]> {
  const slices: any[] = [{ origin: p.origin.toUpperCase(), destination: p.destination.toUpperCase(), departure_date: p.departDate }];
  if (p.returnDate) slices.push({ origin: p.destination.toUpperCase(), destination: p.origin.toUpperCase(), departure_date: p.returnDate });

  const passengers = Array.from({ length: Math.max(1, p.adults ?? 1) }, () => ({ type: "adult" }));

  const body = {
    data: {
      slices,
      passengers,
      cabin_class: CABIN_MAP[p.cabin ?? "ECONOMY"] ?? "economy",
      ...(p.nonStop ? { max_connections: 0 } : {}),
    },
  };

  const data = await duffelPost("/air/offer_requests?return_offers=true", body);
  const offers: any[] = data.data?.offers ?? [];

  const mapSeg = (s: any): FlightSegment => ({
    from: s.origin?.iata_code,
    to: s.destination?.iata_code,
    departAt: s.departing_at,
    arriveAt: s.arriving_at,
    carrier: s.marketing_carrier?.iata_code ?? s.operating_carrier?.iata_code ?? "",
    carrierName: s.operating_carrier?.name ?? s.marketing_carrier?.name ?? "",
    flightNumber: `${s.marketing_carrier?.iata_code ?? ""}${s.marketing_carrier_flight_number ?? s.operating_carrier_flight_number ?? ""}`,
    duration: isoDur(s.duration),
  });

  const mapped: FlightOffer[] = offers.slice(0, p.maxResults ?? 30).map((o) => {
    const outSlice = o.slices?.[0];
    const inSlice = o.slices?.[1] ?? null;
    const outSegs = (outSlice?.segments ?? []).map(mapSeg);
    const inSegs = inSlice ? (inSlice.segments ?? []).map(mapSeg) : null;
    const carriers = Array.from(new Set([...outSegs, ...(inSegs ?? [])].map((s: FlightSegment) => s.carrier).filter(Boolean)));
    const stops = Math.max(0, outSegs.length - 1) + (inSegs ? Math.max(0, inSegs.length - 1) : 0);
    return {
      id: o.id,
      price: parseFloat(o.total_amount ?? "0"),
      currency: o.total_currency ?? p.currency ?? "USD",
      cabin: p.cabin ?? "ECONOMY",
      stops,
      carriers,
      totalDuration: isoDur(outSlice?.duration),
      outbound: outSegs,
      inbound: inSegs,
      seatsLeft: null,
    };
  });

  return mapped;
}

// Geocode a city name → coordinates via Duffel Places suggestions.
async function geocodeCity(query: string): Promise<{ lat: number; lng: number } | null> {
  const data = await duffelGet(`/places/suggestions?query=${encodeURIComponent(query)}`);
  const places: any[] = data.data ?? [];
  // Prefer a city; fall back to any place with coordinates.
  const city = places.find((x) => x.type === "city" && x.latitude != null) ?? places.find((x) => x.latitude != null);
  if (!city) return null;
  return { lat: Number(city.latitude), lng: Number(city.longitude) };
}

export async function searchHotels(p: HotelSearchParams): Promise<HotelOffer[]> {
  const coords = await geocodeCity(p.query);
  if (!coords) return [];

  const body = {
    data: {
      rooms: 1,
      guests: Array.from({ length: Math.max(1, p.adults ?? 1) }, () => ({ type: "adult" })),
      check_in_date: p.checkIn,
      check_out_date: p.checkOut,
      location: {
        radius: Math.min(100, Math.max(1, p.radiusKm ?? 15)),
        geographic_coordinates: { latitude: coords.lat, longitude: coords.lng },
      },
    },
  };

  const data = await duffelPost("/stays/search", body);
  const results: any[] = data.data?.results ?? [];
  const minRating = p.ratings?.length ? Math.min(...p.ratings) : 0;

  const mapped: HotelOffer[] = results.map((r) => {
    const a = r.accommodation ?? {};
    const price = r.cheapest_rate_total_amount ? parseFloat(r.cheapest_rate_total_amount) : null;
    const addr = a.location?.address;
    return {
      id: a.id ?? r.id,
      name: a.name ?? "Hotel",
      chain: a.brand ?? null,
      cityCode: p.query,
      rating: a.rating != null ? Number(a.rating) : null,
      price,
      currency: r.cheapest_rate_currency ?? null,
      checkIn: p.checkIn,
      checkOut: p.checkOut,
      latitude: a.location?.geographic_coordinates?.latitude ?? null,
      longitude: a.location?.geographic_coordinates?.longitude ?? null,
      address: addr ? [addr.line_one, addr.city_name].filter(Boolean).join(", ") : null,
    };
  });

  const filtered = minRating > 0 ? mapped.filter((h) => h.rating == null || h.rating >= minRating) : mapped;
  return filtered.slice(0, p.maxResults ?? 30);
}

// Cheapest live fare for a route — used by the price-watch cron.
export async function cheapestFlightPrice(p: FlightSearchParams): Promise<number | null> {
  const offers = await searchFlights({ ...p, maxResults: 30 });
  if (!offers.length) return null;
  return Math.min(...offers.map((o) => o.price));
}

// ── Booking (Phase 2) — only reachable when a Duffel token is configured ──────

export interface DuffelPassenger {
  given_name: string;
  family_name: string;
  born_on: string;            // YYYY-MM-DD
  gender: "m" | "f";
  title?: "mr" | "ms" | "mrs" | "miss";
  email: string;
  phone_number: string;       // E.164
  id?: string;                // passenger id from the offer request (intl)
}

/** Re-price/confirm an offer just before booking (prices can move / expire). */
export async function confirmOffer(offerId: string): Promise<{ price: number; currency: string; expiresAt: string | null } | null> {
  const data = await duffelGet(`/air/offers/${offerId}?return_available_services=false`);
  const o = data.data;
  if (!o) return null;
  return { price: parseFloat(o.total_amount ?? "0"), currency: o.total_currency ?? "USD", expiresAt: o.expires_at ?? null };
}

/** Create an instant order. Payment is funded from the Duffel balance (the app
 *  collects the customer's money via Stripe first, then books). */
export async function createOrder(args: {
  offerId: string; amount: string; currency: string; passengers: DuffelPassenger[];
}): Promise<{ orderId: string; bookingReference: string | null }> {
  const body = {
    data: {
      type: "instant",
      selected_offers: [args.offerId],
      passengers: args.passengers,
      payments: [{ type: "balance", amount: args.amount, currency: args.currency }],
    },
  };
  const data = await duffelPost("/air/orders", body);
  const order = data.data;
  return { orderId: order?.id, bookingReference: order?.booking_reference ?? null };
}
