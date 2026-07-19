import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { LoyaltyProgram } from "@/app/travel/types";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data } = await service
    .schema("travel").from("loyalty_programs")
    .select("*").eq("user_id", user.id) // scoping-ok: user-scoped read
    .order("category", { ascending: true });

  return NextResponse.json({ programs: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let p: Partial<LoyaltyProgram>;
  try { p = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!p.program_name || !p.category) return NextResponse.json({ error: "Missing category or program name" }, { status: 400 });

  const row = {
    user_id: user.id, // scoping-ok: user-scoped write
    category: p.category,
    program_name: p.program_name,
    member_number: p.member_number ?? null,
    tier: p.tier ?? null,
    points_balance: p.points_balance ?? null,
    notes: p.notes ?? null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  if (p.id) {
    const { error } = await service
      .schema("travel").from("loyalty_programs")
      .update(row).eq("id", p.id).eq("user_id", user.id); // scoping-ok: user-scoped write
    if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const { data, error } = await service
    .schema("travel").from("loyalty_programs")
    .insert(row).select("id").single();
  if (error) return NextResponse.json({ error: "Failed to add" }, { status: 500 });
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
    .schema("travel").from("loyalty_programs")
    .delete().eq("id", id).eq("user_id", user.id); // scoping-ok: user-scoped write
  if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
