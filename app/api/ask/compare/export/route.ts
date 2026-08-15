import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openrouterConfigured, askModel, SLIDE_MODEL } from "@/lib/openrouter";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { outlineFromMarkdown, paginate, parseSlideJson, renderDeck, type Slide } from "@/lib/slides";

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

async function buildPptx(content: string, title: string): Promise<{ buffer: Buffer; cost: number | null }> {
  // Ask a model to structure the prose into slides — a nicer narrative than the
  // raw outline when it works, but never load-bearing: the markdown outline
  // takes over if the call fails or comes back unusable.
  let slides: Slide[] = [];
  let cost: number | null = null;
  if (openrouterConfigured()) {
    try {
      const raw = await askModel(SLIDE_MODEL, [
        { role: "system", content: "You are a presentation designer. Turn the content into a clean, well-structured deck. Return ONLY JSON: {\"slides\":[{\"title\":\"Short slide title\",\"subtitle\":\"optional one-line framing\",\"bullets\":[\"concise point\",\"concise point\"]}]}. Rules: 5-9 slides. Open with an agenda/overview slide and CLOSE with a \"Key Takeaways\" slide. 3-5 bullets per slide, each ≤14 words, parallel phrasing, no markdown symbols, no sub-bullets. Titles are punchy (≤6 words)." },
        { role: "user", content: `Deck title: ${title}\n\nSource content:\n${content.slice(0, 9000)}` },
      ], 2600, { json: true });
      cost = raw.cost;
      slides = parseSlideJson(raw.content);
    } catch { slides = []; }
  }

  // One slide back from the model means it summarised instead of structuring —
  // the outline gives a real breakdown rather than a wall of text.
  if (slides.length < 2) {
    const outline = outlineFromMarkdown(content, title);
    if (outline.length > slides.length) slides = outline;
  }
  if (!slides.length) slides = [{ title, bullets: [content] }];

  return { buffer: await renderDeck(title, paginate(slides)), cost };
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
      // No OpenRouter key is needed any more — without one the deck is built
      // from the content's own outline instead of a model's.
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
