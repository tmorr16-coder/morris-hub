import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openrouterConfigured, askModel, SLIDE_MODEL } from "@/lib/openrouter";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import PptxGenJS from "pptxgenjs";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body { content: string; format: "md" | "docx" | "pptx"; title?: string }

function slug(s: string): string {
  return (s || "morris-export").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "export";
}

// Split "**bold** and normal" into docx TextRuns.
function runs(line: string): TextRun[] {
  return line.split(/\*\*/).map((seg, i) => new TextRun({ text: seg, bold: i % 2 === 1 }));
}

function buildDocx(content: string, title: string): Document {
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const paras: Paragraph[] = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE, spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: `morrisai.family · ${dateStr}`, italics: true, color: "8A8A8A", size: 20 })], spacing: { after: 280 } }),
  ];
  for (const raw of content.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length === 1 ? HeadingLevel.HEADING_1 : h[1].length === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      paras.push(new Paragraph({ children: runs(h[2]), heading: lvl, spacing: { before: 240, after: 90 } }));
      continue;
    }
    const b = line.match(/^\s*[-*•]\s+(.*)$/);
    if (b) { paras.push(new Paragraph({ children: runs(b[1]), bullet: { level: 0 }, spacing: { after: 70 } })); continue; }
    paras.push(new Paragraph({ children: runs(line), spacing: { after: 140, line: 276 } }));
  }
  return new Document({
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: paras,
    }],
  });
}

interface Slide { title: string; subtitle?: string; bullets: string[] }

async function buildPptx(content: string, title: string): Promise<{ buffer: Buffer; cost: number | null }> {
  // Ask a model to structure the prose into slides.
  let slides: Slide[] = [];
  let cost: number | null = null;
  try {
    const raw = await askModel(SLIDE_MODEL, [
      { role: "system", content: "You are a presentation designer. Turn the content into a clean, well-structured deck. Return ONLY JSON: {\"slides\":[{\"title\":\"Short slide title\",\"subtitle\":\"optional one-line framing\",\"bullets\":[\"concise point\",\"concise point\"]}]}. Rules: 5-9 slides. Open with an agenda/overview slide and CLOSE with a \"Key Takeaways\" slide. 3-5 bullets per slide, each ≤14 words, parallel phrasing, no markdown symbols, no sub-bullets. Titles are punchy (≤6 words)." },
      { role: "user", content: `Deck title: ${title}\n\nSource content:\n${content.slice(0, 9000)}` },
    ], 1800);
    cost = raw.cost;
    const cleaned = raw.content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    slides = Array.isArray(parsed.slides) ? parsed.slides : [];
  } catch { slides = []; }

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";
  const NAVY = "1C2B45", BLUE = "356FB0", GRAY = "44454A", MUTE = "8A8D96", BG = "FBFCFD";
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const FONT = "Helvetica Neue";

  // Reusable footer band drawn on every content slide.
  const footer = (s: PptxGenJS.Slide, n: number) => {
    s.addShape(pptx.ShapeType.line, { x: 0.7, y: 6.95, w: 11.93, h: 0, line: { color: "E3E6EB", width: 1 } });
    s.addText("morrisai.family", { x: 0.7, y: 7.0, w: 6, h: 0.35, fontSize: 10, color: MUTE, fontFace: FONT });
    s.addText(String(n), { x: 12.0, y: 7.0, w: 0.6, h: 0.35, fontSize: 10, color: MUTE, align: "right", fontFace: FONT });
  };

  // ── Title slide ──
  const t = pptx.addSlide();
  t.background = { color: NAVY };
  t.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: 7.5, fill: { color: BLUE } });
  t.addText("M", { x: 0.7, y: 1.9, w: 1.0, h: 1.0, fontSize: 44, bold: true, color: "FFFFFF", fontFace: FONT });
  t.addText(title, { x: 0.7, y: 3.0, w: 11.9, h: 1.8, fontSize: 38, bold: true, color: "FFFFFF", fontFace: FONT });
  t.addText(`Generated with Ask Morris · ${dateStr}`, { x: 0.72, y: 4.9, w: 11.9, h: 0.5, fontSize: 15, color: "AEC3DE", fontFace: FONT });

  if (slides.length === 0) {
    const s = pptx.addSlide();
    s.background = { color: BG };
    s.addText(title, { x: 0.7, y: 0.55, w: 11.9, h: 0.8, fontSize: 26, bold: true, color: NAVY, fontFace: FONT });
    s.addText(content.slice(0, 2200), { x: 0.7, y: 1.5, w: 11.9, h: 5.2, fontSize: 14, color: GRAY, fontFace: FONT, valign: "top" });
    footer(s, 1);
  } else {
    slides.forEach((sl, i) => {
      const s = pptx.addSlide();
      s.background = { color: BG };
      s.addText(sl.title || "", { x: 0.7, y: 0.5, w: 11.9, h: 0.75, fontSize: 30, bold: true, color: NAVY, fontFace: FONT });
      s.addShape(pptx.ShapeType.rect, { x: 0.72, y: 1.3, w: 1.9, h: 0.07, fill: { color: BLUE } });
      let bulletsY = 1.75;
      if (sl.subtitle) {
        s.addText(sl.subtitle, { x: 0.72, y: 1.42, w: 11.9, h: 0.45, fontSize: 15, italic: true, color: MUTE, fontFace: FONT });
        bulletsY = 2.15;
      }
      const bullets = (sl.bullets || []).map((b) => ({ text: b, options: { bullet: { code: "2022", indent: 18 }, fontSize: 19, color: GRAY, paraSpaceAfter: 14, lineSpacingMultiple: 1.05 } }));
      if (bullets.length) s.addText(bullets, { x: 0.95, y: bulletsY, w: 11.4, h: 6.7 - bulletsY, fontFace: FONT, valign: "top" });
      footer(s, i + 1);
    });
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return { buffer, cost };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const content = (body.content ?? "").trim();
  const title = (body.title ?? "Morris Export").trim().slice(0, 90) || "Morris Export";
  if (!content) return NextResponse.json({ error: "Nothing to export" }, { status: 400 });

  const name = slug(title);

  try {
    if (body.format === "md") {
      return new Response(`# ${title}\n\n${content}\n`, {
        headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.md"` },
      });
    }
    if (body.format === "docx") {
      const buf = await Packer.toBuffer(buildDocx(content, title));
      return new Response(new Uint8Array(buf), {
        headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${name}.docx"` },
      });
    }
    if (body.format === "pptx") {
      if (!openrouterConfigured()) return NextResponse.json({ error: "PowerPoint needs the OpenRouter key (to structure slides)." }, { status: 503 });
      const { buffer, cost } = await buildPptx(content, title);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "Content-Disposition": `attachment; filename="${name}.pptx"`,
          "X-Generation-Cost": cost != null ? String(cost) : "",
          "Access-Control-Expose-Headers": "X-Generation-Cost",
        },
      });
    }
    return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `Export failed: ${(err as Error).message}` }, { status: 500 });
  }
}
