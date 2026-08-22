import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { extractAttachmentText, classifyAttachment } from "@/lib/file-extraction";
import type { PanelAttachment } from "@/lib/panel-context";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB, matching the course uploader
// Images arrive already downscaled by the composer; this is the backstop for a
// client that skipped that step. A data: URI is ~4/3 the size of its bytes, and
// oversized images cost real money on every turn they stay attached.
const MAX_IMAGE_BYTES = 1_500_000;

/**
 * Turn an uploaded file into a PanelAttachment.
 *
 * Extraction happens once, here, rather than on every turn: the thread then
 * carries plain text the models can read, and a 40-page PDF is parsed a single
 * time no matter how long the conversation runs.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
      { status: 413 }
    );
  }

  const kind = classifyAttachment(file.name, file.type);
  if (kind === "unsupported") {
    return NextResponse.json(
      { error: `The panel can't read ${file.name}. Try a PDF, Word doc, image, or plain-text file.` },
      { status: 415 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (kind === "image") {
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `${file.name} is too large to attach as an image. Try one under ${Math.round(MAX_IMAGE_BYTES / 1000)}KB.` },
        { status: 413 }
      );
    }
    const attachment: PanelAttachment = {
      id: crypto.randomUUID(),
      name: file.name,
      kind: "image",
      dataUrl: `data:${file.type};base64,${buffer.toString("base64")}`,
      source: "upload",
    };
    return NextResponse.json({ attachment });
  }

  try {
    const { text, truncated } = await extractAttachmentText(buffer, file.name, file.type);
    if (!text.trim()) {
      return NextResponse.json(
        { error: `No text could be read out of ${file.name}. If it's a scanned document, the panel can't see it.` },
        { status: 422 }
      );
    }
    const attachment: PanelAttachment = {
      id: crypto.randomUUID(),
      name: file.name,
      kind: kind as PanelAttachment["kind"],
      text,
      truncated,
      source: "upload",
    };
    return NextResponse.json({ attachment });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }
}
