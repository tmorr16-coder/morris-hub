import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser, createServiceClient } from "@/lib/supabase/server";
import { extractAttachmentText, classifyAttachment } from "@/lib/file-extraction";
import { MODEL_BALANCED } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic();
const MAX_FILE_SIZE = 10 * 1024 * 1024;
/** Lab reports run long — 11 pages is ordinary — so this ceiling is generous. */
const EXTRACT_LIMIT = 60_000;

/**
 * Turn a lab PDF into structured results.
 *
 * Deterministic parsing is not on the table: every lab lays its reports out
 * differently, mixes numeric and qualitative results, prints reference ranges
 * in half a dozen formats, and pads the whole thing with interpretation notes.
 * A model reads it reliably where a regex would not.
 *
 * What gets stored is only the analytes. The MRN, date of birth, accession
 * number and ordering physician are all in the file and none are needed to
 * reason about a trend, so they are not written anywhere — nor is the PDF kept.
 */

const EXTRACTION_PROMPT = `Extract every lab result from this report as JSON. Return ONLY the JSON object, no prose.

{
  "collected_on": "YYYY-MM-DD",        // the specimen COLLECTION/DRAWN date, not the report or received date
  "panel_name": "string",              // e.g. "Comprehensive Metabolic Panel"
  "lab_name": "string or null",
  "results": [
    {
      "analyte": "string",             // exactly as printed, e.g. "ALT", "FIB-4 Index"
      "value_num": number or null,     // null if the result is not numeric
      "value_text": "string or null",  // verbatim when not numeric, e.g. "Negative", "<1.30"
      "unit": "string or null",
      "ref_low": number or null,
      "ref_high": number or null,
      "ref_text": "string or null",    // the range as printed when it is not a simple low-high
      "flag": "normal" | "low" | "high" | "abnormal" | "unknown"
    }
  ]
}

Rules:
- Include every analyte with a result. Skip narrative sections, references and disclaimers.
- Do not invent a reference range that is not printed. Use null.
- Use the report's own abnormal flag where it prints one. Where it prints only a range and a value, derive the flag. Otherwise "unknown".
- Do not include patient identifiers — no name, MRN, date of birth, physician or accession number — anywhere in the output.
- If the collection date is genuinely absent, use null and it will be asked for.`;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "The lab importer needs an ANTHROPIC_API_KEY." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `${file.name} is over ${MAX_FILE_SIZE / 1024 / 1024}MB.` }, { status: 413 });
  }

  const kind = classifyAttachment(file.name, file.type);
  if (kind !== "pdf" && kind !== "text" && kind !== "docx") {
    return NextResponse.json({ error: "Upload the lab report as a PDF." }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    const extracted = await extractAttachmentText(buffer, file.name, file.type, EXTRACT_LIMIT);
    text = extracted.text;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }

  if (!text.trim()) {
    return NextResponse.json(
      { error: "No text could be read from that PDF. If it is a scan, the results can't be extracted yet." },
      { status: 422 }
    );
  }

  // Parse, then return for review — nothing is written until the person has
  // seen what was read out. A misread decimal in a lab value is not something
  // to discover later from a chart.
  try {
    const msg = await anthropic.messages.create({
      model: MODEL_BALANCED,
      max_tokens: 8000,
      system: EXTRACTION_PROMPT,
      messages: [{ role: "user", content: text }],
    });

    const raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("The extractor did not return JSON.");
    const parsed = JSON.parse(raw.slice(start, end + 1));

    const results = Array.isArray(parsed.results) ? parsed.results : [];
    if (results.length === 0) {
      return NextResponse.json({ error: "No lab results were found in that file." }, { status: 422 });
    }

    return NextResponse.json({
      draft: {
        collected_on: parsed.collected_on ?? null,
        panel_name: parsed.panel_name ?? file.name.replace(/\.[^.]+$/, ""),
        lab_name: parsed.lab_name ?? null,
        results: results.slice(0, 200),
      },
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "Could not read that report.";
    return NextResponse.json({ error: m }, { status: 422 });
  }
}

/** Save a reviewed draft. Separate from extraction so nothing is stored unseen. */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    collected_on?: string;
    panel_name?: string;
    lab_name?: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results?: any[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const collectedOn = (body.collected_on ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(collectedOn)) {
    return NextResponse.json({ error: "A collection date is required." }, { status: 400 });
  }
  const results = Array.isArray(body.results) ? body.results.slice(0, 200) : [];
  if (!results.length) return NextResponse.json({ error: "No results to save." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: panel, error: panelErr } = await db
    .from("lab_panels")
    .insert({
      user_id: user.id,
      collected_on: collectedOn,
      panel_name: (body.panel_name ?? "Lab panel").slice(0, 200),
      lab_name: body.lab_name ? String(body.lab_name).slice(0, 200) : null,
    })
    .select("id")
    .single();
  if (panelErr || !panel) return NextResponse.json({ error: panelErr?.message ?? "Could not save the panel." }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = results.map((r: any) => {
    const valueNum = typeof r.value_num === "number" && Number.isFinite(r.value_num) ? r.value_num : null;
    const refLow = typeof r.ref_low === "number" ? r.ref_low : null;
    const refHigh = typeof r.ref_high === "number" ? r.ref_high : null;
    // Derive the flag where we can rather than trusting the extractor: it is
    // arithmetic, and a wrong flag on a lab value is worth more than the
    // convenience of taking the model's word for it.
    let flag: string = typeof r.flag === "string" ? r.flag : "unknown";
    if (valueNum != null && (refLow != null || refHigh != null)) {
      if (refLow != null && valueNum < refLow) flag = "low";
      else if (refHigh != null && valueNum > refHigh) flag = "high";
      else flag = "normal";
    }
    return {
      panel_id: panel.id,
      user_id: user.id,
      analyte: String(r.analyte ?? "").slice(0, 200),
      value_num: valueNum,
      value_text: r.value_text ? String(r.value_text).slice(0, 200) : null,
      unit: r.unit ? String(r.unit).slice(0, 50) : null,
      ref_low: refLow,
      ref_high: refHigh,
      ref_text: r.ref_text ? String(r.ref_text).slice(0, 200) : null,
      flag,
    };
  }).filter((r: { analyte: string }) => r.analyte);

  const { error: rowsErr } = await db.from("lab_results").insert(rows);
  if (rowsErr) {
    await db.from("lab_panels").delete().eq("id", panel.id); // don't leave an empty panel behind
    return NextResponse.json({ error: rowsErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, panel_id: panel.id, saved: rows.length });
}
