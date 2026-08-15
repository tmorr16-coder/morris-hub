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
  const paras: Paragraph[] = [new Paragraph({ text: title, heading: HeadingLevel.TITLE })];
  for (const raw of content.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { paras.push(new Paragraph({ text: "" })); continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length === 1 ? HeadingLevel.HEADING_1 : h[1].length === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      paras.push(new Paragraph({ children: runs(h[2]), heading: lvl }));
      continue;
    }
    const b = line.match(/^\s*[-*•]\s+(.*)$/);
    if (b) { paras.push(new Paragraph({ children: runs(b[1]), bullet: { level: 0 } })); continue; }
    paras.push(new Paragraph({ children: runs(line) }));
  }
  return new Document({ sections: [{ children: paras }] });
}

interface Slide { title: string; bullets: string[] }

async function buildPptx(content: string, title: string): Promise<{ buffer: Buffer; cost: number | null }> {
  // Ask a model to structure the prose into slides.
  let slides: Slide[] = [];
  let cost: number | null = null;
  try {
    const raw = await askModel(SLIDE_MODEL, [
      { role: "system", content: "You turn content into a concise slide deck. Return ONLY JSON: {\"slides\":[{\"title\":\"...\",\"bullets\":[\"...\",\"...\"]}]}. 4-8 slides, 3-5 short bullets each, no markdown symbols in the text." },
      { role: "user", content: `Title: ${title}\n\nContent:\n${content.slice(0, 8000)}` },
    ], 1500);
    cost = raw.cost;
    const cleaned = raw.content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    slides = Array.isArray(parsed.slides) ? parsed.slides : [];
  } catch { slides = []; }

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";
  const NAVY = "1C2B45", BLUE = "356FB0", GRAY = "3C3C43";

  // Title slide
  const t = pptx.addSlide();
  t.background = { color: "F7F8FA" };
  t.addText(title, { x: 0.7, y: 2.6, w: 11.9, h: 1.6, fontSize: 40, bold: true, color: NAVY, fontFace: "Arial" });
  t.addText("morrisai.family", { x: 0.7, y: 4.2, w: 11.9, h: 0.5, fontSize: 16, color: BLUE, fontFace: "Arial" });

  if (slides.length === 0) {
    // Fallback: dump content onto a slide if structuring failed.
    const s = pptx.addSlide();
    s.addText(title, { x: 0.7, y: 0.5, w: 11.9, h: 0.8, fontSize: 26, bold: true, color: NAVY });
    s.addText(content.slice(0, 2000), { x: 0.7, y: 1.5, w: 11.9, h: 5.4, fontSize: 14, color: GRAY });
  } else {
    for (const sl of slides) {
      const s = pptx.addSlide();
      s.addText(sl.title || "", { x: 0.7, y: 0.5, w: 11.9, h: 0.9, fontSize: 28, bold: true, color: NAVY, fontFace: "Arial" });
      s.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.45, w: 2.2, h: 0.06, fill: { color: BLUE } });
      const bullets = (sl.bullets || []).map((b) => ({ text: b, options: { bullet: true, fontSize: 18, color: GRAY, paraSpaceAfter: 10 } }));
      if (bullets.length) s.addText(bullets, { x: 0.9, y: 1.9, w: 11.5, h: 5.0, fontFace: "Arial", valign: "top" });
    }
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
