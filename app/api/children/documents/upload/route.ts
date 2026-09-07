import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { childForGuardian } from "@/app/children/_lib/children";

export const runtime = "nodejs";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

// Attach the photographed pages to a saved document.
//
// A route handler, not a server action, on purpose: Next caps a server
// action's body at 1 MB, and three phone photos of a newsletter are more than
// that even after resizing. The first version sent them through an action,
// which threw a 413 after the document had already been saved — the plan was
// kept, the pages were not, and the screen sat on "Saving…" for good.
// Vercel's own ceiling for a route body is 4.5 MB, which is what the client
// budgets for.

const BUCKET = "child-documents";
const MAX_TOTAL = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
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
  const documentId = String(formData.get("documentId") ?? "");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (!childId || !documentId) return NextResponse.json({ error: "Missing ids." }, { status: 400 });
  if (files.length === 0) return NextResponse.json({ paths: [] });

  const svc = createServiceClient() as any;
  const child = await childForGuardian(svc, childId, user.id);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: doc } = await svc.schema("hub").from("child_documents").select("id").eq("id", documentId).eq("child_id", childId).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  let total = 0;
  const paths: string[] = [];
  for (const [i, file] of files.entries()) {
    total += file.size;
    if (total > MAX_TOTAL) break;
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || `page-${i + 1}.jpg`;
    const path = `${user.id}/${childId}/${documentId}/${i + 1}-${safe}`;
    const { error } = await svc.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: true });
    if (!error) paths.push(path);
  }
  if (paths.length > 0) {
    await svc.schema("hub").from("child_documents").update({ file_paths: paths }).eq("id", documentId).eq("child_id", childId);
  }
  return NextResponse.json({ paths, skipped: files.length - paths.length });
}
