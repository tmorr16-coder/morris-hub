import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Horizon sort order for consistent ordering
const HORIZON_ORDER: Record<string, number> = {
  short: 0,
  medium: 1,
  long: 2,
};

// GET: fetch user's goals, ordered by horizon (short→medium→long), then target_date
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
    .schema("career")
    .from("career_goals")
    .select("*")
    .eq("user_id", user.id)
    .order("target_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[career/goals GET] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sort by horizon order, then target_date (already sorted by DB)
  const sorted = (data ?? []).sort((a: any, b: any) => {
    const hA = HORIZON_ORDER[a.horizon] ?? 1;
    const hB = HORIZON_ORDER[b.horizon] ?? 1;
    if (hA !== hB) return hA - hB;
    // target_date already sorted by DB; keep stable
    return 0;
  });

  return NextResponse.json(sorted);
}

// POST: create goal
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    title,
    description,
    why,
    success_criteria,
    category,
    horizon,
    target_date,
    start_date,
    color_tag,
    status,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data, error } = await db
    .schema("career")
    .from("career_goals")
    .insert([
      {
        user_id: user.id,
        title,
        description: description ?? null,
        why: why ?? null,
        success_criteria: success_criteria ?? null,
        category: category ?? "career",
        horizon: horizon ?? "medium",
        target_date: target_date ?? null,
        start_date: start_date ?? undefined,
        color_tag: color_tag ?? "#3B5C7F",
        status: status ?? "active",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("[career/goals POST] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
