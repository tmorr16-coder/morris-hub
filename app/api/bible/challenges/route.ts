import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// POST — create a Bible reading challenge scoped to the caller's family circle
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { plan_id, title, description, start_date } = await req.json().catch(() => ({}));
  if (!plan_id || !title?.trim()) {
    return NextResponse.json({ error: "plan_id and title required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: challenge, error } = await db
    .schema("bible")
    .from("challenges")
    .insert({
      plan_id,
      title: title.trim(),
      description: description?.trim() || null,
      start_date: start_date || new Date().toISOString().slice(0, 10),
      visibility: "family",
      circle_owner_id: user.id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Auto-enroll the creator as a participant
  await db.schema("bible").from("challenge_participants")
    .upsert({ challenge_id: challenge.id, user_id: user.id }, { onConflict: "challenge_id,user_id" });

  return NextResponse.json({ ok: true, challenge_id: challenge.id });
}
