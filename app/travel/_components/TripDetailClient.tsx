"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { groupByDay, tripState, whenLabel, type TripSegment } from "@/lib/trips";
import { ICON } from "./TripsClient";

interface Trip {
  id: string; name: string; origin: string | null; destination: string | null;
  depart_date: string | null; return_date: string | null; travelers: number | null; status: string | null;
}
type Segment = TripSegment & { id: string };
interface Alert { id: string; segment_id: string | null; kind: string; send_at: string; sent_at: string | null; title: string }

const ALERT_LABEL: Record<string, string> = {
  checkin: "Check-in reminder",
  leave_for_airport: "Leave for the airport",
  hotel_checkin: "Hotel check-in",
  trip_tomorrow: "Trip starts tomorrow",
};

function time(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}
function dayLabel(day: string): string {
  if (day === "unscheduled") return "No time set";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

export default function TripDetailClient({ trip, segments, alerts }: { trip: Trip; segments: Segment[]; alerts: Alert[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const state = tripState(trip, segments);
  const days = groupByDay(segments);
  const pending = alerts.filter((a) => !a.sent_at);
  const sent = alerts.filter((a) => a.sent_at);

  async function removeSegment(id: string) {
    if (!confirm("Remove this from the itinerary?")) return;
    setBusy(true);
    await fetch(`/api/travel/trips/${trip.id}?segment=${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      {/* Status strip */}
      <div className="ios-list" style={{ margin: "0 0 12px", padding: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 700,
          background: state === "active" ? "var(--ios-green)" : state === "upcoming" ? "var(--ios-tint)" : "var(--ios-fill)",
          color: state === "past" ? "var(--ios-label-2)" : "#fff" }}>
          {state === "active" ? "Travelling now" : state === "upcoming" ? "Upcoming" : "Past"}
        </span>
        <span className="ios-footnote" style={{ color: "var(--ios-label-2)", flex: 1 }}>
          {trip.depart_date ? `Departs ${whenLabel(trip.depart_date)}` : "No dates yet"}
          {trip.travelers && trip.travelers > 1 ? ` · ${trip.travelers} travellers` : ""}
        </span>
      </div>

      {/* Reminders */}
      <div className="ios-group-header" style={{ padding: "4px 0 7px" }}>REMINDERS</div>
      <div className="ios-list" style={{ margin: "0 0 14px", padding: 14 }}>
        {pending.length === 0 && sent.length === 0 && (
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            Add a flight and you&apos;ll get a check-in reminder for it. Reminders go out in one daily run, so each arrives on or shortly before the time shown.
          </div>
        )}
        {pending.map((a) => (
          <div key={a.id} className="ios-footnote" style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "3px 0", color: "var(--ios-label-2)" }}>
            <span>{ALERT_LABEL[a.kind] ?? a.kind}</span>
            <span style={{ color: "var(--ios-label-3)", flexShrink: 0 }}>{whenLabel(a.send_at)} · {time(a.send_at)}</span>
          </div>
        ))}
        {sent.map((a) => (
          <div key={a.id} className="ios-footnote" style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "3px 0", color: "var(--ios-label-3)" }}>
            <span>{ALERT_LABEL[a.kind] ?? a.kind}</span>
            <span style={{ flexShrink: 0 }}>sent</span>
          </div>
        ))}
      </div>

      {/* Itinerary */}
      <div className="ios-group-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0 7px" }}>
        <span>ITINERARY</span>
        <button onClick={() => setAdding((v) => !v)} className="ios-caption"
          style={{ background: "none", border: "none", color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer" }}>
          {adding ? "Cancel" : "+ Add"}
        </button>
      </div>

      {adding && <AddSegment tripId={trip.id} onDone={() => { setAdding(false); router.refresh(); }} />}

      {days.length === 0 && !adding && (
        <div className="ios-list" style={{ margin: 0, padding: 18 }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            Nothing on this trip yet. Add a flight, hotel or booking — or import a confirmation email.
          </div>
        </div>
      )}

      {days.map(({ day, items }) => (
        <div key={day} style={{ marginBottom: 14 }}>
          <div className="ios-caption" style={{ color: "var(--ios-label-3)", fontWeight: 700, padding: "0 2px 6px" }}>{dayLabel(day)}</div>
          {items.map((s) => (
            <div key={(s as Segment).id} className="ios-list" style={{ margin: "0 0 8px", padding: 14 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ fontSize: 18, lineHeight: "22px" }}>{ICON[s.kind] ?? "📝"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ios-headline" style={{ color: "var(--ios-label)", fontSize: 15.5 }}>
                    {s.title || [s.carrier, s.number].filter(Boolean).join(" ") || s.kind}
                  </div>
                  <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
                    {s.kind === "flight" && s.origin && s.destination ? `${s.origin} → ${s.destination} · ` : ""}
                    {s.start_at ? time(s.start_at) : "time TBD"}
                    {s.end_at ? ` – ${time(s.end_at)}` : ""}
                  </div>
                  {(s.location || s.seat || s.terminal || s.confirmation_code) && (
                    <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 4 }}>
                      {[s.location, s.terminal && `terminal ${s.terminal}`, s.seat && `seat ${s.seat}`, s.confirmation_code && `conf ${s.confirmation_code}`]
                        .filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <button onClick={() => removeSegment((s as Segment).id)} disabled={busy} aria-label="Remove"
                  style={{ background: "none", border: "none", color: "var(--ios-label-3)", fontSize: 18, cursor: "pointer", padding: "0 2px", flexShrink: 0 }}>×</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function AddSegment({ tripId, onDone }: { tripId: string; onDone: () => void }) {
  const [kind, setKind] = useState<TripSegment["kind"]>("flight");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/travel/trips/${tripId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment: {
            kind, title: title || null, confirmation_code: code || null,
            // datetime-local has no zone; treat what you typed as UTC so the
            // stored instant matches what's on screen.
            start_at: start ? new Date(`${start}:00Z`).toISOString() : null,
            origin: origin || null, destination: destination || null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't add that.");
      onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const row = (label: string, value: string, set: (v: string) => void, type = "text", placeholder?: string) => (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 }}>
      <span className="ios-subhead" style={{ color: "var(--ios-label)" }}>{label}</span>
      <input value={value} onChange={(e) => set(e.target.value)} type={type} placeholder={placeholder}
        style={{ flex: 1, maxWidth: 220, textAlign: "right", background: "transparent", border: "none", color: "var(--ios-label)", fontSize: 16, outline: "none" }} />
    </label>
  );

  return (
    <div className="ios-list" style={{ margin: "0 0 12px", padding: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {(["flight", "hotel", "car", "rail", "activity"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)}
            style={{ padding: "6px 11px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${kind === k ? "transparent" : "var(--ios-separator)"}`,
              background: kind === k ? "var(--ios-tint)" : "transparent", color: kind === k ? "var(--ios-on-tint)" : "var(--ios-label)" }}>
            {ICON[k]} {k}
          </button>
        ))}
      </div>
      {row(kind === "flight" ? "Flight" : "Name", title, setTitle, "text", kind === "flight" ? "DL 30" : "Hotel Ganivet")}
      {row("Starts", start, setStart, "datetime-local")}
      {kind === "flight" && row("From", origin, setOrigin, "text", "ATL")}
      {kind === "flight" && row("To", destination, setDestination, "text", "MAD")}
      {row("Confirmation", code, setCode)}
      {err && <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", marginTop: 8 }}>{err}</div>}
      <button onClick={save} disabled={busy} className="ios-btn ios-btn--primary" style={{ marginTop: 12 }}>
        {busy ? "Adding…" : "Add to itinerary"}
      </button>
      {kind === "flight" && (
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 8, textAlign: "center" }}>
          Check-in opens 24h before departure and you&apos;ll be reminded, plus a heads-up to leave about 3h before. Both arrive in the daily reminder run.
        </div>
      )}
    </div>
  );
}
