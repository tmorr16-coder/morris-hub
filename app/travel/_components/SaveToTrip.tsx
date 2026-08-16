"use client";

// "Save to trip" on a search result — the piece that connects shopping to the
// itinerary you're actually tracking. Picking an existing trip appends a
// segment; naming a new one creates the trip first. Flights saved this way earn
// the same check-in reminders as an imported one, because the segment goes
// through the same endpoint.

import { useState } from "react";
import Link from "next/link";
import type { FlightOffer, HotelOffer } from "@/lib/travel-search";

interface TripRow { id: string; name: string; depart_date: string | null }

/** The segment a result becomes. */
function flightSegment(o: FlightOffer) {
  const first = o.outbound?.[0];
  const last = o.outbound?.[o.outbound.length - 1];
  return {
    kind: "flight" as const,
    title: [first?.carrierName || first?.carrier, first?.flightNumber].filter(Boolean).join(" ") || "Flight",
    carrier: first?.carrier ?? null,
    number: first?.flightNumber ?? null,
    origin: first?.from ?? null,
    destination: last?.to ?? null,
    start_at: first?.departAt ?? null,
    end_at: last?.arriveAt ?? null,
    price: o.price,
    currency: o.currency,
  };
}

function hotelSegment(h: HotelOffer) {
  return {
    kind: "hotel" as const,
    title: h.name,
    carrier: h.chain ?? h.name,
    location: h.address ?? null,
    start_at: h.checkIn ?? null,
    end_at: h.checkOut ?? null,
    price: h.price,
    currency: h.currency ?? "USD",
  };
}

export default function SaveToTrip({ offer, kind }: { offer: FlightOffer | HotelOffer; kind: "flight" | "hotel" }) {
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const segment = kind === "flight" ? flightSegment(offer as FlightOffer) : hotelSegment(offer as HotelOffer);

  async function load() {
    setOpen(true);
    if (trips) return;
    try {
      const res = await fetch("/api/travel/trips");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load your trips.");
      setTrips((data.trips ?? []).map((t: TripRow) => ({ id: t.id, name: t.name, depart_date: t.depart_date })));
    } catch (e) {
      setErr((e as Error).message);
      setTrips([]);
    }
  }

  async function addTo(tripId: string, tripName: string) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/travel/trips/${tripId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't add it.");
      setDone(tripName);
      setOpen(false);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function createAndAdd() {
    const name = newName.trim();
    if (!name) { setErr("Name the trip first."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/travel/trips", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip: {
            name,
            origin: "origin" in segment ? segment.origin : null,
            destination: "destination" in segment ? segment.destination : null,
            depart_date: segment.start_at ? segment.start_at.slice(0, 10) : null,
            return_date: segment.end_at ? segment.end_at.slice(0, 10) : null,
          },
          segments: [segment],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create the trip.");
      setDone(name);
      setOpen(false);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="ios-caption" style={{ marginTop: 8, color: "var(--ios-green)" }}>
        Saved to {done} · <Link href="/travel/trips" style={{ color: "var(--ios-tint)", fontWeight: 700 }}>view trip →</Link>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      {!open && (
        <button onClick={load} style={{ padding: 0, background: "none", border: "none", color: "var(--ios-tint)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
          ＋ Save to a trip
        </button>
      )}

      {open && (
        <div style={{ borderTop: "1px solid var(--ios-separator)", paddingTop: 10, marginTop: 4 }}>
          <div className="ios-caption" style={{ color: "var(--ios-label-3)", fontWeight: 700, marginBottom: 6 }}>SAVE TO</div>

          {trips === null && <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>Loading your trips…</div>}

          {trips?.map((t) => (
            <button key={t.id} onClick={() => addTo(t.id, t.name)} disabled={busy}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 0", background: "none", border: "none", borderBottom: "1px solid var(--ios-separator)", cursor: "pointer", color: "var(--ios-label)", fontSize: 14.5 }}>
              {t.name}
              {t.depart_date && <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}> · {t.depart_date}</span>}
            </button>
          ))}

          {trips && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={trips.length ? "…or a new trip" : "Name your first trip"}
                style={{ flex: 1, minWidth: 0, background: "var(--ios-fill)", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 14.5, color: "var(--ios-label)" }}
              />
              <button onClick={createAndAdd} disabled={busy || !newName.trim()} className="ios-caption"
                style={{ background: "var(--ios-tint)", border: "none", borderRadius: 10, color: "var(--ios-on-tint)", fontWeight: 700, cursor: "pointer", padding: "0 14px", opacity: busy || !newName.trim() ? 0.5 : 1 }}>
                Create
              </button>
            </div>
          )}

          {err && <div className="ios-caption" style={{ color: "var(--ios-red, #FF3B30)", marginTop: 8 }}>{err}</div>}

          <button onClick={() => { setOpen(false); setErr(null); }} className="ios-caption"
            style={{ background: "none", border: "none", color: "var(--ios-label-3)", cursor: "pointer", marginTop: 8, padding: 0 }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
