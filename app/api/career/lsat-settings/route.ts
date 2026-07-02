import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET: fetch LSAT prep settings for the logged-in user (shared with app/student-success/lsat).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data, error } = await db
    .schema("student_support")
    .from("student_settings")
    .select("lsat_enabled, lsat_target_score")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[career/lsat-settings GET] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? { lsat_enabled: false, lsat_target_score: null });
}

// POST/PATCH: upsert LSAT prep settings. Body: { lsat_enabled, lsat_target_score }.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { lsat_enabled, lsat_target_score } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const payload: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (lsat_enabled !== undefined) payload.lsat_enabled = lsat_enabled;
  if (lsat_target_score !== undefined) payload.lsat_target_score = lsat_target_score;

  const { data, error } = await db
    .schema("student_support")
    .from("student_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.error("[career/lsat-settings POST] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PATCH: alias for POST (upsert)
export const PATCH = POST;
