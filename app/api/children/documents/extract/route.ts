import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { childForGuardian } from "@/app/children/_lib/children";
import { readSchoolDocument, ALLOWED, MAX_TOTAL, MAX_PAGES, type DocumentPart } from "@/app/children/_lib/read-document";

export const runtime = "nodejs";
// Five pages of graded work timed out at 120 seconds: the reply is the slow
// part, and it scales with pages. So: three pages per read at most, the
// function's ceiling raised, and a reply budget sized for a real document
// rather than a worst case.
export const maxDuration = 300;

/* eslint-disable @typescript-eslint/no-explicit-any */

// Read a page (or several) from a child's school — a newsletter, a graded
// test, a word list — into the one structure the workspace understands, and
// propose the practice that follows from it. The photos come straight off a
// phone; the client has already turned them into JPEGs under 1568px. The
// reading itself lives in app/children/_lib/read-document.ts, shared with the
// email door.

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Reading documents is not configured on this server." }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }
  const childId = String(formData.get("childId") ?? "");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (!childId) return NextResponse.json({ error: "Which child?" }, { status: 400 });
  if (files.length === 0) return NextResponse.json({ error: "No pages attached." }, { status: 400 });
  if (files.length > MAX_PAGES) return NextResponse.json({ error: `Up to ${MAX_PAGES} pages at a time.` }, { status: 400 });

  const svc = createServiceClient() as any;
  const child = await childForGuardian(svc, childId, user.id);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let total = 0;
  const parts: DocumentPart[] = [];
  for (const f of files) {
    if (!ALLOWED.has(f.type)) {
      return NextResponse.json({ error: `One page is a ${f.type || "unknown type"}. Take a photo or use a PDF — iPhone HEIC photos are converted when picked here.` }, { status: 400 });
    }
    total += f.size;
    if (total > MAX_TOTAL) {
      return NextResponse.json({ error: "Those pages add up to more than can be sent at once. Send fewer pages, or retake them through the app so they are resized." }, { status: 400 });
    }
    const data = Buffer.from(await f.arrayBuffer());
    parts.push(f.type === "application/pdf" ? { type: "pdf", data } : { type: "image", mediaType: f.type as any, data });
  }

  const result = await readSchoolDocument(child, parts, { userId: user.id, source: "upload" });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ extraction: result.extraction });
}
