import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { amadeusConfigured, searchHotels, type HotelSearchParams } from "@/lib/amadeus";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!amadeusConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "Hotel search isn't connected yet. Add Amadeus API keys to enable live results." },
      { status: 503 },
    );
  }

  let body: HotelSearchParams;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body.cityCode || !body.checkIn || !body.checkOut) {
    return NextResponse.json({ error: "Missing city, check-in, or check-out" }, { status: 400 });
  }

  try {
    const offers = await searchHotels(body);
    // Priced first (cheapest), then unpriced listings.
    offers.sort((a, b) => {
      if (a.price == null && b.price == null) return 0;
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      return a.price - b.price;
    });
    return NextResponse.json({ offers });
  } catch (err) {
    return NextResponse.json({ error: "search_failed", message: (err as Error).message }, { status: 502 });
  }
}
