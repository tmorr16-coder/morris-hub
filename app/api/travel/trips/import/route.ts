import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { looksLikeIcs, parseIcs, type TripSegment } from "@/lib/trips";
import { saveSegments } from "../route";
import { MODEL_BALANCED } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

const client = new Anthropic();
const PARSER_MODEL = MODEL_BALANCED;

const INSTRUCTIONS = `You read travel confirmations (airline, hotel, car rental, rail) and turn them into structured itinerary data.

Return ONLY JSON shaped like:
{"trip":{"name":"Madrid, Sept 2026","origin":"ATL","destination":"MAD","depart_date":"2026-09-01","return_date":"2026-09-08","travelers":2},
 "segments":[{"kind":"flight","title":"Delta 30","carrier":"DL","number":"30","confirmation_code":"ABC123","start_at":"2026-09-02T00:15:00Z","start_tz":"America/New_York","end_at":"2026-09-02T08:05:00Z","end_tz":"Europe/Madrid","origin":"ATL","destination":"MAD","seat":"12A","terminal":"I"}]}

Rules:
- kind is one of flight, hotel, car, rail, activity, note.
- Times must be ISO 8601 UTC ("2026-09-02T00:15:00Z"). Confirmations print LOCAL times, so convert: a flight leaving Atlanta at 8:15pm on Sep 1 is "2026-09-02T00:15:00Z" in summer.
- Also return start_tz and end_tz as IANA zone names for where each end happens ("America/New_York", "Europe/Madrid"). These are what the itinerary is displayed in, so get them right even if a time is missing.
- For hotels, start_at is check-in and end_at is check-out; put the address in "location" and the property name in "carrier".
- Keep confirmation codes exactly as written.
- Name the trip after its main destination and month.
- Include every segment you find, in chronological order. Return nothing but the JSON object.`;

function extractJson(raw: string): any | null {
  const body = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  for (const candidate of [body, body.slice(body.indexOf("{"), body.lastIndexOf("}") + 1)]) {
    try { return JSON.parse(candidate); } catch { /* next */ }
  }
  return null;
}

/** Keep only fields we store, and drop anything without a time or a title. */
function cleanSegments(input: any[]): TripSegment[] {
  return (Array.isArray(input) ? input : [])
    .map((s) => ({
      kind: ["flight", "hotel", "car", "rail", "activity", "note"].includes(s?.kind) ? s.kind : "note",
      title: s?.title ?? null,
      confirmation_code: s?.confirmation_code ?? null,
      start_at: s?.start_at ?? null,
      end_at: s?.end_at ?? null,
      start_tz: typeof s?.start_tz === "string" ? s.start_tz : null,
      end_tz: typeof s?.end_tz === "string" ? s.end_tz : null,
      origin: s?.origin ?? null,
      destination: s?.destination ?? null,
      location: s?.location ?? null,
      carrier: s?.carrier ?? null,
      number: s?.number != null ? String(s.number) : null,
      seat: s?.seat ?? null,
      terminal: s?.terminal ?? null,
      travelers: s?.travelers ?? 1,
      price: typeof s?.price === "number" ? s.price : null,
      currency: s?.currency ?? "USD",
      notes: s?.notes ?? null,
    }))
    .filter((s) => s.title || s.start_at || s.confirmation_code);
}

function fallbackTrip(segments: TripSegment[]) {
  const dated = segments.filter((s) => s.start_at).sort((a, b) => (a.start_at ?? "").localeCompare(b.start_at ?? ""));
  const first = dated[0];
  const last = dated[dated.length - 1];
  const where = segments.find((s) => s.destination)?.destination ?? segments.find((s) => s.location)?.location ?? "Trip";
  return {
    name: first?.start_at ? `${where} · ${new Date(first.start_at).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}` : String(where),
    origin: segments.find((s) => s.origin)?.origin ?? null,
    destination: segments.find((s) => s.destination)?.destination ?? null,
    depart_date: first?.start_at ? first.start_at.slice(0, 10) : null,
    return_date: (last?.end_at ?? last?.start_at)?.slice(0, 10) ?? null,
    travelers: 1,
  };
}

/**
 * Paste a confirmation email (or a .ics attachment's contents) and get a trip.
 * Calendar invites parse deterministically; free-form email text goes to the
 * model. `preview: true` returns what was found without saving it.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { text?: string; preview?: boolean; trip?: any; segments?: TripSegment[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  // Second step: the client confirmed a previewed trip, so just store it.
  if (body.trip && body.segments) {
    const db = createServiceClient() as any;
    const { data: trip, error } = await db.schema("travel").from("trips").insert({
      user_id: user.id,
      name: body.trip.name ?? "Trip",
      origin: body.trip.origin ?? null,
      destination: body.trip.destination ?? null,
      depart_date: body.trip.depart_date ?? null,
      return_date: body.trip.return_date ?? null,
      travelers: body.trip.travelers ?? 1,
      status: "booked",
      source: "import",
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    try {
      const segments = await saveSegments(db, user.id, trip.id, cleanSegments(body.segments));
      return NextResponse.json({ trip, segments });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  const text = (body.text ?? "").trim();
  if (text.length < 20) return NextResponse.json({ error: "Paste the confirmation email or calendar invite." }, { status: 400 });
  if (text.length > 20000) return NextResponse.json({ error: "That's too long — paste just the itinerary section." }, { status: 400 });

  // Calendar invites are structured; parse them exactly rather than guessing.
  if (looksLikeIcs(text)) {
    const segments = cleanSegments(parseIcs(text));
    if (!segments.length) return NextResponse.json({ error: "No events found in that calendar invite." }, { status: 422 });
    return NextResponse.json({ trip: fallbackTrip(segments), segments, parsedBy: "calendar" });
  }

  try {
    const res = await client.messages.create({
      model: PARSER_MODEL,
      max_tokens: 2000,
      system: INSTRUCTIONS,
      messages: [{ role: "user", content: text }],
    });
    const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
    const parsed = extractJson(raw);
    const segments = cleanSegments(parsed?.segments ?? []);
    if (!segments.length) {
      return NextResponse.json({ error: "Couldn't find an itinerary in that. Try pasting the section with dates, times and confirmation numbers." }, { status: 422 });
    }
    const trip = { ...fallbackTrip(segments), ...(parsed?.trip ?? {}) };
    return NextResponse.json({ trip, segments, parsedBy: "model" });
  } catch (err) {
    return NextResponse.json({ error: `Couldn't read that confirmation: ${(err as Error).message}` }, { status: 502 });
  }
}
