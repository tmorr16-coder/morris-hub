import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_PREFS, type TravelPreferences } from "@/app/travel/types";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data } = await service
    .schema("travel").from("preferences")
    .select("*").eq("user_id", user.id) // scoping-ok: user-scoped read
    .maybeSingle();

  return NextResponse.json({ preferences: data ?? { ...DEFAULT_PREFS } });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let p: Partial<TravelPreferences>;
  try { p = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("travel").from("preferences")
    .upsert(
      {
        user_id: user.id, // scoping-ok: user-scoped write
        home_airport: p.home_airport ?? null,
        cabin_class: p.cabin_class ?? "ECONOMY",
        max_stops: p.max_stops ?? 2,
        preferred_airlines: p.preferred_airlines ?? [],
        preferred_hotel_chains: p.preferred_hotel_chains ?? [],
        preferred_car_companies: p.preferred_car_companies ?? [],
        hotel_min_rating: p.hotel_min_rating ?? 3,
        currency: p.currency ?? "USD",
        notify_email: p.notify_email ?? true,
        notify_sms: p.notify_sms ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
