import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { plannedAlerts } from "@/lib/trips";

export const runtime = "nodejs";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function owner(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const db = createServiceClient() as any;
  const { data: trip } = await db
    .schema("travel").from("trips")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id) // scoping-ok: user-scoped read
    .maybeSingle();
  if (!trip) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { user, db, trip };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await owner(id);
  if (ctx.error) return ctx.error;
  const { db, user, trip } = ctx;

  const [{ data: segments }, { data: alerts }] = await Promise.all([
    db.schema("travel").from("trip_segments").select("*").eq("trip_id", id).eq("user_id", user!.id).order("start_at", { ascending: true }), // scoping-ok: user-scoped read
    db.schema("travel").from("trip_alerts").select("*").eq("trip_id", id).eq("user_id", user!.id).order("send_at", { ascending: true }), // scoping-ok: user-scoped read
  ]);

  return NextResponse.json({ trip, segments: segments ?? [], alerts: alerts ?? [] });
}

/** Rename/reschedule a trip, or add a segment to it. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await owner(id);
  if (ctx.error) return ctx.error;
  const { db, user } = ctx;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  if (body.segment) {
    const s = body.segment;
    const { data: row, error } = await db.schema("travel").from("trip_segments").insert({
      trip_id: id, user_id: user!.id,
      kind: s.kind ?? "note", title: s.title ?? null, confirmation_code: s.confirmation_code ?? null,
      start_at: s.start_at || null, end_at: s.end_at || null,
      origin: s.origin ?? null, destination: s.destination ?? null, location: s.location ?? null,
      carrier: s.carrier ?? null, number: s.number ?? null, seat: s.seat ?? null, terminal: s.terminal ?? null,
      notes: s.notes ?? null, source: "manual",
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const alerts = plannedAlerts({ ...row, id: row.id }).map((a) => ({
      user_id: user!.id, trip_id: id, segment_id: row.id, kind: a.kind, send_at: a.sendAt, title: a.title, body: a.body,
    }));
    if (alerts.length) await db.schema("travel").from("trip_alerts").upsert(alerts, { onConflict: "segment_id,kind" });
    return NextResponse.json({ segment: row });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["name", "origin", "destination", "depart_date", "return_date", "travelers", "status", "notes"]) {
    if (k in body) patch[k] = body[k];
  }
  const { data: trip, error } = await db.schema("travel").from("trips").update(patch).eq("id", id).eq("user_id", user!.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trip });
}

/** Delete the trip, or one segment of it (?segment=<id>). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await owner(id);
  if (ctx.error) return ctx.error;
  const { db, user } = ctx;

  const segmentId = req.nextUrl.searchParams.get("segment");
  if (segmentId) {
    // Alerts cascade from the segment row.
    const { error } = await db.schema("travel").from("trip_segments").delete().eq("id", segmentId).eq("user_id", user!.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await db.schema("travel").from("trips").delete().eq("id", id).eq("user_id", user!.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
