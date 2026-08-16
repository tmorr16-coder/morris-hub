// Where a hotel search can point.
//
// Hotels aren't only booked by city. "Colorado" is a real search when you're
// picking a ski week, and "Hotel Ganivet" is a real search when someone has
// already told you where they're staying. This offers all three — city, state
// and property name — over one field, and tells the provider the same free text
// either way.

import { AIRPORTS } from "./airports";

export type PlaceKind = "city" | "state" | "airport" | "name";

export interface PlaceSuggestion {
  label: string;        // what to show
  value: string;        // what to search with
  kind: PlaceKind;
  hint?: string;        // secondary line
}

/** US states and DC — the coarse-grained end of a hotel search. */
export const US_STATES: { name: string; code: string }[] = [
  { name: "Alabama", code: "AL" }, { name: "Alaska", code: "AK" }, { name: "Arizona", code: "AZ" },
  { name: "Arkansas", code: "AR" }, { name: "California", code: "CA" }, { name: "Colorado", code: "CO" },
  { name: "Connecticut", code: "CT" }, { name: "Delaware", code: "DE" }, { name: "District of Columbia", code: "DC" },
  { name: "Florida", code: "FL" }, { name: "Georgia", code: "GA" }, { name: "Hawaii", code: "HI" },
  { name: "Idaho", code: "ID" }, { name: "Illinois", code: "IL" }, { name: "Indiana", code: "IN" },
  { name: "Iowa", code: "IA" }, { name: "Kansas", code: "KS" }, { name: "Kentucky", code: "KY" },
  { name: "Louisiana", code: "LA" }, { name: "Maine", code: "ME" }, { name: "Maryland", code: "MD" },
  { name: "Massachusetts", code: "MA" }, { name: "Michigan", code: "MI" }, { name: "Minnesota", code: "MN" },
  { name: "Mississippi", code: "MS" }, { name: "Missouri", code: "MO" }, { name: "Montana", code: "MT" },
  { name: "Nebraska", code: "NE" }, { name: "Nevada", code: "NV" }, { name: "New Hampshire", code: "NH" },
  { name: "New Jersey", code: "NJ" }, { name: "New Mexico", code: "NM" }, { name: "New York", code: "NY" },
  { name: "North Carolina", code: "NC" }, { name: "North Dakota", code: "ND" }, { name: "Ohio", code: "OH" },
  { name: "Oklahoma", code: "OK" }, { name: "Oregon", code: "OR" }, { name: "Pennsylvania", code: "PA" },
  { name: "Rhode Island", code: "RI" }, { name: "South Carolina", code: "SC" }, { name: "South Dakota", code: "SD" },
  { name: "Tennessee", code: "TN" }, { name: "Texas", code: "TX" }, { name: "Utah", code: "UT" },
  { name: "Vermont", code: "VT" }, { name: "Virginia", code: "VA" }, { name: "Washington", code: "WA" },
  { name: "West Virginia", code: "WV" }, { name: "Wisconsin", code: "WI" }, { name: "Wyoming", code: "WY" },
  { name: "Puerto Rico", code: "PR" },
];

/** Regions people search for that aren't a city or a state. */
const AREAS = [
  "Napa Valley", "Lake Tahoe", "Outer Banks", "Big Sur", "Cape Cod", "Hilton Head",
  "Jackson Hole", "Aspen", "Park City", "Sedona", "Key West", "Amalfi Coast",
  "Tuscany", "Provence", "Algarve", "Costa Brava", "Scottish Highlands", "Lake District",
];

/**
 * Suggestions for a hotel destination: cities and airports we know, US states,
 * and well-known areas. Ranked so an exact state or city name wins over a
 * partial match elsewhere.
 */
export function searchDestinations(query: string, limit = 8): PlaceSuggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const out: { s: PlaceSuggestion; score: number }[] = [];

  for (const st of US_STATES) {
    const name = st.name.toLowerCase();
    let score = 0;
    if (name === q || st.code.toLowerCase() === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 40;
    if (score) out.push({ score, s: { label: st.name, value: st.name, kind: "state", hint: `State · ${st.code}` } });
  }

  const seenCities = new Set<string>();
  for (const a of AIRPORTS) {
    const city = a.city.toLowerCase();
    let score = 0;
    if (city === q) score = 95;
    else if (city.startsWith(q)) score = 75;
    else if (a.code.toLowerCase() === q) score = 70;
    else if (city.includes(q)) score = 35;
    if (!score) continue;
    // One row per city, not one per airport — you book a city, not a runway.
    if (seenCities.has(city)) continue;
    seenCities.add(city);
    out.push({ score, s: { label: a.city, value: a.city, kind: "city", hint: `City · ${a.country}` } });
  }

  for (const area of AREAS) {
    const name = area.toLowerCase();
    let score = 0;
    if (name === q) score = 90;
    else if (name.startsWith(q)) score = 70;
    else if (name.includes(q)) score = 30;
    if (score) out.push({ score, s: { label: area, value: area, kind: "city", hint: "Area" } });
  }

  return out
    .sort((a, b) => b.score - a.score || a.s.label.localeCompare(b.s.label))
    .slice(0, limit)
    .map(({ s }) => s);
}

/** A rough read on what someone typed, for the hint under the field. */
export function classifyDestination(text: string): PlaceKind {
  const q = text.trim().toLowerCase();
  if (!q) return "city";
  if (US_STATES.some((s) => s.name.toLowerCase() === q || s.code.toLowerCase() === q)) return "state";
  if (AIRPORTS.some((a) => a.city.toLowerCase() === q)) return "city";
  // Property names carry words a place name wouldn't.
  if (/\b(hotel|inn|resort|suites|lodge|hostal|hostel|motel|residence|marriott|hilton|hyatt|ritz|sheraton|westin)\b/.test(q)) return "name";
  return "city";
}
