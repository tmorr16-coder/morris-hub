import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { mode, section, isTimed, timeLimitS } = await req.json();

  const { data: session, error } = await db
    .schema("student_support")
    .from("lsat_practice_sessions")
    .insert({
      user_id: userId,
      mode,
      section: section ?? null,
      is_timed: isTimed ?? false,
      time_limit_s: timeLimitS ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessionId: session.id });
}

// PATCH: end a session
export async function PATCH(req: NextRequest) {
  const userId = await getCurrentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await db
    .schema("student_support")
    .from("lsat_practice_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
