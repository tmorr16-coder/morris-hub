/**
 * File extraction utilities for PDF and DOCX documents
 * Extracts text content from uploaded course materials
 */

/**
 * Extract text from a PDF buffer
 * Returns the first 5000 characters of extracted text
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdf = require('pdf-parse');
    const data = await pdf(buffer);

    // Combine all pages and limit to 5000 chars
    const fullText = data.text || '';
    return fullText.substring(0, 5000);
  } catch (err) {
    console.error('PDF extraction error:', err);
    return `[PDF extraction failed: ${err instanceof Error ? err.message : 'Unknown error'}]`;
  }
}

/**
 * Extract text from a DOCX buffer
 * Returns the full extracted text (up to 10000 chars)
 */
export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });

    const text = result.value || '';
    return text.substring(0, 10000);
  } catch (err) {
    console.error('DOCX extraction error:', err);
    return `[DOCX extraction failed: ${err instanceof Error ? err.message : 'Unknown error'}]`;
  }
}

/**
 * Extract text from plain text file
 */
export async function extractTextFromTXT(buffer: Buffer): Promise<string> {
  try {
    const text = buffer.toString('utf-8');
    return text.substring(0, 10000);
  } catch (err) {
    console.error('TXT extraction error:', err);
    return `[TXT extraction failed: ${err instanceof Error ? err.message : 'Unknown error'}]`;
  }
}

/**
 * Determine file type from MIME type and extract text accordingly
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType.includes('pdf')) {
    return extractTextFromPDF(buffer);
  } else if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
    return extractTextFromDOCX(buffer);
  } else if (mimeType.includes('text/plain')) {
    return extractTextFromTXT(buffer);
  } else {
    return '[Unsupported file type for text extraction]';
  }
}

// ── Panel attachments ───────────────────────────────────────────────────────
// The Ask-the-panel composer accepts a wider set than the course uploader:
// the plain-text family (md, csv, json, source code) reads fine as UTF-8, and
// browsers are inconsistent about the MIME type they report for those, so the
// extension is the tiebreaker.

/** Text-ish extensions we accept even when the browser reports no useful MIME. */
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'yaml', 'yml', 'xml', 'html',
  'log', 'rtf', 'ts', 'tsx', 'js', 'jsx', 'py', 'rb', 'go', 'java', 'sql', 'sh', 'css',
]);

export type AttachmentKind = 'pdf' | 'docx' | 'text' | 'image' | 'unsupported';

export function classifyAttachment(fileName: string, mimeType: string): AttachmentKind {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  if (mimeType.includes('pdf') || ext === 'pdf') return 'pdf';
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword') || ext === 'docx' || ext === 'doc') return 'docx';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml')) return 'text';
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  return 'unsupported';
}

/**
 * Pull text out of one panel attachment.
 *
 * `limit` is a character ceiling, not a byte one — the caller pays per token for
 * whatever comes back, so a 300-page PDF gets truncated rather than silently
 * costing a fortune. Returns the text plus whether it was cut short, so the UI
 * can say so instead of quietly handing the models a partial document.
 */
export async function extractAttachmentText(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  limit = 24_000
): Promise<{ text: string; truncated: boolean; kind: AttachmentKind; pages?: number }> {
  const kind = classifyAttachment(fileName, mimeType);
  let text = '';
  let pages: number | undefined;

  if (kind === 'pdf') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdf = require('pdf-parse');
      const data = await pdf(buffer);
      text = data.text ?? '';
      // Kept even when there's no text: it's how the OCR fallback quotes its
      // per-page cost before spending anything.
      pages = typeof data.numpages === 'number' ? data.numpages : undefined;
    } catch (err) {
      throw new Error(`Could not read ${fileName}: ${err instanceof Error ? err.message : 'PDF extraction failed'}`);
    }
  } else if (kind === 'docx') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth');
      text = (await mammoth.extractRawText({ buffer })).value ?? '';
    } catch (err) {
      throw new Error(`Could not read ${fileName}: ${err instanceof Error ? err.message : 'DOCX extraction failed'}`);
    }
  } else if (kind === 'text') {
    text = buffer.toString('utf-8');
  } else {
    throw new Error(`${fileName} isn't a file type the panel can read.`);
  }

  // Collapse the runs of blank lines PDF extraction leaves behind — they burn
  // tokens and tell the models nothing.
  text = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();

  const truncated = text.length > limit;
  return { text: truncated ? text.slice(0, limit) : text, truncated, kind, pages };
}
