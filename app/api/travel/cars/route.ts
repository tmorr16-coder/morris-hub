import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { carsConfigured, searchCars, type CarSearchParams } from "@/lib/travel-search";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!carsConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "Car search needs a SerpApi token — Duffel doesn't carry car inventory." },
      { status: 503 },
    );
  }

  let body: CarSearchParams;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body.city || body.city.trim().length < 2) {
    return NextResponse.json({ error: "invalid_search", message: "Enter a city or airport to look for cars near." }, { status: 400 });
  }

  try {
    const { offers, provider, cached } = await searchCars(body);
    // Best-rated first; unrated listings last rather than treated as zero.
    offers.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    return NextResponse.json({ offers, provider, cached });
  } catch (err) {
    return NextResponse.json({ error: "search_failed", message: (err as Error).message }, { status: 502 });
  }
}
