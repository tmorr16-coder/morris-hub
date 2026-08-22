import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, createServiceClient } from "@/lib/supabase/server";
import type { PanelAttachment } from "@/lib/panel-context";

export const runtime = "nodejs";

/**
 * Documents already in Morris Hub that the panel can use as context.
 *
 * Today that means uploaded course content, which is the only place the app
 * keeps user documents: the tax, pension, and resume flows extract what they
 * need and discard the file, so there is nothing to offer from them. Those
 * rows already carry `extracted_text` from the course uploader, so listing and
 * attaching are both cheap — no storage download, no second extraction.
 *
 * GET  → the picker list (no text, so the payload stays small)
 * POST → resolve chosen ids into full attachments
 */

interface ContentRow {
  id: string;
  title: string;
  file_name: string | null;
  type: string | null;
  file_size_kb: number | null;
  extracted_text: string | null;
  course_id: string;
}

/** Course rows the signed-in user owns — the ownership gate for content. */
async function ownedCourseIds(userId: string): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data } = await db
    .schema("student_support")
    .from("courses")
    .select("id")
    .eq("user_id", userId);
  return ((data ?? []) as { id: string }[]).map((c) => c.id);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseIds = await ownedCourseIds(user.id);
  if (!courseIds.length) return NextResponse.json({ files: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data } = await db
    .schema("student_support")
    .from("course_content")
    .select("id, title, file_name, type, file_size_kb, course_id, courses:course_id(name)")
    .in("course_id", courseIds)
    .eq("is_uploaded", true)
    .not("extracted_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const files = ((data ?? []) as any[]).map((r) => ({
    id: r.id as string,
    title: (r.title ?? r.file_name ?? "Untitled") as string,
    fileName: (r.file_name ?? null) as string | null,
    type: (r.type ?? null) as string | null,
    sizeKb: (r.file_size_kb ?? null) as number | null,
    group: (r.courses?.name ?? "Course files") as string,
  }));

  return NextResponse.json({ files });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let ids: string[];
  try {
    const body = await req.json();
    ids = (Array.isArray(body?.ids) ? body.ids : []).slice(0, 10).map(String);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!ids.length) return NextResponse.json({ attachments: [] });

  // Scope the fetch to courses this user owns, so an id from someone else's
  // library resolves to nothing rather than to their document.
  const courseIds = await ownedCourseIds(user.id);
  if (!courseIds.length) return NextResponse.json({ attachments: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data } = await db
    .schema("student_support")
    .from("course_content")
    .select("id, title, file_name, type, file_size_kb, extracted_text, course_id")
    .in("id", ids)
    .in("course_id", courseIds);

  const LIMIT = 24_000; // same ceiling the upload path applies
  const attachments: PanelAttachment[] = ((data ?? []) as ContentRow[])
    .filter((r) => r.extracted_text?.trim())
    .map((r) => {
      const full = r.extracted_text as string;
      const truncated = full.length > LIMIT;
      return {
        id: r.id,
        name: r.file_name ?? r.title ?? "Untitled",
        kind: "text" as const,
        text: truncated ? full.slice(0, LIMIT) : full,
        truncated,
        source: "library" as const,
      };
    });

  return NextResponse.json({ attachments });
}
