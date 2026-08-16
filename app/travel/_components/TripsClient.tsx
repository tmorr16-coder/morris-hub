"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { tripState, whenLabel, type TripSegment, type TripState } from "@/lib/trips";

interface Trip {
  id: string;
  name: string;
  origin: string | null;
  destination: string | null;
  depart_date: string | null;
  return_date: string | null;
  travelers: number | null;
  status: string | null;
}
type Segment = TripSegment & { id: string; trip_id: string };

const ICON: Record<string, string> = { flight: "✈️", hotel: "🏨", car: "🚗", rail: "🚆", activity: "🎟️", note: "📝" };

function dateRange(t: Trip): string {
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  if (t.depart_date && t.return_date) return `${fmt(t.depart_date)} – ${fmt(t.return_date)}`;
  if (t.depart_date) return fmt(t.depart_date);
  return "Dates TBD";
}

export default function TripsClient({ trips, segments }: { trips: Trip[]; segments: Segment[] }) {
  const [importing, setImporting] = useState(false);

  const grouped = useMemo(() => {
    const byTrip = (id: string) => segments.filter((s) => s.trip_id === id);
    const buckets: Record<TripState, { trip: Trip; segments: Segment[] }[]> = { active: [], upcoming: [], past: [] };
    for (const trip of trips) {
      const mine = byTrip(trip.id);
      buckets[tripState(trip, mine)].push({ trip, segments: mine });
    }
    buckets.past.reverse(); // most recent first
    return buckets;
  }, [trips, segments]);

  const section = (label: string, rows: { trip: Trip; segments: Segment[] }[], tint?: string) =>
    rows.length > 0 && (
      <div style={{ marginBottom: 18 }}>
        <div className="ios-group-header" style={{ padding: "4px 0 7px", color: tint }}>{label}</div>
        {rows.map(({ trip, segments: segs }) => {
          const flights = segs.filter((s) => s.kind === "flight").length;
          const nights = segs.filter((s) => s.kind === "hotel").length;
          return (
            <Link key={trip.id} href={`/travel/trips/${trip.id}`} className="ios-list"
              style={{ display: "block", margin: "0 0 8px", padding: 16, textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span className="ios-headline" style={{ color: "var(--ios-label)", fontSize: 17 }}>{trip.name}</span>
                <span className="ios-caption" style={{ color: "var(--ios-label-3)", flexShrink: 0 }}>{whenLabel(trip.depart_date)}</span>
              </div>
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 3 }}>
                {dateRange(trip)}
                {trip.destination ? ` · ${trip.origin ? `${trip.origin} → ` : ""}${trip.destination}` : ""}
              </div>
              {segs.length > 0 && (
                <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>
                  {[flights && `${flights} flight${flights === 1 ? "" : "s"}`, nights && `${nights} hotel${nights === 1 ? "" : "s"}`, `${segs.length} item${segs.length === 1 ? "" : "s"}`]
                    .filter(Boolean).join(" · ")}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Link href="/travel/trips/import" className="ios-btn ios-btn--primary" style={{ flex: 1, textAlign: "center", textDecoration: "none", padding: "11px 0" }}>
          Import a confirmation
        </Link>
        <button onClick={() => setImporting((v) => !v)} className="ios-caption"
          style={{ background: "none", border: "1px solid var(--ios-separator)", borderRadius: 10, color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "0 14px" }}>
          {importing ? "Close" : "New trip"}
        </button>
      </div>

      {importing && <NewTrip onDone={() => location.reload()} />}

      {trips.length === 0 && !importing && (
        <div className="ios-list" style={{ margin: 0, padding: 18 }}>
          <div className="ios-subhead" style={{ color: "var(--ios-label)", marginBottom: 6 }}>No trips yet.</div>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            Paste an airline or hotel confirmation and it becomes a tracked trip — with a check-in reminder for every flight in it.
          </div>
        </div>
      )}

      {section("ACTIVE NOW", grouped.active, "var(--ios-green)")}
      {section("UPCOMING", grouped.upcoming)}
      {section("PAST", grouped.past)}
    </div>
  );
}

function NewTrip({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [depart, setDepart] = useState("");
  const [ret, setRet] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) { setErr("Give the trip a name."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/travel/trips", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip: { name, destination: destination || null, depart_date: depart || null, return_date: ret || null } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the trip.");
      onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const field = (label: string, value: string, set: (v: string) => void, type = "text") => (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 }}>
      <span className="ios-subhead" style={{ color: "var(--ios-label)" }}>{label}</span>
      <input value={value} onChange={(e) => set(e.target.value)} type={type}
        style={{ flex: 1, maxWidth: 200, textAlign: "right", background: "transparent", border: "none", color: "var(--ios-label)", fontSize: 16, outline: "none" }} />
    </label>
  );

  return (
    <div className="ios-list" style={{ margin: "0 0 14px", padding: 14 }}>
      {field("Name", name, setName)}
      {field("Destination", destination, setDestination)}
      {field("Depart", depart, setDepart, "date")}
      {field("Return", ret, setRet, "date")}
      {err && <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", marginTop: 8 }}>{err}</div>}
      <button onClick={save} disabled={busy} className="ios-btn ios-btn--primary" style={{ marginTop: 12 }}>
        {busy ? "Saving…" : "Create trip"}
      </button>
    </div>
  );
}

export { ICON };
