/**
 * Attachments for "Ask the panel" — the documents and images a thread carries
 * as context.
 *
 * An attachment is resolved once (extracted on upload, or read from a library
 * row) and then travels with the thread, so every follow-up sees it without the
 * user re-picking it. Note that it is genuinely re-sent to the models on each
 * turn: the OpenRouter chat API is stateless, so "carried" means the client
 * keeps supplying it, and the input tokens are charged again each time. That is
 * why extraction is capped — see extractAttachmentText's `limit`.
 */
export interface PanelAttachment {
  id: string;
  name: string;
  kind: "pdf" | "docx" | "text" | "image";
  /** Extracted text — set for every kind except image and remote-parsed PDFs. */
  text?: string;
  /** data: URI — images, and PDFs we couldn't read ourselves. */
  dataUrl?: string;
  /** True when extraction hit the character ceiling. */
  truncated?: boolean;
  /**
   * A PDF with no readable text layer — a scan, or a form whose field values
   * were never rendered into the page. There is nothing to extract locally, so
   * the file itself is sent and OpenRouter's file-parser (OCR) reads it.
   */
  remoteParse?: boolean;
  /** Page count, when we could read it — used to quote the OCR cost. */
  pages?: number;
  /**
   * This attachment's text came from OCR rather than local extraction. Set once
   * the PDF has been read and discarded, so the chip can show it's done and the
   * cost line stops quoting a charge that has already been paid.
   */
  ocrDone?: boolean;
  /** Where it came from, for the chip in the composer. */
  source: "upload" | "library";
}

/** $2 per 1,000 pages, OpenRouter's Mistral OCR rate. */
export const OCR_COST_PER_PAGE = 0.002;

/** Rough token estimate for a chunk of English prose (~4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Render the document attachments into one system-context block.
 *
 * Documents go in as text with a clear delimiter and filename so a model can
 * cite which file it's drawing on. Images are excluded here — they ride as
 * `image_url` content parts instead (see buildImageParts).
 */
export function buildContextBlock(attachments: PanelAttachment[]): string {
  const docs = attachments.filter((a) => a.kind !== "image" && a.text?.trim());
  if (!docs.length) return "";

  const parts = docs.map((a) => {
    const head = `--- BEGIN FILE: ${a.name} ---`;
    const tail = `--- END FILE: ${a.name} ---`;
    const note = a.truncated ? `\n[Truncated — this is the beginning of the file only.]` : "";
    return `${head}\n${a.text}${note}\n${tail}`;
  });

  return [
    `The user attached ${docs.length} file${docs.length === 1 ? "" : "s"} as context for this conversation.`,
    `Use them when answering. Refer to a file by name when you draw on it, and say so plainly if the answer isn't in them.`,
    "",
    ...parts,
  ].join("\n");
}

/** The image attachments, as OpenRouter content parts. */
export function buildImageParts(attachments: PanelAttachment[]) {
  return attachments
    .filter((a) => a.kind === "image" && a.dataUrl)
    .map((a) => ({ type: "image_url" as const, image_url: { url: a.dataUrl as string } }));
}

/**
 * PDFs we couldn't read, as `file` content parts for OpenRouter to parse.
 *
 * Unlike images, these are safe to send to any model: when the model has no
 * native file support the file-parser plugin converts the PDF first and passes
 * text along, so no column of the panel 400s on it.
 */
export function buildFileParts(attachments: PanelAttachment[]) {
  return attachments
    .filter((a) => a.remoteParse && a.dataUrl)
    .map((a) => ({
      type: "file" as const,
      file: { filename: a.name, file_data: a.dataUrl as string },
    }));
}

/**
 * Pull the plain text out of OpenRouter's file-parse annotations.
 *
 * An annotation's `content` is a mixed array — text blocks *and* any images the
 * OCR pulled out, as base64 data URLs (up to 8 per PDF). Only the text is worth
 * keeping: it is what answers questions, and it is a few KB where the images are
 * megabytes. Once we have it, the PDF itself can be discarded and the attachment
 * behaves like any other text file for the rest of the thread.
 */
export function extractParsedText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  annotations: Record<string, any>[],
  limit = 24_000
): { name: string | null; text: string; truncated: boolean }[] {
  return annotations
    .map((a) => {
      const file = a?.file ?? {};
      const parts = Array.isArray(file.content) ? file.content : [];
      const text = parts
        .filter((p: { type?: string; text?: string }) => p?.type === "text" && typeof p.text === "string")
        .map((p: { text: string }) => p.text)
        .join("\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      const truncated = text.length > limit;
      return {
        name: typeof file.name === "string" ? file.name : null,
        text: truncated ? text.slice(0, limit) : text,
        truncated,
      };
    })
    .filter((f) => f.text.length > 0);
}

/** What the OCR pass will cost for whatever still needs parsing, in dollars. */
export function estimateOcrCost(attachments: PanelAttachment[]): number {
  return attachments
    .filter((a) => a.remoteParse)
    .reduce((sum, a) => sum + (a.pages ?? 1) * OCR_COST_PER_PAGE, 0);
}

/** A short human summary of what's attached, for the cost/notice line. */
export function describeAttachments(attachments: PanelAttachment[]): string {
  if (!attachments.length) return "";
  const docs = attachments.filter((a) => a.kind !== "image").length;
  const imgs = attachments.length - docs;
  const bits: string[] = [];
  if (docs) bits.push(`${docs} file${docs === 1 ? "" : "s"}`);
  if (imgs) bits.push(`${imgs} image${imgs === 1 ? "" : "s"}`);
  return bits.join(" + ");
}
