import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { travelConfigured, cheapestHotelPrice, type HotelSearchParams } from "@/lib/travel-search";
import { validateHotelSearch } from "@/lib/travel-validate";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SPREAD = 3;

function shift(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Cheapest stay on the days around your check-in, keeping the stay the same
 * length. One provider search per day, so the client asks for it explicitly and
 * the response reports what it spent.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!travelConfigured()) {
    return NextResponse.json({ error: "not_configured", message: "Nearby-date pricing needs a search provider token." }, { status: 503 });
  }

  let body: HotelSearchParams & { spread?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const problem = validateHotelSearch(body);
  if (problem) return NextResponse.json({ error: "invalid_search", message: problem }, { status: 400 });

  const spread = Math.min(MAX_SPREAD, Math.max(1, body.spread ?? 2));
  const today = new Date().toISOString().slice(0, 10);
  const offsets = Array.from({ length: spread * 2 + 1 }, (_, i) => i - spread).filter((o) => o !== 0);
  const candidates = offsets
    .map((o) => ({ checkIn: shift(body.checkIn, o), checkOut: shift(body.checkOut, o) }))
    .filter((c) => c.checkIn >= today);

  const settled = await Promise.allSettled(
    candidates.map((c) => cheapestHotelPrice({ ...body, checkIn: c.checkIn, checkOut: c.checkOut, maxResults: 10 })),
  );

  const days = candidates.map((c, i) => {
    const r = settled[i];
    return {
      date: c.checkIn,
      checkOut: c.checkOut,
      price: r.status === "fulfilled" ? r.value : null,
      error: r.status === "rejected" ? ((r.reason as Error)?.message ?? "failed").slice(0, 120) : null,
    };
  });

  return NextResponse.json({ days, searches: candidates.length });
}
