// Deck building for the PowerPoint export.
//
// The slide breakdown used to come only from a model: prose in, slide JSON out.
// When that call failed (stale model id, unparseable JSON, a truncated reply)
// the export fell back to dumping the whole answer onto one slide, which then
// overflowed off the bottom. So the split is now deterministic: the markdown
// outline is a real fallback, and *every* deck — model-built or not — goes
// through paginate(), which is what actually guarantees nothing overflows.

import PptxGenJS from "pptxgenjs";

export interface Slide {
  title: string;
  subtitle?: string;
  bullets: string[];
}

// Layout budget for the bullet area of a content slide, in "lines of text".
const CHARS_PER_LINE = 76; // at 19pt across the 11.4in text column
const MAX_LINES = 10;      // fits between the rule under the title and the footer
const MAX_BULLETS = 6;     // more than this reads as a wall of text
const MAX_BULLET_CHARS = 300;

/** Strip the markdown a model leaves behind — slides render plain text. */
export function plain(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\((?:https?:)?[^)]*\)/g, "$1") // links → label
    .replace(/(\*\*|__)(.*?)\1/g, "$2")                   // bold
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$)/g, "$1$2")   // italics
    .replace(/`([^`]*)`/g, "$1")                          // code
    .replace(/^\s*#{1,6}\s*/, "")                         // stray heading marks
    .replace(/\s+/g, " ")
    .trim();
}

function lines(bullet: string): number {
  return Math.max(1, Math.ceil(bullet.length / CHARS_PER_LINE));
}

/** Break a long paragraph on sentence boundaries into bullet-sized pieces. */
function sentences(text: string): string[] {
  if (text.length <= 220) return [text];
  const out: string[] = [];
  let buf = "";
  for (const part of text.split(/(?<=[.!?])\s+/)) {
    if (buf && (buf + " " + part).length > 200) { out.push(buf); buf = part; }
    else buf = buf ? `${buf} ${part}` : part;
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * Slides straight from the content's own structure: headings become titles,
 * bullets and paragraphs become bullet points. Used when the model can't be
 * reached or returns nothing usable — never a single dumped slide.
 */
export function outlineFromMarkdown(content: string, title: string): Slide[] {
  const slides: Slide[] = [];
  const start = (t: string): Slide => {
    const slide: Slide = { title: t || title, bullets: [] };
    slides.push(slide);
    return slide;
  };
  let current: Slide | undefined;

  for (const raw of content.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) { current = start(plain(heading[2])); continue; }

    // A short bold-only line ("**Risks**") is a heading in all but syntax.
    const boldOnly = line.match(/^\*\*([^*]{2,60})\*\*:?$/);
    if (boldOnly) { current = start(plain(boldOnly[1])); continue; }

    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    const text = plain(bullet ? bullet[1] : line);
    if (!text) continue;
    if (!current) current = start(title);
    for (const piece of bullet ? [text] : sentences(text)) current.bullets.push(piece);
  }

  return slides.filter((s) => s.bullets.length || s.title);
}

/** Read the model's slide JSON, tolerating code fences and surrounding prose. */
export function parseSlideJson(raw: string): Slide[] {
  const body = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const candidates = [body];
  const first = body.indexOf("{"), last = body.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(body.slice(first, last + 1));

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      const list = Array.isArray(parsed) ? parsed : parsed?.slides;
      if (!Array.isArray(list)) continue;
      const slides = list
        .map((s): Slide => ({
          title: plain(String(s?.title ?? "")),
          subtitle: s?.subtitle ? plain(String(s.subtitle)) : undefined,
          bullets: (Array.isArray(s?.bullets) ? s.bullets : [])
            .map((b: unknown) => plain(String(b ?? "")))
            .filter(Boolean),
        }))
        .filter((s) => s.title || s.bullets.length);
      if (slides.length) return slides.slice(0, 14);
    } catch { /* try the next candidate */ }
  }
  return [];
}

/**
 * Split any slide whose bullets can't fit onto continuation slides. This is the
 * guarantee that content never runs off the bottom, whoever built the outline.
 */
export function paginate(slides: Slide[]): Slide[] {
  const out: Slide[] = [];
  for (const slide of slides) {
    const bullets = slide.bullets
      .map((b) => (b.length > MAX_BULLET_CHARS ? b.slice(0, MAX_BULLET_CHARS - 1).replace(/\s+\S*$/, "") + "…" : b))
      .filter(Boolean);

    if (!bullets.length) { out.push({ ...slide, bullets: [] }); continue; }

    let page: string[] = [];
    let used = 0;
    let part = 0;
    const flush = () => {
      if (!page.length) return;
      part++;
      out.push({
        title: part === 1 ? slide.title : `${slide.title} (cont.)`,
        subtitle: part === 1 ? slide.subtitle : undefined,
        bullets: page,
      });
      page = []; used = 0;
    };
    // A subtitle eats into the first page's budget.
    const budget = () => MAX_LINES - (part === 0 && slide.subtitle ? 1 : 0);
    for (const b of bullets) {
      const n = lines(b);
      if (page.length && (used + n > budget() || page.length >= MAX_BULLETS)) flush();
      page.push(b);
      used += n;
    }
    flush();
  }
  return out;
}

const NAVY = "1C2B45", BLUE = "356FB0", GRAY = "44454A", MUTE = "8A8D96", BG = "FBFCFD";
const FONT = "Helvetica Neue";

/** Render the cover + content slides to a .pptx buffer. */
export async function renderDeck(title: string, slides: Slide[]): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const footer = (s: PptxGenJS.Slide, n: number, total: number) => {
    s.addShape(pptx.ShapeType.line, { x: 0.7, y: 6.95, w: 11.93, h: 0, line: { color: "E3E6EB", width: 1 } });
    s.addText("morrisai.family", { x: 0.7, y: 7.0, w: 6, h: 0.35, fontSize: 10, color: MUTE, fontFace: FONT });
    s.addText(`${n} / ${total}`, { x: 11.6, y: 7.0, w: 1.0, h: 0.35, fontSize: 10, color: MUTE, align: "right", fontFace: FONT });
  };

  // ── Cover ──
  const cover = pptx.addSlide();
  cover.background = { color: NAVY };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: 7.5, fill: { color: BLUE } });
  cover.addText("M", { x: 0.7, y: 1.9, w: 1.0, h: 1.0, fontSize: 44, bold: true, color: "FFFFFF", fontFace: FONT });
  cover.addText(title, { x: 0.7, y: 3.0, w: 11.9, h: 1.8, fontSize: 38, bold: true, color: "FFFFFF", fontFace: FONT, valign: "top" });
  cover.addText(`Generated with Ask Morris · ${dateStr}`, { x: 0.72, y: 4.9, w: 11.9, h: 0.5, fontSize: 15, color: "AEC3DE", fontFace: FONT });

  // ── Content ──
  slides.forEach((sl, i) => {
    const s = pptx.addSlide();
    s.background = { color: BG };
    s.addText(sl.title || title, { x: 0.7, y: 0.5, w: 11.9, h: 0.75, fontSize: 30, bold: true, color: NAVY, fontFace: FONT, valign: "top" });
    s.addShape(pptx.ShapeType.rect, { x: 0.72, y: 1.3, w: 1.9, h: 0.07, fill: { color: BLUE } });

    let bulletsY = 1.75;
    if (sl.subtitle) {
      s.addText(sl.subtitle, { x: 0.72, y: 1.42, w: 11.9, h: 0.45, fontSize: 15, italic: true, color: MUTE, fontFace: FONT });
      bulletsY = 2.15;
    }
    if (sl.bullets.length) {
      // Shrink a little when a page is dense, so wrapping stays inside the box.
      const used = sl.bullets.reduce((n, b) => n + lines(b), 0);
      const fontSize = used > 8 ? 16 : used > 6 ? 17.5 : 19;
      const body = sl.bullets.map((b) => ({
        text: b,
        options: { bullet: { code: "2022", indent: 18 }, fontSize, color: GRAY, paraSpaceAfter: 12, lineSpacingMultiple: 1.05 },
      }));
      s.addText(body, { x: 0.95, y: bulletsY, w: 11.4, h: 6.75 - bulletsY, fontFace: FONT, valign: "top", shrinkText: true });
    }
    footer(s, i + 1, slides.length);
  });

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
