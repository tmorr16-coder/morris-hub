// Trip tracking: what a trip's state is, when to nudge about it, and how to
// turn a pasted calendar invite into segments. Pure functions — the routes and
// the cron both read from here so the rules live in one place.

import { dayInZone, formatInZone, localZone, zoneForAirport, zonedTimeToUtc, isValidZone } from "./travel-timezones";

export type SegmentKind = "flight" | "hotel" | "car" | "rail" | "activity" | "note";
export type TripState = "active" | "upcoming" | "past";

export interface TripSegment {
  id?: string;
  kind: SegmentKind;
  title?: string | null;
  confirmation_code?: string | null;
  start_at?: string | null;   // ISO instant
  end_at?: string | null;
  start_tz?: string | null;   // IANA zone the start reads in ("America/New_York")
  end_tz?: string | null;
  origin?: string | null;
  destination?: string | null;
  location?: string | null;
  carrier?: string | null;
  number?: string | null;
  seat?: string | null;
  terminal?: string | null;
  travelers?: number | null;
  price?: number | null;
  currency?: string | null;
  notes?: string | null;
}

export interface Trip {
  id?: string;
  name: string;
  origin?: string | null;
  destination?: string | null;
  depart_date?: string | null;   // YYYY-MM-DD
  return_date?: string | null;
  travelers?: number | null;
  status?: string | null;
  notes?: string | null;
}

// Most airlines open check-in 24h before departure; Southwest is exactly 24h
// and worth being punctual about, so the reminder lands a few minutes early.
export const CHECKIN_LEAD_MS = 24 * 60 * 60 * 1000 + 5 * 60 * 1000;
/** Domestic rule of thumb: be at the airport 2h before, so leave 3h before. */
export const LEAVE_LEAD_MS = 3 * 60 * 60 * 1000;

const DAY = 24 * 60 * 60 * 1000;

/** Where a trip sits relative to now, from its own dates or its segments. */
export function tripState(trip: Trip, segments: TripSegment[] = [], now = Date.now()): TripState {
  const times = segments.flatMap((s) => [s.start_at, s.end_at]).filter(Boolean).map((t) => Date.parse(t as string)).filter((n) => !Number.isNaN(n));
  const startMs = trip.depart_date ? Date.parse(`${trip.depart_date}T00:00:00Z`) : times.length ? Math.min(...times) : NaN;
  // A trip with no end runs to the end of its start day.
  const endMs = trip.return_date ? Date.parse(`${trip.return_date}T23:59:59Z`) : times.length ? Math.max(...times) : startMs + DAY;

  if (!Number.isNaN(endMs) && now > endMs) return "past";
  if (!Number.isNaN(startMs) && now >= startMs) return "active";
  return "upcoming";
}

/** "in 3 days" / "today" / "2 weeks ago" — for list rows. */
export function whenLabel(dateIso: string | null | undefined, now = Date.now()): string {
  if (!dateIso) return "";
  const t = Date.parse(dateIso.length === 10 ? `${dateIso}T12:00:00Z` : dateIso);
  if (Number.isNaN(t)) return "";
  const days = Math.round((t - now) / DAY);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return days < 14 ? `in ${days} days` : days < 60 ? `in ${Math.round(days / 7)} weeks` : `in ${Math.round(days / 30)} months`;
  const ago = -days;
  return ago < 14 ? `${ago} days ago` : ago < 60 ? `${Math.round(ago / 7)} weeks ago` : `${Math.round(ago / 30)} months ago`;
}

export interface PlannedAlert {
  kind: "checkin" | "leave_for_airport" | "hotel_checkin" | "trip_tomorrow";
  segmentId?: string;
  sendAt: string;   // ISO
  title: string;
  body: string;
}

/** Times in a notification read on the clock of the place they happen. */
function fmtTime(iso: string, tz?: string | null): string {
  return formatInZone(iso, tz, { withDate: true });
}

/** The zone a segment starts in: stored, else inferred from the airport. */
export function startZone(s: TripSegment): string | null {
  return (isValidZone(s.start_tz) ? s.start_tz : null) ?? zoneForAirport(s.origin) ?? null;
}
export function endZone(s: TripSegment): string | null {
  return (isValidZone(s.end_tz) ? s.end_tz : null) ?? zoneForAirport(s.destination) ?? startZone(s);
}

function flightLabel(s: TripSegment): string {
  const flight = [s.carrier, s.number].filter(Boolean).join(" ") || s.title || "your flight";
  const route = s.origin && s.destination ? ` ${s.origin} → ${s.destination}` : "";
  return `${flight}${route}`;
}

/**
 * The nudges a segment earns. Only future ones are returned — back-filling
 * alerts for a flight that has already left would just send noise.
 */
export function plannedAlerts(segment: TripSegment, now = Date.now()): PlannedAlert[] {
  if (!segment.start_at) return [];
  const startMs = Date.parse(segment.start_at);
  if (Number.isNaN(startMs) || startMs < now) return [];

  const out: PlannedAlert[] = [];
  const zone = startZone(segment);
  if (segment.kind === "flight") {
    const checkinAt = startMs - CHECKIN_LEAD_MS;
    if (checkinAt > now) {
      out.push({
        kind: "checkin", segmentId: segment.id, sendAt: new Date(checkinAt).toISOString(),
        title: `Check in for ${flightLabel(segment)}`,
        body: `Check-in opens ${fmtTime(new Date(checkinAt).toISOString(), zone)}. ${flightLabel(segment)} departs ${fmtTime(segment.start_at, zone)}${segment.confirmation_code ? ` · confirmation ${segment.confirmation_code}` : ""}.`,
      });
    }
    const leaveAt = startMs - LEAVE_LEAD_MS;
    if (leaveAt > now) {
      out.push({
        kind: "leave_for_airport", segmentId: segment.id, sendAt: new Date(leaveAt).toISOString(),
        title: `Time to head to the airport — ${flightLabel(segment)}`,
        body: `${flightLabel(segment)} departs ${fmtTime(segment.start_at, zone)}. Head out around ${fmtTime(new Date(leaveAt).toISOString(), zone)} to be there about two hours ahead${segment.terminal ? ` · terminal ${segment.terminal}` : ""}${segment.seat ? ` · seat ${segment.seat}` : ""}.`,
      });
    }
  }

  if (segment.kind === "hotel") {
    const dayBefore = startMs - DAY;
    if (dayBefore > now) {
      out.push({
        kind: "hotel_checkin", segmentId: segment.id, sendAt: new Date(dayBefore).toISOString(),
        title: `${segment.carrier || segment.title || "Hotel"} check-in tomorrow`,
        body: `Check in ${fmtTime(segment.start_at, zone)}${segment.location ? ` · ${segment.location}` : ""}${segment.confirmation_code ? ` · confirmation ${segment.confirmation_code}` : ""}.`,
      });
    }
  }

  return out;
}

/**
 * Segments grouped by the calendar day they fall on *where they happen* — a
 * red-eye landing at 6am local belongs to that morning, not to the UTC date.
 */
export function groupByDay(segments: TripSegment[]): { day: string; items: TripSegment[] }[] {
  const days = new Map<string, TripSegment[]>();
  for (const s of [...segments].sort((a, b) => (a.start_at ?? "").localeCompare(b.start_at ?? ""))) {
    const day = (s.start_at ? dayInZone(s.start_at, startZone(s)) : "") || "unscheduled";
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(s);
  }
  // Undated items belong at the end of the itinerary, not before day one.
  return [...days.entries()]
    .sort(([a], [b]) => (a === "unscheduled" ? 1 : b === "unscheduled" ? -1 : a.localeCompare(b)))
    .map(([day, items]) => ({ day, items }));
}

// ── Calendar (.ics) import ──────────────────────────────────────────────
// Airlines and hotels attach these to confirmations, and they're structured,
// so they parse exactly — no model call and no guessing.

/**
 * An ICS date-time to an absolute instant.
 *   20260901T201500Z          — already UTC
 *   20260901T201500 + TZID    — wall time in that zone
 *   20260901T201500 (neither) — "floating"; read as the viewer's own clock
 *   20260901                  — a whole day
 */
function icsDate(value: string, tzid?: string | null): string | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", sec = "00"] = m;
  const wall = `${y}-${mo}-${d}T${h}:${mi}:${sec}`;
  if (m[7] === "Z" || !m[4]) return `${wall}Z`;          // UTC, or a date with no time
  if (tzid && isValidZone(tzid)) return zonedTimeToUtc(wall, tzid);
  return zonedTimeToUtc(wall, localZone());              // floating
}

function unfold(text: string): string[] {
  // RFC 5545 folds long lines with a leading space on the continuation.
  return text.replace(/\r/g, "").replace(/\n[ \t]/g, "").split("\n");
}

function unescapeIcs(v: string): string {
  return v.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

export function looksLikeIcs(text: string): boolean {
  return /BEGIN:VCALENDAR/i.test(text);
}

/** Turn VEVENTs into segments, guessing the kind from the summary. */
export function parseIcs(text: string): TripSegment[] {
  const out: TripSegment[] = [];
  let current: Record<string, string> | null = null;

  for (const line of unfold(text)) {
    if (/^BEGIN:VEVENT/i.test(line)) { current = {}; continue; }
    if (/^END:VEVENT/i.test(line)) {
      if (current) {
        const summary = unescapeIcs(current.SUMMARY ?? "");
        const startTz = current.DTSTART_TZID ?? null;
        const endTz = current.DTEND_TZID ?? null;
        const start = icsDate(current.DTSTART ?? "", startTz);
        const end = icsDate(current.DTEND ?? "", endTz);
        if (summary || start) {
          const description = unescapeIcs(current.DESCRIPTION ?? "");
          const flightBits = flightBitsFrom(summary);
          // A flight number plus an airport pair is a flight, whatever words
          // the summary happens to use.
          const looksLikeFlight = Boolean(flightBits.carrier && flightBits.number && flightBits.origin && flightBits.destination);
          out.push({
            kind: looksLikeFlight ? "flight" : kindFromText(`${summary} ${description}`),
            title: summary || null,
            start_at: start,
            end_at: end,
            // Prefer the invite's own zone; fall back to the airport's.
            start_tz: startTz ?? zoneForAirport(flightBits.origin) ?? null,
            end_tz: endTz ?? zoneForAirport(flightBits.destination) ?? null,
            location: unescapeIcs(current.LOCATION ?? "") || null,
            confirmation_code: confirmationFrom(`${summary} ${description}`),
            notes: description.slice(0, 500) || null,
            ...flightBits,
          });
        }
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const [name, ...params] = line.slice(0, idx).split(";");
    const key = name.toUpperCase();
    current[key] = line.slice(idx + 1);
    // DTSTART;TZID=America/New_York:20260901T201500 — the zone is the point.
    const tzid = params.map((p) => p.match(/^TZID=(.+)$/i)?.[1]).find(Boolean);
    if (tzid) current[`${key}_TZID`] = tzid.replace(/^"|"$/g, "");
  }
  return out;
}

/** Best guess at what a line of text describes. */
export function kindFromText(text: string): SegmentKind {
  const t = text.toLowerCase();
  if (/\bflight\b|\bdeparture\b|\bboarding\b|\bairlines?\b|\b[a-z]{2}\s?\d{2,4}\b.*→/.test(t)) return "flight";
  if (/\bhotel\b|\binn\b|\bresort\b|\bcheck-?in\b|\bairbnb\b|\bsuites\b/.test(t)) return "hotel";
  if (/\bcar rental\b|\bhertz\b|\bavis\b|\benterprise\b|\bpick-?up\b.*\bcar\b/.test(t)) return "car";
  if (/\btrain\b|\brail\b|\bamtrak\b|\beurostar\b/.test(t)) return "rail";
  if (/\bdinner\b|\btour\b|\bticket\b|\bmuseum\b|\bshow\b|\breservation\b/.test(t)) return "activity";
  return "note";
}

/**
 * Find a booking reference. A labelled one ("confirmation ABC123") wins; a bare
 * token only counts if it mixes letters and digits, so airport pairs and words
 * like "MADRID" don't get mistaken for a record locator.
 */
export function confirmationFrom(text: string): string | null {
  // Longest label alternatives first, and a boundary after them, or "ref" would
  // match inside "reference" and capture the tail of the word.
  const labelled = text.match(/(?:confirmation(?:\s*(?:code|number|#))?|conf\s*(?:code|number|#)?|record\s*locator|booking\s*(?:reference|ref|code)|booking|PNR)\b\s*[:#]?\s*([A-Z0-9]{5,8})\b/i);
  if (labelled) return labelled[1].toUpperCase();
  for (const token of text.match(/\b[A-Z0-9]{6}\b/g) ?? []) {
    if (/[A-Z]/.test(token) && /[0-9]/.test(token)) return token;
  }
  return null;
}

/** Pull "DL 30" / "Delta 30" style flight identity out of a summary line. */
function flightBitsFrom(summary: string): Partial<TripSegment> {
  const m = summary.match(/\b([A-Z]{2})\s?(\d{1,4})\b/);
  const route = summary.match(/\b([A-Z]{3})\s*(?:→|->|–|—|to|-)\s*([A-Z]{3})\b/);
  return {
    carrier: m ? m[1] : null,
    number: m ? m[2] : null,
    origin: route ? route[1] : null,
    destination: route ? route[2] : null,
  };
}
