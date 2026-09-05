import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Saved advisor conversations.
 *
 * The client keeps its own copy in localStorage and treats this as a sync, not
 * as the source of truth. That matters twice: a conversation survives a reload
 * before the migration in supabase/migrations/20260906_advisor_threads.sql has
 * been applied, and a failure here can never present as "you have no
 * conversations" — every error path returns 503, which the client reads as
 * "keep what you have" rather than as an empty list.
 *
 * Reviews are stored with their turns. They are the second model's findings
 * about a specific answer, so an answer that comes back without the critique
 * that qualified it would be the more misleading of the two to persist.
 */

const MAX_THREADS = 30;
/** A single advisor conversation past this is a bug, not a conversation. */
const MAX_PAYLOAD_BYTES = 400_000;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data, error } = await db
    .schema("hub")
    .from("advisor_threads")
    .select("payload")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(MAX_THREADS);

  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json({ threads: (data ?? []).map((r: any) => r.payload) });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let thread: { id?: number };
  try {
    thread = (await req.json())?.thread;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!thread || typeof thread.id !== "number") {
    return NextResponse.json({ error: "Missing thread" }, { status: 400 });
  }

  if (JSON.stringify(thread).length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { error } = await db
    .schema("hub")
    .from("advisor_threads")
    .upsert(
      { user_id: user.id, thread_id: thread.id, payload: thread, updated_at: new Date().toISOString() },
      { onConflict: "user_id,thread_id" }
    );
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const q = db.schema("hub").from("advisor_threads").delete().eq("user_id", user.id);
  // No id means "clear all" — the control on the saved list.
  const { error } = id ? await q.eq("thread_id", Number(id)) : await q;
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
