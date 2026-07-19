import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { amadeusConfigured, searchFlights, type FlightSearchParams } from "@/lib/amadeus";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!amadeusConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "Flight search isn't connected yet. Add Amadeus API keys to enable live results." },
      { status: 503 },
    );
  }

  let body: FlightSearchParams;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body.origin || !body.destination || !body.departDate) {
    return NextResponse.json({ error: "Missing origin, destination, or departure date" }, { status: 400 });
  }

  try {
    const offers = await searchFlights(body);
    offers.sort((a, b) => a.price - b.price);
    return NextResponse.json({ offers });
  } catch (err) {
    return NextResponse.json({ error: "search_failed", message: (err as Error).message }, { status: 502 });
  }
}
