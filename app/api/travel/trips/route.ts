import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { plannedAlerts, type TripSegment } from "@/lib/trips";

export const runtime = "nodejs";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Trips with their segments, newest departure first. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient() as any;
  const { data: trips, error } = await db
    .schema("travel").from("trips")
    .select("*")
    .eq("user_id", user.id) // scoping-ok: user-scoped read
    .order("depart_date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (trips ?? []).map((t: any) => t.id);
  let segments: any[] = [];
  if (ids.length) {
    const { data } = await db
      .schema("travel").from("trip_segments")
      .select("*")
      .eq("user_id", user.id) // scoping-ok: user-scoped read
      .in("trip_id", ids)
      .order("start_at", { ascending: true });
    segments = data ?? [];
  }

  return NextResponse.json({
    trips: (trips ?? []).map((t: any) => ({ ...t, segments: segments.filter((s) => s.trip_id === t.id) })),
  });
}

/** Create a trip, optionally with its segments, scheduling any alerts they earn. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { trip?: any; segments?: TripSegment[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const name = (body.trip?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Give the trip a name." }, { status: 400 });

  const db = createServiceClient() as any;
  const { data: trip, error } = await db
    .schema("travel").from("trips")
    .insert({
      user_id: user.id,
      name,
      origin: body.trip?.origin ?? null,
      destination: body.trip?.destination ?? null,
      depart_date: body.trip?.depart_date ?? null,
      return_date: body.trip?.return_date ?? null,
      travelers: body.trip?.travelers ?? 1,
      status: body.trip?.status ?? "booked",
      notes: body.trip?.notes ?? null,
      source: body.trip?.source ?? "manual",
      import_hash: body.trip?.import_hash ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const saved = await saveSegments(db, user.id, trip.id, body.segments ?? []);
  return NextResponse.json({ trip: { ...trip, segments: saved } });
}

/** Insert segments and queue the alerts each one earns. Exported for reuse. */
export async function saveSegments(db: any, userId: string, tripId: string, segments: TripSegment[]) {
  if (!segments.length) return [];
  const rows = segments.map((s) => ({
    trip_id: tripId,
    user_id: userId,
    kind: s.kind ?? "note",
    title: s.title ?? null,
    confirmation_code: s.confirmation_code ?? null,
    start_at: s.start_at ?? null,
    end_at: s.end_at ?? null,
    start_tz: s.start_tz ?? null,
    end_tz: s.end_tz ?? null,
    origin: s.origin ?? null,
    destination: s.destination ?? null,
    location: s.location ?? null,
    carrier: s.carrier ?? null,
    number: s.number ?? null,
    seat: s.seat ?? null,
    terminal: s.terminal ?? null,
    travelers: s.travelers ?? 1,
    price: s.price ?? null,
    currency: s.currency ?? "USD",
    notes: s.notes ?? null,
    source: "import",
  }));

  const { data: inserted, error } = await db.schema("travel").from("trip_segments").insert(rows).select();
  if (error) throw new Error(error.message);

  const alerts = (inserted ?? []).flatMap((row: any) =>
    plannedAlerts({ ...row, id: row.id }).map((a) => ({
      user_id: userId,
      trip_id: tripId,
      segment_id: row.id,
      kind: a.kind,
      send_at: a.sendAt,
      title: a.title,
      body: a.body,
    })),
  );
  // Duplicates are prevented by a unique index on (segment_id, kind).
  if (alerts.length) await db.schema("travel").from("trip_alerts").upsert(alerts, { onConflict: "segment_id,kind" });

  return inserted ?? [];
}
