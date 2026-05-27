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
