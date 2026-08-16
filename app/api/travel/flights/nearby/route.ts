import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { travelConfigured, cheapestFlightPrice, type FlightSearchParams } from "@/lib/travel-search";
import { validateFlightSearch } from "@/lib/travel-validate";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SPREAD = 3; // days either side

function shift(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Cheapest fare on the days around the one you asked for.
 *
 * Each day is a separate provider call, so this is deliberately not automatic:
 * the client asks for it, the response says how many searches it spent, and the
 * spread is capped. Days in the past are skipped rather than queried.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!travelConfigured()) {
    return NextResponse.json({ error: "not_configured", message: "Nearby-date pricing needs a search provider token." }, { status: 503 });
  }

  let body: FlightSearchParams & { spread?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const problem = validateFlightSearch(body);
  if (problem) return NextResponse.json({ error: "invalid_search", message: problem }, { status: 400 });

  const spread = Math.min(MAX_SPREAD, Math.max(1, body.spread ?? 2));
  const today = new Date().toISOString().slice(0, 10);
  // Keep the trip the same length: move the return with the departure.
  const offsets = Array.from({ length: spread * 2 + 1 }, (_, i) => i - spread).filter((o) => o !== 0);
  const candidates = offsets
    .map((o) => ({ offset: o, depart: shift(body.departDate, o), returnDate: body.returnDate ? shift(body.returnDate, o) : undefined }))
    .filter((c) => c.depart >= today);

  const settled = await Promise.allSettled(
    candidates.map((c) =>
      cheapestFlightPrice({ ...body, departDate: c.depart, returnDate: c.returnDate, maxResults: 8 }),
    ),
  );

  const days = candidates.map((c, i) => {
    const r = settled[i];
    return {
      date: c.depart,
      returnDate: c.returnDate ?? null,
      price: r.status === "fulfilled" ? r.value : null,
      error: r.status === "rejected" ? ((r.reason as Error)?.message ?? "failed").slice(0, 120) : null,
    };
  });

  return NextResponse.json({ days, searches: candidates.length });
}
