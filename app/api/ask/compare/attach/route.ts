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
// A PDF with no text layer travels as base64 for OCR. Bounded because it rides
// on the thread and gets persisted; well under Vercel's request ceiling.
const MAX_OCR_PDF_BYTES = 6 * 1024 * 1024;

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
    const { text, truncated, pages } = await extractAttachmentText(buffer, file.name, file.type);

    if (!text.trim()) {
      // A PDF with no text layer — a scan, or a filled form whose field values
      // live in the AcroForm dictionary and were never drawn onto the page.
      // Nothing local can read either, so send the file itself and let
      // OpenRouter's OCR do it. Rejecting here used to be a dead end for
      // exactly the documents people most want to ask about.
      if (kind === "pdf") {
        if (buffer.byteLength > MAX_OCR_PDF_BYTES) {
          return NextResponse.json(
            { error: `${file.name} has no readable text and is too large to OCR (limit ${MAX_OCR_PDF_BYTES / 1024 / 1024}MB).` },
            { status: 413 }
          );
        }
        const attachment: PanelAttachment = {
          id: crypto.randomUUID(),
          name: file.name,
          kind: "pdf",
          dataUrl: `data:application/pdf;base64,${buffer.toString("base64")}`,
          remoteParse: true,
          pages: pages ?? undefined,
          source: "upload",
        };
        return NextResponse.json({ attachment });
      }

      return NextResponse.json(
        { error: `No text could be read out of ${file.name}.` },
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
