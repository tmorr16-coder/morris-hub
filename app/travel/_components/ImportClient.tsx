"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TripSegment } from "@/lib/trips";
import { ICON } from "./TripsClient";

interface ParsedTrip {
  name: string; origin?: string | null; destination?: string | null;
  depart_date?: string | null; return_date?: string | null; travelers?: number | null;
}

function time(iso?: string | null): string {
  if (!iso) return "time TBD";
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

export default function ImportClient() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [trip, setTrip] = useState<ParsedTrip | null>(null);
  const [segments, setSegments] = useState<TripSegment[]>([]);
  const [parsedBy, setParsedBy] = useState<string | null>(null);
  const [keep, setKeep] = useState<boolean[]>([]);

  async function parse() {
    if (text.trim().length < 20) { setErr("Paste the confirmation — subject line through the itinerary."); return; }
    setBusy(true); setErr(null); setTrip(null);
    try {
      const res = await fetch("/api/travel/trips/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that.");
      setTrip(data.trip);
      setSegments(data.segments ?? []);
      setKeep((data.segments ?? []).map(() => true));
      setParsedBy(data.parsedBy ?? null);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function save() {
    if (!trip) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/travel/trips/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip, segments: segments.filter((_, i) => keep[i]) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the trip.");
      router.push(`/travel/trips/${data.trip.id}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  const flights = segments.filter((s, i) => keep[i] && s.kind === "flight").length;

  return (
    <div>
      {!trip && (
        <>
          <div className="ios-list" style={{ margin: 0, padding: 14 }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              placeholder="Paste the whole confirmation email — airline, hotel, car, rail. A .ics calendar invite works too."
              style={{ width: "100%", background: "var(--ios-fill)", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 15, color: "var(--ios-label)", resize: "vertical", fontFamily: "inherit" }}
            />
            <button onClick={parse} disabled={busy || !text.trim()} className="ios-btn ios-btn--primary" style={{ marginTop: 12, opacity: busy || !text.trim() ? 0.5 : 1 }}>
              {busy ? "Reading…" : "Read the itinerary"}
            </button>
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 8, textAlign: "center", lineHeight: 1.45 }}>
              Calendar invites are parsed exactly. Email text is read by Claude — you&apos;ll see everything it found before anything is saved.
            </div>
          </div>
          {err && <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", marginTop: 12, lineHeight: 1.5 }}>{err}</div>}
        </>
      )}

      {trip && (
        <>
          <div className="ios-list" style={{ margin: "0 0 12px", padding: 14 }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 }}>
              <span className="ios-subhead" style={{ color: "var(--ios-label)" }}>Trip name</span>
              <input value={trip.name} onChange={(e) => setTrip({ ...trip, name: e.target.value })}
                style={{ flex: 1, maxWidth: 220, textAlign: "right", background: "transparent", border: "none", color: "var(--ios-label)", fontSize: 16, outline: "none" }} />
            </label>
            <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>
              {[trip.depart_date, trip.return_date].filter(Boolean).join(" – ") || "No dates found"}
              {trip.destination ? ` · ${trip.destination}` : ""}
              {parsedBy === "calendar" ? " · from calendar invite" : parsedBy === "model" ? " · read by Claude" : ""}
            </div>
          </div>

          <div className="ios-group-header" style={{ padding: "4px 0 7px" }}>FOUND {segments.length} ITEM{segments.length === 1 ? "" : "S"} · UNTICK ANYTHING WRONG</div>
          {segments.map((s, i) => (
            <label key={i} className="ios-list" style={{ display: "flex", gap: 10, margin: "0 0 8px", padding: 14, alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={keep[i]} onChange={(e) => setKeep(keep.map((k, j) => (j === i ? e.target.checked : k)))}
                style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 17 }}>{ICON[s.kind] ?? "📝"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ios-headline" style={{ color: "var(--ios-label)", fontSize: 15 }}>
                  {s.title || [s.carrier, s.number].filter(Boolean).join(" ") || s.kind}
                </div>
                <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
                  {s.kind === "flight" && s.origin && s.destination ? `${s.origin} → ${s.destination} · ` : ""}{time(s.start_at)}
                </div>
                {(s.location || s.confirmation_code || s.seat) && (
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 3 }}>
                    {[s.location, s.seat && `seat ${s.seat}`, s.confirmation_code && `conf ${s.confirmation_code}`].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </label>
          ))}

          {err && <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", marginTop: 10, lineHeight: 1.5 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={save} disabled={busy || !keep.some(Boolean)} className="ios-btn ios-btn--primary" style={{ flex: 1 }}>
              {busy ? "Saving…" : "Save trip"}
            </button>
            <button onClick={() => { setTrip(null); setSegments([]); }} className="ios-caption"
              style={{ background: "none", border: "1px solid var(--ios-separator)", borderRadius: 10, color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "0 16px" }}>
              Start over
            </button>
          </div>
          {flights > 0 && (
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 8, textAlign: "center", lineHeight: 1.45 }}>
              {flights === 1 ? "The flight gets" : `All ${flights} flights get`} a check-in reminder and a heads-up to leave for the airport, delivered in the daily reminder run.
            </div>
          )}
        </>
      )}
    </div>
  );
}
