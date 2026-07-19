import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { PriceWatch } from "@/app/travel/types";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data } = await service
    .schema("travel").from("price_watches")
    .select("*").eq("user_id", user.id) // scoping-ok: user-scoped read
    .order("created_at", { ascending: false });

  return NextResponse.json({ watches: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let p: Partial<PriceWatch>;
  try { p = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!p.kind) return NextResponse.json({ error: "Missing kind" }, { status: 400 });

  const row = {
    user_id: user.id, // scoping-ok: user-scoped write
    kind: p.kind,
    origin: p.origin ?? null,
    destination: p.destination ?? null,
    depart_date: p.depart_date ?? null,
    return_date: p.return_date ?? null,
    cabin: p.cabin ?? null,
    adults: p.adults ?? 1,
    target_price: p.target_price ?? null,
    last_price: p.last_price ?? null,
    active: p.active ?? true,
    notify: p.notify ?? true,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  if (p.id) {
    const { error } = await service
      .schema("travel").from("price_watches")
      .update(row).eq("id", p.id).eq("user_id", user.id); // scoping-ok: user-scoped write
    if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const { data, error } = await service
    .schema("travel").from("price_watches")
    .insert(row).select("id").single();
  if (error) return NextResponse.json({ error: "Failed to add watch" }, { status: 500 });
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
    .schema("travel").from("price_watches")
    .delete().eq("id", id).eq("user_id", user.id); // scoping-ok: user-scoped write
  if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
