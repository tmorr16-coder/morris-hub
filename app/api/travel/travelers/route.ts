import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Traveler } from "@/app/travel/types";

export const runtime = "nodejs";

const FIELDS = "id, family_member_id, is_self, given_name, family_name, date_of_birth, gender, nationality, passport_number, passport_expiry, passport_country, known_traveler_number, seat_pref, meal_pref, email, phone";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data } = await service
    .schema("travel").from("travelers")
    .select(FIELDS).eq("user_id", user.id) // scoping-ok: user-scoped read
    .order("is_self", { ascending: false }).order("created_at", { ascending: true });

  return NextResponse.json({ travelers: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let p: Partial<Traveler>;
  try { p = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!p.given_name && !p.family_name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const row = {
    user_id: user.id, // scoping-ok: user-scoped write
    family_member_id: p.family_member_id ?? null,
    is_self: p.is_self ?? false,
    given_name: p.given_name ?? null,
    family_name: p.family_name ?? null,
    date_of_birth: p.date_of_birth || null,
    gender: p.gender ?? null,
    nationality: p.nationality ?? null,
    passport_number: p.passport_number ?? null,
    passport_expiry: p.passport_expiry || null,
    passport_country: p.passport_country ?? null,
    known_traveler_number: p.known_traveler_number ?? null,
    seat_pref: p.seat_pref ?? null,
    meal_pref: p.meal_pref ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    updated_at: new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  if (p.id) {
    const { error } = await service
      .schema("travel").from("travelers")
      .update(row).eq("id", p.id).eq("user_id", user.id); // scoping-ok: user-scoped write
    if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const { data, error } = await service
    .schema("travel").from("travelers")
    .insert(row).select("id").single();
  if (error) return NextResponse.json({ error: "Failed to add traveler" }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("travel").from("travelers")
    .delete().eq("id", id).eq("user_id", user.id); // scoping-ok: user-scoped write
  if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
