// HTML to plain text, in one pass.
//
// The app had four copies of the same regex chain — strip <script>, strip
// <style>, strip tags, decode entities — and code scanning flagged every one:
// lazy `[\s\S]*?` blocks go quadratic on a page with many unclosed openers,
// a single replace pass leaves "<scr<script>ipt>" behind as "<script>", and
// decoding &amp; before &lt; turns "&amp;lt;" into "<".
//
// This walks the string once with indexOf, never backtracks, and decodes
// entities in a single replace so nothing is decoded twice. Whatever it
// returns contains no "<" or ">" at all, so it is safe to show as text and
// safe to hand to a model.

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", copy: "©", reg: "®", trade: "™",
};

/** Decode HTML entities exactly once. "&amp;lt;" becomes "&lt;", never "<". */
export function decodeEntities(text: string): string {
  return text.replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]{2,8});/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/** Elements whose content is never text. */
const SKIP = ["script", "style", "head", "noscript", "template", "svg"];
/** Closing these starts a new line, so paragraphs stay paragraphs. */
const BLOCK = /^\/?(p|div|br|tr|li|h[1-6]|table|section|article|header|footer|ul|ol|blockquote|hr)\b/i;

export function htmlToText(html: string, { maxChars = Infinity, keepLines = false } = {}): string {
  const src = String(html ?? "");
  const lower = src.toLowerCase();
  const n = src.length;
  let out = "";
  let i = 0;

  while (i < n && out.length < maxChars * 2) {
    const lt = src.indexOf("<", i);
    if (lt === -1) { out += src.slice(i); break; }
    out += src.slice(i, lt);

    if (lower.startsWith("<!--", lt)) {
      const end = src.indexOf("-->", lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }

    const gt = src.indexOf(">", lt + 1);
    if (gt === -1) break;                     // an unterminated tag: drop the rest
    const inner = src.slice(lt + 1, gt).trim();
    const name = inner.match(/^[a-z][a-z0-9]*/i)?.[0]?.toLowerCase() ?? "";
    i = gt + 1;

    if (SKIP.includes(name)) {
      const close = lower.indexOf(`</${name}`, i);
      if (close === -1) { i = n; break; }
      const closeEnd = src.indexOf(">", close);
      i = closeEnd === -1 ? n : closeEnd + 1;
      out += " ";
      continue;
    }
    out += keepLines && BLOCK.test(inner) ? "\n" : " ";
  }

  let text = decodeEntities(out).replace(/[<>]/g, " ");
  text = keepLines
    ? text.replace(/[ \t\f\v ]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
    : text.replace(/\s+/g, " ").trim();
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/** Remove HTML comments, including an unterminated one, without a regex. */
export function stripHtmlComments(text: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    const start = text.indexOf("<!--", i);
    if (start === -1) return out + text.slice(i);
    out += text.slice(i, start);
    const end = text.indexOf("-->", start + 4);
    if (end === -1) return out;
    i = end + 3;
  }
}
