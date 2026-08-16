"use client";

import { useMemo, useState } from "react";
import type { CarOffer, FlightOffer, HotelOffer } from "@/lib/travel-search";
import {
  EMPTY_FLIGHT_FILTERS, EMPTY_HOTEL_FILTERS, filterFlights, filterHotels, recommendHotel, sortFlights, sortHotels,
  type FlightFilters, type FlightSort, type HotelFilters, type HotelSort,
} from "@/lib/offer-filters";
import { isPreferredBrand } from "@/lib/brands";
import { pointsQuote, formatPoints, type LoyaltyBalance } from "@/lib/points";
import { airportLabel } from "@/lib/airports";
import AirportField from "./AirportField";
import DestinationField from "./DestinationField";
import SaveToTrip from "./SaveToTrip";
import { FlightShopControls, HotelShopControls } from "./ShopControls";
import { flightBookingLinks, hotelBookingLinks } from "@/lib/booking-links";
import { CABINS, type TravelPreferences, type LoyaltyProgram } from "../types";

function money(n: number | null, ccy = "USD"): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(n);
}
function time(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function day(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

type Mode = "flights" | "hotels" | "cars";

export default function SearchClient({
  prefs, loyalty, connected,
}: {
  prefs: TravelPreferences; loyalty: LoyaltyProgram[]; connected: boolean;
}) {
  const [mode, setMode] = useState<Mode>("flights");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Flight form
  const [origin, setOrigin] = useState(prefs.home_airport ?? "");
  const [destination, setDestination] = useState("");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [cabin, setCabin] = useState(prefs.cabin_class ?? "ECONOMY");
  const [nonStop, setNonStop] = useState(false);
  const [flights, setFlights] = useState<FlightOffer[] | null>(null);

  // Hotel form
  const [city, setCity] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [hotels, setHotels] = useState<HotelOffer[] | null>(null);

  // Car form
  const [carCity, setCarCity] = useState("");
  const [cars, setCars] = useState<CarOffer[] | null>(null);
  const [carPickUp, setCarPickUp] = useState("");
  const [carDropOff, setCarDropOff] = useState("");
  const [carMode, setCarMode] = useState<"rates" | "agency" | null>(null);
  const [ratesNote, setRatesNote] = useState<string | null>(null);
  // Nearby stay prices, same opt-in shape as flights.
  const [hotelNearby, setHotelNearby] = useState<{ date: string; checkOut?: string; price: number | null }[] | null>(null);
  const [hotelNearbyBusy, setHotelNearbyBusy] = useState(false);
  // Show prices as points wherever we can value them.
  const [inPoints, setInPoints] = useState(false);
  // Cheapest fare on adjacent days — each one costs a provider call, so it is
  // asked for, never automatic.
  const [nearby, setNearby] = useState<{ date: string; price: number | null }[] | null>(null);
  const [nearbyBusy, setNearbyBusy] = useState(false);

  const balances: LoyaltyBalance[] = loyalty.map((l) => ({
    program_name: l.program_name, category: l.category, points_balance: l.points_balance ?? null, tier: l.tier,
  }));
  const preferredCarCompanies = (prefs as { preferred_car_companies?: string[] }).preferred_car_companies ?? [];
  const airPrograms = loyalty.filter((l) => l.category === "air").map((l) => l.program_name.toLowerCase());
  const hotelPrograms = loyalty.filter((l) => l.category === "hotel").map((l) => l.program_name.toLowerCase());
  const preferredAir = prefs.preferred_airlines.map((a) => a.toUpperCase());
  const preferredChains = prefs.preferred_hotel_chains.map((c) => c.toUpperCase());

  const [watchMsg, setWatchMsg] = useState<string | null>(null);

  // How the last search was served — provider, whether it was a fallback, cache.
  const [served, setServed] = useState<{ provider?: string; fellBackFrom?: { provider: string; reason: string }; cached?: boolean } | null>(null);
  // Validation problems read as guidance, not as a provider failure.
  const [invalid, setInvalid] = useState<string | null>(null);
  // Shopping state — applied to the offers already on screen, never re-queried.
  const [flightSort, setFlightSort] = useState<FlightSort>("price");
  const [flightFilters, setFlightFilters] = useState<FlightFilters>(EMPTY_FLIGHT_FILTERS);
  const [hotelSort, setHotelSort] = useState<HotelSort>("recommended");
  const [hotelFilters, setHotelFilters] = useState<HotelFilters>(EMPTY_HOTEL_FILTERS);
  const visibleFlights = useMemo(
    () => (flights ? sortFlights(filterFlights(flights, flightFilters), flightSort) : []),
    [flights, flightFilters, flightSort],
  );
  const hotelPreferred = useMemo(
    () => (h: HotelOffer) => isPreferredBrand(`${h.name} ${h.chain ?? ""}`, prefs.preferred_hotel_chains, "hotel"),
    [prefs.preferred_hotel_chains],
  );
  const cheapestHotel = useMemo(
    () => (hotels ?? []).reduce<number | null>((min, h) => (h.price != null && (min == null || h.price < min) ? h.price : min), null),
    [hotels],
  );
  const hotelScore = useMemo(
    () => (h: HotelOffer) => recommendHotel(h, { preferred: hotelPreferred(h), cheapest: cheapestHotel }).score,
    [hotelPreferred, cheapestHotel],
  );
  const visibleHotels = useMemo(
    () => (hotels ? sortHotels(filterHotels(hotels, hotelFilters, hotelPreferred), hotelSort, hotelScore) : []),
    [hotels, hotelFilters, hotelSort, hotelPreferred, hotelScore],
  );

  async function searchFlights() {
    setErr(null); setInvalid(null); setServed(null); setBusy(true); setFlights(null); setFlightFilters(EMPTY_FLIGHT_FILTERS); setNearby(null);
    try {
      const res = await fetch("/api/travel/flights", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin, destination, departDate, returnDate: returnDate || undefined,
          adults, cabin, nonStop, currency: prefs.currency,
          includedAirlines: preferredAir.length ? preferredAir : undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 400) { setInvalid(data.message ?? "Check the search details."); return; }
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Search failed");
      setFlights(data.offers ?? []);
      setServed({ provider: data.provider, fellBackFrom: data.fellBackFrom, cached: data.cached });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function searchHotels() {
    setErr(null); setInvalid(null); setServed(null); setBusy(true); setHotels(null); setHotelFilters(EMPTY_HOTEL_FILTERS); setHotelNearby(null);
    try {
      const res = await fetch("/api/travel/hotels", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: city, checkIn, checkOut, adults, currency: prefs.currency,
          ratings: prefs.hotel_min_rating ? [prefs.hotel_min_rating] : undefined,
          chains: preferredChains.length ? preferredChains : undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 400) { setInvalid(data.message ?? "Check the search details."); return; }
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Search failed");
      setHotels(data.offers ?? []);
      setServed({ provider: data.provider, fellBackFrom: data.fellBackFrom, cached: data.cached });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function loadHotelNearby() {
    setHotelNearbyBusy(true); setErr(null);
    try {
      const res = await fetch("/api/travel/hotels/nearby", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: city, checkIn, checkOut, adults, currency: prefs.currency, spread: 2 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Couldn't price nearby dates.");
      setHotelNearby(data.days ?? []);
    } catch (e) { setErr((e as Error).message); } finally { setHotelNearbyBusy(false); }
  }

  async function loadNearby() {
    setNearbyBusy(true); setErr(null);
    try {
      const res = await fetch("/api/travel/flights/nearby", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, departDate, returnDate: returnDate || undefined, adults, cabin, nonStop, currency: prefs.currency, spread: 2 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Couldn't price nearby dates.");
      setNearby(data.days ?? []);
    } catch (e) { setErr((e as Error).message); } finally { setNearbyBusy(false); }
  }

  async function searchCars() {
    setErr(null); setInvalid(null); setServed(null); setBusy(true); setCars(null);
    try {
      const res = await fetch("/api/travel/cars", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: carCity, pickUp: carPickUp || undefined, dropOff: carDropOff || undefined, maxResults: 20 }),
      });
      const data = await res.json();
      if (res.status === 400) { setInvalid(data.message ?? "Check the search details."); return; }
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Search failed");
      setCars(data.offers ?? []);
      setCarMode(data.mode ?? "agency");
      setRatesNote(data.ratesNote ?? null);
      setServed({ provider: data.provider, cached: data.cached });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function watchFlight(price: number) {
    setWatchMsg(null);
    const target = window.prompt(`Alert me when ${origin} → ${destination} drops to (USD):`, String(Math.round(price * 0.9)));
    if (target == null) return;
    const targetPrice = parseFloat(target);
    if (isNaN(targetPrice)) return;
    const res = await fetch("/api/travel/watches", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "flight", origin, destination, depart_date: departDate,
        return_date: returnDate || null, cabin, adults, target_price: targetPrice, last_price: price, notify: true,
      }),
    });
    setWatchMsg(res.ok ? `Alert set — we'll email you when it hits ${money(targetPrice)}.` : "Couldn't set the alert.");
  }

  return (
    <div>
      {/* Segmented mode */}
      <div style={{ display: "flex", gap: 6, background: "var(--ios-fill)", borderRadius: 10, padding: 3, margin: "0 0 12px" }}>
        {(["flights", "hotels", "cars"] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer",
              background: mode === m ? "var(--ios-bg-elevated, #fff)" : "transparent", color: mode === m ? "var(--ios-label)" : "var(--ios-label-2)" }}>
            {m === "flights" ? "✈️ Flights" : m === "hotels" ? "🏨 Hotels" : "🚗 Cars"}
          </button>
        ))}
      </div>

      {!connected && (
        <div className="ios-list" style={{ margin: "0 0 12px", padding: 14 }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            Live results need a search provider token (SerpApi or Duffel). You can still set up preferences and loyalty programs — searches will return results once search is connected.
          </div>
        </div>
      )}

      {/* ── Flight form ── */}
      {mode === "flights" && (
        <div className="ios-list" style={{ margin: "0 0 12px", padding: 16 }}>
          <AirportField label="From" value={origin} onChange={setOrigin} placeholder="City or code" />
          <AirportField label="To" value={destination} onChange={setDestination} placeholder="City or code" />
          <Field label="Depart"><Text value={departDate} onChange={setDepartDate} placeholder="YYYY-MM-DD" type="date" /></Field>
          <Field label="Return (optional)"><Text value={returnDate} onChange={setReturnDate} placeholder="YYYY-MM-DD" type="date" /></Field>
          <Field label="Travelers"><Num value={adults} onChange={setAdults} min={1} max={9} /></Field>
          <Field label="Cabin">
            <select value={cabin} onChange={(e) => setCabin(e.target.value)} style={selectStyle}>
              {CABINS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
            <span className="ios-subhead">Non-stop only</span>
            <input type="checkbox" checked={nonStop} onChange={(e) => setNonStop(e.target.checked)} />
          </label>
          {preferredAir.length > 0 && (
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", lineHeight: 1.4 }}>Prioritizing your preferred airlines: {preferredAir.join(", ")}</div>
          )}
          <button onClick={searchFlights} disabled={busy || !origin || !destination || !departDate} style={primaryBtn(busy)}>
            {busy ? "Searching…" : "Search flights"}
          </button>
        </div>
      )}

      {/* ── Hotel form ── */}
      {mode === "hotels" && (
        <div className="ios-list" style={{ margin: "0 0 12px", padding: 16 }}>
          <DestinationField value={city} onChange={setCity} />
          <Field label="Check-in"><Text value={checkIn} onChange={setCheckIn} placeholder="YYYY-MM-DD" type="date" /></Field>
          <Field label="Check-out"><Text value={checkOut} onChange={setCheckOut} placeholder="YYYY-MM-DD" type="date" /></Field>
          <Field label="Guests"><Num value={adults} onChange={setAdults} min={1} max={9} /></Field>
          {preferredChains.length > 0 && (
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", lineHeight: 1.4 }}>Highlighting preferred chains: {preferredChains.join(", ")} · min {prefs.hotel_min_rating}★</div>
          )}
          <button onClick={searchHotels} disabled={busy || city.trim().length < 2 || !checkIn || !checkOut} style={primaryBtn(busy)}>
            {busy ? "Searching…" : "Search hotels"}
          </button>
          <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 8, lineHeight: 1.45 }}>
            Search a city, a whole state (&ldquo;Colorado&rdquo;), an area (&ldquo;Napa Valley&rdquo;), or a property by name.
          </div>
        </div>
      )}

      {invalid && (
        <div className="ios-list" style={{ margin: "0 0 12px", padding: 14, border: "1.5px solid var(--ios-orange, #D9772B)" }}>
          <div className="ios-subhead" style={{ color: "var(--ios-label)", lineHeight: 1.5 }}>{invalid}</div>
        </div>
      )}
      {err && (
        <div className="ios-list" style={{ margin: "0 0 12px", padding: 14 }}>
          <div className="ios-subhead" style={{ color: "var(--ios-red, #FF3B30)", lineHeight: 1.5 }}>Search couldn&apos;t complete: {err}</div>
          <button onClick={() => (mode === "flights" ? searchFlights() : searchHotels())} disabled={busy}
            className="ios-caption" style={{ marginTop: 10, background: "none", border: "1px solid var(--ios-separator)", borderRadius: 10, color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "7px 14px" }}>
            Try again
          </button>
        </div>
      )}
      {served?.fellBackFrom && (
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "0 4px 12px", lineHeight: 1.5 }}>
          {served.fellBackFrom.provider === "duffel" ? "Duffel" : "SerpApi"} didn&apos;t answer, so these came from{" "}
          {served.provider === "duffel" ? "Duffel" : "SerpApi"} instead.
        </div>
      )}
      {watchMsg && <div className="ios-footnote" style={{ color: "var(--ios-green)", padding: "0 4px 12px" }}>{watchMsg}</div>}

      {/* ── Car form ── */}
      {mode === "cars" && (
        <div className="ios-list" style={{ margin: "0 0 12px", padding: 16 }}>
          <Field label="Near"><Text value={carCity} onChange={setCarCity} placeholder="Madrid or MAD" /></Field>
          <Field label="Pick up"><Text value={carPickUp} onChange={setCarPickUp} placeholder="YYYY-MM-DD" type="date" /></Field>
          <Field label="Drop off"><Text value={carDropOff} onChange={setCarDropOff} placeholder="YYYY-MM-DD" type="date" /></Field>
          {preferredCarCompanies.length > 0 && (
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", lineHeight: 1.4 }}>Highlighting your companies: {preferredCarCompanies.join(", ")}</div>
          )}
          <button onClick={searchCars} disabled={busy || carCity.trim().length < 2} style={primaryBtn(busy)}>
            {busy ? "Searching…" : "Find car rental"}
          </button>
          <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 8, lineHeight: 1.45 }}>
            With dates and a car-rates engine configured, this quotes actual cars. Without either, it falls back to rental locations near you and says so.
          </div>
        </div>
      )}

      {/* Points toggle — only worth showing once there are balances to price against */}
      {balances.length > 0 && (mode !== "cars") && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px 10px", cursor: "pointer" }}>
          <input type="checkbox" checked={inPoints} onChange={(e) => setInPoints(e.target.checked)} style={{ width: 18, height: 18 }} />
          <span className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>Also show prices in points</span>
        </label>
      )}

      {/* ── Flight results ── */}
      {mode === "flights" && flights && (
        <>
          <div className="ios-group-header" style={{ padding: "4px 0 7px" }}>
            {flights.length} FLIGHT{flights.length === 1 ? "" : "S"}
            {origin && destination ? ` · ${airportLabel(origin)} → ${airportLabel(destination)}` : ""}
          </div>
          {flights.length > 0 && (
            <div className="ios-list" style={{ margin: "0 0 10px", padding: 14 }}>
              {!nearby && (
                <>
                  <button onClick={loadNearby} disabled={nearbyBusy} className="ios-caption"
                    style={{ background: "none", border: "1px solid var(--ios-separator)", borderRadius: 10, color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "8px 14px" }}>
                    {nearbyBusy ? "Pricing nearby dates…" : "Check nearby dates"}
                  </button>
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6, lineHeight: 1.45 }}>
                    Prices the two days either side. That&apos;s four more provider searches, so it only runs when you ask.
                  </div>
                </>
              )}
              {nearby && (
                <>
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)", fontWeight: 700, marginBottom: 6 }}>NEARBY DATES</div>
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                    {[...nearby, { date: departDate, price: flights.length ? Math.min(...flights.map((f) => f.price)) : null }]
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((d) => {
                        const isCurrent = d.date === departDate;
                        const cheapest = nearby.every((x) => x.price == null || (d.price != null && d.price <= x.price));
                        return (
                          <button key={d.date} onClick={() => { if (!isCurrent) { setDepartDate(d.date); setNearby(null); } }}
                            style={{ flex: "0 0 auto", padding: "8px 12px", borderRadius: 12, cursor: isCurrent ? "default" : "pointer", textAlign: "center",
                              border: `1px solid ${isCurrent ? "var(--ios-tint)" : "var(--ios-separator)"}`,
                              background: isCurrent ? "var(--ios-fill)" : "transparent" }}>
                            <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>
                              {new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                            </div>
                            <div className="ios-num" style={{ fontWeight: 700, color: d.price == null ? "var(--ios-label-3)" : cheapest && !isCurrent ? "var(--ios-green)" : "var(--ios-label)" }}>
                              {d.price == null ? "—" : money(d.price, prefs.currency)}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>
                    Tap a date to search it. Cheapest fare found on each day; &ldquo;—&rdquo; means that day returned nothing.
                  </div>
                </>
              )}
            </div>
          )}
          {flights.length > 1 && (
            <FlightShopControls offers={flights} shown={visibleFlights.length} sort={flightSort} setSort={setFlightSort} filters={flightFilters} setFilters={setFlightFilters} />
          )}
          {flights.length > 0 && (() => {
            const bl = flightBookingLinks({ origin, destination, departDate, returnDate: returnDate || undefined });
            return <BookRow label="Ready to book?" links={[["Google Flights", bl.google_flights], ["Kayak", bl.kayak]]} />;
          })()}
          {flights.length === 0 && <Empty mode="flights" />}
          {visibleFlights.map((o) => {
            const preferred = o.carriers.some((c) => preferredAir.includes(c));
            const loyaltyMatch = o.carriers.some((c) => airPrograms.some((p) => p.includes(c.toLowerCase())));
            return (
              <div key={o.id} className="ios-list" style={{ margin: "0 0 8px", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <div className="ios-num" style={{ fontSize: 22, fontWeight: 700 }}>{money(o.price, o.currency)}</div>
                  <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>{o.stops === 0 ? "Non-stop" : `${o.stops} stop${o.stops > 1 ? "s" : ""}`} · {o.totalDuration}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
                  <Tag>{o.carriers.join(", ")}</Tag>
                  <Tag>{o.cabin.replace("_", " ")}</Tag>
                  {preferred && <Tag color="#2A7B8C">Preferred airline</Tag>}
                  {loyaltyMatch && <Tag color="#8E44AD">Earns miles</Tag>}
                  {o.seatsLeft != null && o.seatsLeft <= 5 && <Tag color="#C97A3A">{o.seatsLeft} left</Tag>}
                </div>
                {inPoints && (() => {
                  const q = pointsQuote(o.price, o.carriers.join(" "), "air", balances);
                  return q ? (
                    <div className="ios-footnote" style={{ color: q.covers ? "var(--ios-green)" : "var(--ios-label-2)", margin: "2px 0 6px" }}>
                      ≈ {formatPoints(q.points)} {q.program} pts
                      {q.balance != null && (q.covers ? ` · your ${q.balance.toLocaleString()} covers it` : ` · ${q.shortfall?.toLocaleString()} short`)}
                    </div>
                  ) : null;
                })()}
                <SegList segs={o.outbound} label="Outbound" />
                {o.inbound && <SegList segs={o.inbound} label="Return" />}
                <button onClick={() => watchFlight(o.price)} style={{ marginTop: 8, padding: 0, background: "none", border: "none", color: "var(--ios-tint)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  🔔 Watch this price
                </button>
                <SaveToTrip offer={o} kind="flight" />
              </div>
            );
          })}
        </>
      )}

      {/* ── Car results ── */}
      {mode === "cars" && cars && (
        <>
          <div className="ios-group-header" style={{ padding: "4px 0 7px" }}>
            {cars.length} {carMode === "rates" ? (cars.length === 1 ? "CAR" : "CARS") : (cars.length === 1 ? "RENTAL COMPANY" : "RENTAL COMPANIES")}
          </div>
          {ratesNote && (
            <div className="ios-list" style={{ margin: "0 0 8px", padding: "10px 14px" }}>
              <div className="ios-caption" style={{ color: "var(--ios-label-2)", lineHeight: 1.45 }}>{ratesNote}</div>
            </div>
          )}
          {cars.length === 0 && (
            <div className="ios-list" style={{ margin: 0, padding: 18 }}>
              <div className="ios-subhead" style={{ color: "var(--ios-label)", marginBottom: 6 }}>No rental companies came back.</div>
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>Try the airport code, or a larger city nearby.</div>
            </div>
          )}
          {cars.map((c) => {
            const mine = isPreferredBrand(c.company, preferredCarCompanies, "car");
            return (
              <div key={c.id} className="ios-list" style={{ margin: "0 0 8px", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="ios-headline" style={{ fontSize: 16 }}>{c.company}</div>
                    {c.vehicle && <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>{c.vehicle}</div>}
                  </div>
                  {(c.price != null || c.perDay != null) && (
                    <div style={{ textAlign: "right" }}>
                      <div className="ios-num" style={{ fontSize: 18, fontWeight: 700 }}>{money(c.price ?? c.perDay, c.currency ?? "USD")}</div>
                      {c.perDay != null && c.price != null && (
                        <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>{money(c.perDay, c.currency ?? "USD")}/day</div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {c.rating != null && (
                    <Tag color={c.rating >= 4.5 ? "#2F8F4E" : c.rating >= 4 ? "#2A7B8C" : undefined}>
                      {c.rating.toFixed(1)}/5{c.reviews ? ` · ${c.reviews.toLocaleString()} reviews` : ""}
                    </Tag>
                  )}
                  {c.type && <Tag>{c.type}</Tag>}
                  {c.seats != null && <Tag>{c.seats} seats</Tag>}
                  {c.transmission && <Tag>{c.transmission}</Tag>}
                  {c.unlimitedMileage && <Tag color="#2F8F4E">Unlimited miles</Tag>}
                  {mine && <Tag color="#2A7B8C">Your company</Tag>}
                  {c.price == null && c.perDay == null && <Tag color="#8E8E93">Rate not quoted</Tag>}
                </div>
                {c.address && <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 6 }}>{c.address}</div>}
                <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                  {c.link && (
                    <a href={c.link} target="_blank" rel="noopener noreferrer" className="ios-footnote" style={{ color: "var(--ios-tint)", fontWeight: 600, textDecoration: "none" }}>
                      Book with {c.company.split(" ")[0]} →
                    </a>
                  )}
                  {c.phone && <span className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>{c.phone}</span>}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ── Hotel results ── */}
      {mode === "hotels" && hotels && (
        <>
          <div className="ios-group-header" style={{ padding: "4px 0 7px" }}>{hotels.length} HOTEL{hotels.length === 1 ? "" : "S"}</div>
          {hotels.length > 0 && (
            <div className="ios-list" style={{ margin: "0 0 10px", padding: 14 }}>
              {!hotelNearby && (
                <>
                  <button onClick={loadHotelNearby} disabled={hotelNearbyBusy} className="ios-caption"
                    style={{ background: "none", border: "1px solid var(--ios-separator)", borderRadius: 10, color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "8px 14px" }}>
                    {hotelNearbyBusy ? "Pricing nearby dates…" : "Check nearby dates"}
                  </button>
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6, lineHeight: 1.45 }}>
                    Shifts the whole stay two days either way. Four more provider searches, so it only runs when you ask.
                  </div>
                </>
              )}
              {hotelNearby && (
                <>
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)", fontWeight: 700, marginBottom: 6 }}>NEARBY CHECK-IN DATES</div>
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                    {[...hotelNearby, { date: checkIn, checkOut, price: cheapestHotel }]
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((d) => {
                        const isCurrent = d.date === checkIn;
                        const best = hotelNearby.every((x) => x.price == null || (d.price != null && d.price <= x.price));
                        return (
                          <button key={d.date} onClick={() => {
                              if (isCurrent) return;
                              // Move the whole stay — check-out shifts with it, or
                              // the stay silently changes length.
                              setCheckIn(d.date);
                              if (d.checkOut) setCheckOut(d.checkOut);
                              setHotelNearby(null);
                            }}
                            style={{ flex: "0 0 auto", padding: "8px 12px", borderRadius: 12, cursor: isCurrent ? "default" : "pointer", textAlign: "center",
                              border: `1px solid ${isCurrent ? "var(--ios-tint)" : "var(--ios-separator)"}`,
                              background: isCurrent ? "var(--ios-fill)" : "transparent" }}>
                            <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>
                              {new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                            </div>
                            <div className="ios-num" style={{ fontWeight: 700, color: d.price == null ? "var(--ios-label-3)" : best && !isCurrent ? "var(--ios-green)" : "var(--ios-label)" }}>
                              {d.price == null ? "—" : money(d.price, prefs.currency)}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>
                    Cheapest stay found for the same length. Tap a date to move the whole stay; check-out follows.
                  </div>
                </>
              )}
            </div>
          )}
          {hotels.length > 1 && (
            <HotelShopControls offers={hotels} shown={visibleHotels.length} sort={hotelSort} setSort={setHotelSort} filters={hotelFilters} setFilters={setHotelFilters} />
          )}
          {hotels.length > 0 && (() => {
            const bl = hotelBookingLinks({ city, checkIn, checkOut, adults });
            return <BookRow label="Ready to book?" links={[["Booking.com", bl.booking_com], ["Kayak", bl.kayak], ["Google", bl.google_hotels]]} />;
          })()}
          {hotels.length === 0 && <Empty mode="hotels" />}
          {visibleHotels.map((h) => {
            const hay = `${h.name} ${h.chain ?? ""}`.toUpperCase();
            const preferred = preferredChains.some((c) => c && hay.includes(c));
            const hayLower = hay.toLowerCase();
            const loyaltyMatch = hotelPrograms.some((p) => p && hayLower.includes(p.split(" ")[0]));
            const rec = recommendHotel(h, { preferred: hotelPreferred(h), cheapest: cheapestHotel });
            const hotelPoints = pointsQuote(h.price, `${h.name} ${h.chain ?? ""}`, "hotel", balances);
            return (
              <div key={h.id} className="ios-list" style={{ margin: "0 0 8px", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    {h.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.thumbnail} alt="" loading="lazy" width={48} height={48}
                        style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                    )}
                    <div className="ios-headline" style={{ fontSize: 16 }}>{h.name}</div>
                  </div>
                  <div className="ios-num" style={{ fontSize: 18, fontWeight: 700, whiteSpace: "nowrap" }}>{h.price != null ? money(h.price, h.currency ?? "USD") : "—"}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {h.rating && <Tag>{"★".repeat(h.rating)}</Tag>}
                  {h.guestScore != null && (
                    <Tag color={h.guestScore >= 4.5 ? "#2F8F4E" : h.guestScore >= 4 ? "#2A7B8C" : undefined}>
                      {h.guestScore.toFixed(1)}/5{h.reviews ? ` · ${h.reviews.toLocaleString()} reviews` : ""}
                    </Tag>
                  )}
                  {rec.label && <Tag color="#8E44AD">{rec.label}</Tag>}
                  {h.chain && <Tag>{h.chain}</Tag>}
                  {preferred && <Tag color="#2A7B8C">Preferred chain</Tag>}
                  {loyaltyMatch && <Tag color="#8E44AD">Earns points</Tag>}
                  {h.price == null && <Tag color="#8E8E93">Rate on request</Tag>}
                </div>
                {rec.reasons.length > 0 && (
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 5 }}>{rec.reasons.join(" · ")}</div>
                )}
                {inPoints && hotelPoints && (
                  <div className="ios-footnote" style={{ color: hotelPoints.covers ? "var(--ios-green)" : "var(--ios-label-2)", marginTop: 5 }}>
                    ≈ {formatPoints(hotelPoints.points)} {hotelPoints.program} pts
                    {hotelPoints.balance != null && (hotelPoints.covers
                      ? ` · your ${hotelPoints.balance.toLocaleString()} covers it`
                      : ` · ${hotelPoints.shortfall?.toLocaleString()} short`)}
                  </div>
                )}
                {h.amenities && h.amenities.length > 0 && (
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 5 }}>{h.amenities.slice(0, 4).join(" · ")}</div>
                )}
                {h.address && <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 6 }}>{h.address}</div>}
                {h.link && (
                  <a href={h.link} target="_blank" rel="noopener noreferrer" className="ios-footnote"
                    style={{ display: "inline-block", marginTop: 6, color: "var(--ios-tint)", fontWeight: 600, textDecoration: "none" }}>
                    Read the reviews →
                  </a>
                )}
                <SaveToTrip offer={h} kind="hotel" />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function SegList({ segs, label }: { segs: FlightOffer["outbound"]; label: string }) {
  if (!segs.length) return null;
  const first = segs[0], last = segs[segs.length - 1];
  return (
    <div style={{ borderTop: "1px solid var(--ios-separator)", paddingTop: 8, marginTop: 4 }}>
      <div className="ios-caption" style={{ color: "var(--ios-label-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 2 }}>
        <div>
          <div className="ios-subhead" style={{ fontWeight: 600 }}>{time(first.departAt)} · {first.from}</div>
          <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>{day(first.departAt)}</div>
        </div>
        <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>→</div>
        <div style={{ textAlign: "right" }}>
          <div className="ios-subhead" style={{ fontWeight: 600 }}>{time(last.arriveAt)} · {last.to}</div>
          <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>{segs.length > 1 ? `${segs.length - 1} stop` : "non-stop"}</div>
        </div>
      </div>
    </div>
  );
}

function BookRow({ label, links }: { label: string; links: [string, string][] }) {
  return (
    <div className="ios-list" style={{ margin: "0 0 8px", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span className="ios-footnote" style={{ color: "var(--ios-label-2)", fontWeight: 600 }}>🎫 {label}</span>
      {links.map(([name, url]) => (
        <a key={name} href={url} target="_blank" rel="noopener noreferrer"
          style={{ padding: "6px 12px", borderRadius: 8, background: "var(--ios-tint)", color: "var(--ios-on-tint)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          {name} →
        </a>
      ))}
      <span className="ios-caption" style={{ color: "var(--ios-label-3)", width: "100%" }}>Opens the provider&apos;s secure checkout — you finish booking there.</span>
    </div>
  );
}

function Empty({ mode }: { mode?: Mode }) {
  return (
    <div className="ios-list" style={{ margin: "0 0 8px", padding: 18 }}>
      <div className="ios-subhead" style={{ color: "var(--ios-label)", marginBottom: 6 }}>Nothing came back for that search.</div>
      <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
        {mode === "hotels"
          ? "Try a nearby date, a broader area, or fewer guests — some properties only publish rates closer to the stay."
          : "Try a day either side, a nearby airport, or turning off non-stop only — thin routes often have no same-day inventory."}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 }}>
      <span className="ios-subhead" style={{ color: "var(--ios-label)" }}>{label}</span>
      {children}
    </div>
  );
}
function Text({ value, onChange, placeholder, type = "text", upper }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; upper?: boolean }) {
  return <input type={type} value={value} placeholder={placeholder}
    onChange={(e) => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
    style={{ width: 150, background: "var(--ios-fill)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 15, color: "var(--ios-label)", textAlign: "right" }} />;
}
function Num({ value, onChange, min = 1, max = 9 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return <input type="number" value={value} min={min} max={max}
    onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
    style={{ width: 70, background: "var(--ios-fill)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 15, color: "var(--ios-label)", textAlign: "right" }} />;
}
function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  return <span className="ios-caption" style={{ padding: "2px 8px", borderRadius: 6, fontWeight: 600, background: color ? `${color}22` : "var(--ios-fill)", color: color ?? "var(--ios-label-2)" }}>{children}</span>;
}
const selectStyle: React.CSSProperties = { width: 150, background: "var(--ios-fill)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 15, color: "var(--ios-label)", textAlign: "right" };
function primaryBtn(busy: boolean): React.CSSProperties {
  return { marginTop: 12, width: "100%", padding: "12px 0", borderRadius: 12, background: "var(--ios-tint)", color: "var(--ios-on-tint)", border: "none", fontWeight: 700, fontSize: 16, cursor: "pointer", opacity: busy ? 0.6 : 1 };
}
