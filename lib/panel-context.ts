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
  /** Extracted text — set for every kind except image. */
  text?: string;
  /** data: URI — set only for images, which go to vision models as-is. */
  dataUrl?: string;
  /** True when extraction hit the character ceiling. */
  truncated?: boolean;
  /** Where it came from, for the chip in the composer. */
  source: "upload" | "library";
}

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
