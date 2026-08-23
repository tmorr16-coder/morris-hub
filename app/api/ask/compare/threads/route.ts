import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Saved panel conversations.
 *
 * Threads used to live only in localStorage, so one started on a phone did not
 * exist on a laptop and old ones were silently shed when the browser budget ran
 * out. They are now stored per user, keyed by the client's own thread id.
 *
 * Attachments are NOT stored: a thread can carry base64 images and PDFs, which
 * belong in neither a jsonb column nor a sync payload. They stay in the browser
 * that added them; the extracted text — the part that answers questions — is
 * kept, since it is what later turns actually send.
 */

const MAX_THREADS = 30;
/** A single conversation past this is a bug, not a conversation. */
const MAX_PAYLOAD_BYTES = 400_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripHeavy(thread: any) {
  if (!thread || typeof thread !== "object") return thread;
  const attachments = Array.isArray(thread.attachments)
    ? thread.attachments
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((a: any) => a?.kind !== "image" && !a?.remoteParse)
        // Drop the base64 payload, keep the rest of the attachment record.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((a: any) => { const copy = { ...a }; delete copy.dataUrl; return copy; })
    : [];
  return { ...thread, attachments };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data, error } = await db
    .schema("hub")
    .from("panel_threads")
    .select("payload")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(MAX_THREADS);

  // A sync failure must never look like "you have no conversations" — the
  // client keeps its local copy when this comes back unavailable.
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

  const payload = stripHeavy(thread);
  if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { error } = await db
    .schema("hub")
    .from("panel_threads")
    .upsert(
      { user_id: user.id, thread_id: thread.id, payload, updated_at: new Date().toISOString() },
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
  const q = db.schema("hub").from("panel_threads").delete().eq("user_id", user.id);
  // No id means "clear all" — the Clear all control in the saved list.
  const { error } = id ? await q.eq("thread_id", Number(id)) : await q;
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
