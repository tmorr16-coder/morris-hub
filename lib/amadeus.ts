/* eslint-disable @typescript-eslint/no-explicit-any */
// Amadeus Self-Service API client — real flight + hotel inventory.
// Reads AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET from the environment.
// Uses the test host by default; set AMADEUS_HOSTNAME=production to go live.
//
// Docs: https://developers.amadeus.com/self-service

const HOST =
  process.env.AMADEUS_HOSTNAME === "production"
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";

export function amadeusConfigured(): boolean {
  return Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
}

// ── OAuth token (client-credentials), cached in-process ──────────────
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 30_000) return tokenCache.token;
  const res = await fetch(`${HOST}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AMADEUS_CLIENT_ID ?? "",
      client_secret: process.env.AMADEUS_CLIENT_SECRET ?? "",
    }),
  });
  if (!res.ok) throw new Error(`Amadeus auth failed (${res.status})`);
  const data = await res.json();
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function amadeusGet(path: string, params: Record<string, string | number | undefined>): Promise<any> {
  const token = await getToken();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const res = await fetch(`${HOST}${path}?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Amadeus ${path} failed (${res.status}): ${body.slice(0, 300)}`);
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
  includedAirlines?: string[]; // IATA carrier codes to prefer
}

function isoDur(d: string | undefined): string {
  if (!d) return "";
  // PT5H30M -> "5h 30m"
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return "";
  const h = m[1] ? `${m[1]}h` : "";
  const mm = m[2] ? `${m[2]}m` : "";
  return [h, mm].filter(Boolean).join(" ");
}

export async function searchFlights(p: FlightSearchParams): Promise<FlightOffer[]> {
  const data = await amadeusGet("/v2/shopping/flight-offers", {
    originLocationCode: p.origin.toUpperCase(),
    destinationLocationCode: p.destination.toUpperCase(),
    departureDate: p.departDate,
    returnDate: p.returnDate,
    adults: p.adults ?? 1,
    travelClass: p.cabin ?? "ECONOMY",
    nonStop: p.nonStop ? "true" : undefined,
    currencyCode: p.currency ?? "USD",
    max: p.maxResults ?? 20,
    includedAirlineCodes: p.includedAirlines?.length ? p.includedAirlines.join(",") : undefined,
  });

  const offers: any[] = data.data ?? [];
  return offers.map((o) => {
    const itineraries: any[] = o.itineraries ?? [];
    const mapSeg = (s: any): FlightSegment => ({
      from: s.departure?.iataCode,
      to: s.arrival?.iataCode,
      departAt: s.departure?.at,
      arriveAt: s.arrival?.at,
      carrier: s.carrierCode,
      flightNumber: `${s.carrierCode}${s.number}`,
      duration: isoDur(s.duration),
    });
    const outSegs = (itineraries[0]?.segments ?? []).map(mapSeg);
    const inSegs = itineraries[1] ? (itineraries[1].segments ?? []).map(mapSeg) : null;
    const carriers = Array.from(new Set([...outSegs, ...(inSegs ?? [])].map((s: FlightSegment) => s.carrier)));
    const stops = Math.max(0, outSegs.length - 1) + (inSegs ? Math.max(0, inSegs.length - 1) : 0);
    return {
      id: o.id,
      price: parseFloat(o.price?.grandTotal ?? o.price?.total ?? "0"),
      currency: o.price?.currency ?? "USD",
      cabin: o.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin ?? (p.cabin ?? "ECONOMY"),
      stops,
      carriers,
      totalDuration: isoDur(itineraries[0]?.duration),
      outbound: outSegs,
      inbound: inSegs,
      seatsLeft: o.numberOfBookableSeats ?? null,
    };
  });
}

export interface HotelSearchParams {
  cityCode: string;      // IATA city code, e.g. "NYC"
  checkIn: string;       // YYYY-MM-DD
  checkOut: string;      // YYYY-MM-DD
  adults?: number;
  ratings?: number[];    // e.g. [4,5]
  currency?: string;
  chains?: string[];     // Amadeus 2-letter chain codes to prefer
  maxResults?: number;
}

export async function searchHotels(p: HotelSearchParams): Promise<HotelOffer[]> {
  // Step 1: hotels in the city (optionally filtered by rating/chain).
  const list = await amadeusGet("/v1/reference-data/locations/hotels/by-city", {
    cityCode: p.cityCode.toUpperCase(),
    ratings: p.ratings?.length ? p.ratings.join(",") : undefined,
    chainCodes: p.chains?.length ? p.chains.join(",") : undefined,
  });
  const hotels: any[] = (list.data ?? []).slice(0, p.maxResults ?? 20);
  if (hotels.length === 0) return [];

  // Step 2: live offers/prices for those hotel IDs.
  const ids = hotels.map((h) => h.hotelId).slice(0, 20).join(",");
  let priced: Record<string, any> = {};
  try {
    const offers = await amadeusGet("/v3/shopping/hotel-offers", {
      hotelIds: ids,
      checkInDate: p.checkIn,
      checkOutDate: p.checkOut,
      adults: p.adults ?? 1,
      currency: p.currency ?? "USD",
      bestRateOnly: "true",
    });
    for (const entry of offers.data ?? []) {
      priced[entry.hotel?.hotelId] = entry;
    }
  } catch {
    // Pricing can fail for some hotels/dates — fall back to unpriced listings.
    priced = {};
  }

  return hotels.map((h) => {
    const offer = priced[h.hotelId];
    const first = offer?.offers?.[0];
    return {
      id: h.hotelId,
      name: h.name,
      chain: h.chainCode ?? null,
      cityCode: p.cityCode.toUpperCase(),
      rating: h.rating ? Number(h.rating) : null,
      price: first ? parseFloat(first.price?.total ?? "0") : null,
      currency: first?.price?.currency ?? (offer ? p.currency ?? "USD" : null),
      checkIn: first?.checkInDate ?? p.checkIn,
      checkOut: first?.checkOutDate ?? p.checkOut,
      latitude: h.geoCode?.latitude ?? null,
      longitude: h.geoCode?.longitude ?? null,
      address: h.address?.lines?.join(", ") ?? null,
    };
  });
}

// Cheapest live price for a watch — used by the price-watch cron.
export async function cheapestFlightPrice(p: FlightSearchParams): Promise<number | null> {
  const offers = await searchFlights({ ...p, maxResults: 20 });
  if (!offers.length) return null;
  return Math.min(...offers.map((o) => o.price));
}
