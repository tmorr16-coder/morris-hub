"use client";

import { useState } from "react";
import type { FlightOffer, HotelOffer } from "@/lib/duffel";
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

type Mode = "flights" | "hotels";

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

  const airPrograms = loyalty.filter((l) => l.category === "air").map((l) => l.program_name.toLowerCase());
  const hotelPrograms = loyalty.filter((l) => l.category === "hotel").map((l) => l.program_name.toLowerCase());
  const preferredAir = prefs.preferred_airlines.map((a) => a.toUpperCase());
  const preferredChains = prefs.preferred_hotel_chains.map((c) => c.toUpperCase());

  const [watchMsg, setWatchMsg] = useState<string | null>(null);

  async function searchFlights() {
    setErr(null); setBusy(true); setFlights(null);
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
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Search failed");
      setFlights(data.offers ?? []);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function searchHotels() {
    setErr(null); setBusy(true); setHotels(null);
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
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Search failed");
      setHotels(data.offers ?? []);
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
        {(["flights", "hotels"] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer",
              background: mode === m ? "var(--ios-bg-elevated, #fff)" : "transparent", color: mode === m ? "var(--ios-label)" : "var(--ios-label-2)" }}>
            {m === "flights" ? "✈️ Flights" : "🏨 Hotels"}
          </button>
        ))}
      </div>

      {!connected && (
        <div className="ios-list" style={{ margin: "0 0 12px", padding: 14 }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            Live results need a Duffel access token. You can still set up preferences and loyalty programs — searches will return results once search is connected.
          </div>
        </div>
      )}

      {/* ── Flight form ── */}
      {mode === "flights" && (
        <div className="ios-list" style={{ margin: "0 0 12px", padding: 16 }}>
          <Field label="From (airport code)"><Text value={origin} onChange={setOrigin} placeholder="IND" upper /></Field>
          <Field label="To (airport code)"><Text value={destination} onChange={setDestination} placeholder="LAX" upper /></Field>
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
          <Field label="City"><Text value={city} onChange={setCity} placeholder="New York" /></Field>
          <Field label="Check-in"><Text value={checkIn} onChange={setCheckIn} placeholder="YYYY-MM-DD" type="date" /></Field>
          <Field label="Check-out"><Text value={checkOut} onChange={setCheckOut} placeholder="YYYY-MM-DD" type="date" /></Field>
          <Field label="Guests"><Num value={adults} onChange={setAdults} min={1} max={9} /></Field>
          {preferredChains.length > 0 && (
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", lineHeight: 1.4 }}>Highlighting preferred chains: {preferredChains.join(", ")} · min {prefs.hotel_min_rating}★</div>
          )}
          <button onClick={searchHotels} disabled={busy || !city || !checkIn || !checkOut} style={primaryBtn(busy)}>
            {busy ? "Searching…" : "Search hotels"}
          </button>
        </div>
      )}

      {err && <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", padding: "0 4px 12px", lineHeight: 1.5 }}>{err}</div>}
      {watchMsg && <div className="ios-footnote" style={{ color: "var(--ios-green)", padding: "0 4px 12px" }}>{watchMsg}</div>}

      {/* ── Flight results ── */}
      {mode === "flights" && flights && (
        <>
          <div className="ios-group-header" style={{ padding: "4px 0 7px" }}>{flights.length} FLIGHT{flights.length === 1 ? "" : "S"}</div>
          {flights.length === 0 && <Empty />}
          {flights.map((o) => {
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
                <SegList segs={o.outbound} label="Outbound" />
                {o.inbound && <SegList segs={o.inbound} label="Return" />}
                <button onClick={() => watchFlight(o.price)} style={{ marginTop: 8, padding: 0, background: "none", border: "none", color: "var(--ios-tint)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  🔔 Watch this price
                </button>
              </div>
            );
          })}
        </>
      )}

      {/* ── Hotel results ── */}
      {mode === "hotels" && hotels && (
        <>
          <div className="ios-group-header" style={{ padding: "4px 0 7px" }}>{hotels.length} HOTEL{hotels.length === 1 ? "" : "S"}</div>
          {hotels.length === 0 && <Empty />}
          {hotels.map((h) => {
            const hay = `${h.name} ${h.chain ?? ""}`.toUpperCase();
            const preferred = preferredChains.some((c) => c && hay.includes(c));
            const hayLower = hay.toLowerCase();
            const loyaltyMatch = hotelPrograms.some((p) => p && hayLower.includes(p.split(" ")[0]));
            return (
              <div key={h.id} className="ios-list" style={{ margin: "0 0 8px", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <div className="ios-headline" style={{ fontSize: 16 }}>{h.name}</div>
                  <div className="ios-num" style={{ fontSize: 18, fontWeight: 700, whiteSpace: "nowrap" }}>{h.price != null ? money(h.price, h.currency ?? "USD") : "—"}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {h.rating && <Tag>{"★".repeat(h.rating)}</Tag>}
                  {h.chain && <Tag>{h.chain}</Tag>}
                  {preferred && <Tag color="#2A7B8C">Preferred chain</Tag>}
                  {loyaltyMatch && <Tag color="#8E44AD">Earns points</Tag>}
                  {h.price == null && <Tag color="#8E8E93">Rate on request</Tag>}
                </div>
                {h.address && <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 6 }}>{h.address}</div>}
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

function Empty() {
  return <div className="ios-list" style={{ margin: "0 0 8px", padding: 18 }}><div className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>No results for those dates. Try adjusting your search.</div></div>;
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
