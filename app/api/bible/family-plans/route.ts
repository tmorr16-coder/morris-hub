"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// POST — create a family reading plan from an existing plan
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { plan_id, name } = await req.json().catch(() => ({}));
  if (!plan_id || !name?.trim()) {
    return NextResponse.json({ error: "plan_id and name required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Create the family plan
  const { data: fp, error: fpErr } = await db
    .schema("bible")
    .from("family_plans")
    .insert({ plan_id, name: name.trim(), created_by: user.id })
    .select("id")
    .single();

  if (fpErr) return NextResponse.json({ error: fpErr.message }, { status: 400 });

  // Auto-enroll the creator
  await db.schema("bible").from("family_plan_members")
    .insert({ family_plan_id: fp.id, user_id: user.id });

  return NextResponse.json({ ok: true, family_plan_id: fp.id });
}

// PATCH — join an existing family plan
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { family_plan_id } = await req.json().catch(() => ({}));
  if (!family_plan_id) return NextResponse.json({ error: "family_plan_id required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { error } = await db.schema("bible").from("family_plan_members")
    .upsert({ family_plan_id, user_id: user.id }, { onConflict: "family_plan_id,user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
