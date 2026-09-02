import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODEL_BALANCED } from "@/lib/models";
import { findBiomarker, parseReferenceText } from "@/lib/health/biomarkers";

export const runtime = "nodejs";
// Dense lab reports run 10+ pages; give the vision pass room to finish.
export const maxDuration = 120;

const client = new Anthropic();

export interface ExtractedResult {
  name: string;
  panel: string | null;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  flag: string | null;
  note: string | null;
  /** Filled in server-side from the catalog, not by the model. */
  biomarker_key?: string | null;
}

export interface ExtractedBodyComposition {
  device: string | null;
  weight_lbs: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  body_fat_mass_lbs: number | null;
  lean_body_mass_lbs: number | null;
  skeletal_muscle_lbs: number | null;
  dry_lean_mass_lbs: number | null;
  total_body_water_lbs: number | null;
  intracellular_water_lbs: number | null;
  extracellular_water_lbs: number | null;
  ecw_tbw: number | null;
  visceral_fat_area: number | null;
  bmr_kcal: number | null;
  smi: number | null;
  tbw_lbm_pct: number | null;
  leg_lean_mass_lbs: number | null;
  phase_angle: number | null;
  segmental_lean: Record<string, number> | null;
  segmental_fat: Record<string, number> | null;
  fat_mass_control_lbs: number | null;
  lean_mass_control_lbs: number | null;
}

export interface ExtractedVitals {
  systolic: number | null;
  diastolic: number | null;
  pulse_bpm: number | null;
  temperature_f: number | null;
  spo2_pct: number | null;
  respiratory_rate: number | null;
  weight_lbs: number | null;
  height_in: number | null;
  waist_in: number | null;
}

export interface RecordExtract {
  record_type: "lab_panel" | "body_composition" | "vitals" | "other";
  title: string;
  source: string | null;
  performed_on: string | null;
  reported_on: string | null;
  provider: string | null;
  facility: string | null;
  accession: string | null;
  summary: string | null;
  results: ExtractedResult[];
  body_composition: ExtractedBodyComposition | null;
  vitals: ExtractedVitals | null;
}

const SYSTEM = `You are a careful medical-records parser. You read laboratory reports (Quest, LabCorp, hospital panels), body-composition scans (InBody, DEXA), and clinical vitals sheets, and transcribe every measurement exactly as printed.

You transcribe. You never diagnose, never advise, and never invent a value that is not on the page.

Return ONLY valid JSON — no prose, no markdown, no code fences.`;

const PROMPT = `Read this health record and transcribe every measurement on it.

Return JSON in exactly this shape:
{
  "record_type": "lab_panel" | "body_composition" | "vitals" | "other",
  "title": "short title for this record, e.g. 'Quest Lab Panel' or 'InBody 770 Scan'",
  "source": "lab or device that produced it, e.g. 'Quest Diagnostics', 'InBody 770'; null if absent",
  "performed_on": "YYYY-MM-DD — the date the sample was DRAWN or the scan was TAKEN; null if absent",
  "reported_on": "YYYY-MM-DD — the date results were reported/finalized; null if absent",
  "provider": "ordering physician name as printed; null if absent",
  "facility": "performing lab / clinic / location; null if absent",
  "accession": "accession or order number; null if absent",
  "summary": "one or two neutral sentences naming which panels are present and which results the report itself flagged as out of range. Describe only what is printed. No interpretation or advice.",
  "results": [
    {
      "name": "test name exactly as printed, e.g. 'ALKALINE PHOSPHATASE'",
      "panel": "the panel heading this test appeared under, e.g. 'CBC (INCLUDES DIFF/PLT)'; null if none",
      "value": number or null — the numeric result; null when the result is text-only,
      "value_text": "the result verbatim when it is not a plain number ('SEE NOTE', 'NEGATIVE', '<5'); otherwise null",
      "unit": "unit as printed ('mg/dL', 'Thousand/uL'); null if absent",
      "ref_low": number or null — lower bound of the reference range, if it is a numeric interval,
      "ref_high": number or null — upper bound; for '<200' set ref_high 200 and ref_low null; for '> OR = 60' set ref_low 60 and ref_high null,
      "ref_text": "the reference range exactly as printed ('65-99 mg/dL', '> OR = 40 mg/dL'); null if absent",
      "flag": "H" | "L" | "A" | "C" | null — the abnormal flag the LAB printed next to the value; null when the lab printed none,
      "note": "a short interpretive comment printed with this specific result; null if none"
    }
  ],
  "body_composition": {
    "device": "e.g. 'InBody 770'; null if absent",
    "weight_lbs": number or null,
    "bmi": number or null,
    "body_fat_pct": number or null,
    "body_fat_mass_lbs": number or null,
    "lean_body_mass_lbs": number or null,
    "skeletal_muscle_lbs": number or null,
    "dry_lean_mass_lbs": number or null,
    "total_body_water_lbs": number or null,
    "intracellular_water_lbs": number or null,
    "extracellular_water_lbs": number or null,
    "ecw_tbw": number or null,
    "visceral_fat_area": number or null,
    "bmr_kcal": number or null,
    "smi": number or null,
    "tbw_lbm_pct": number or null,
    "leg_lean_mass_lbs": number or null,
    "phase_angle": number or null,
    "segmental_lean": { "right_arm": number, "left_arm": number, "trunk": number, "right_leg": number, "left_leg": number } or null,
    "segmental_fat": { "right_arm": number, "left_arm": number, "trunk": number, "right_leg": number, "left_leg": number } or null,
    "fat_mass_control_lbs": number or null,
    "lean_mass_control_lbs": number or null
  } or null,
  "vitals": {
    "systolic": number or null, "diastolic": number or null, "pulse_bpm": number or null,
    "temperature_f": number or null, "spo2_pct": number or null, "respiratory_rate": number or null,
    "weight_lbs": number or null, "height_in": number or null, "waist_in": number or null
  } or null
}

Rules:
- Transcribe EVERY numeric test result on EVERY page. A multi-panel lab report may carry 60+ results — do not stop early, do not summarize, do not skip a panel because it looks routine.
- Copy values exactly. Never round, never convert units, never compute a value that is not printed.
- "flag" is only for an abnormality marker the lab itself printed (an H or L beside the value). If the lab printed nothing, use null — do not derive a flag by comparing the value to the range yourself.
- Reference-range text that is prose ("Fasting reference interval") goes in ref_text with ref_low/ref_high null.
- Ignore page furniture: patient demographics, footers, references, methodology paragraphs, and QR codes are not results.
- A body-composition sheet still uses "results" for nothing — put its numbers in body_composition and leave "results" as [].
- Set body_composition and vitals to null when the record is not of that type.
- Dates are ISO YYYY-MM-DD. A date printed 07-13-2026 (US month-day-year) is "2026-07-13".`;

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// The composer converts photos to JPEG and caps the long edge at 1568px before
// sending, so anything arriving here is already small. This is the backstop for
// a client that skipped that — and it is 4MB, not 20MB, because Vercel drops a
// request body over 4.5MB before this handler runs. Promising 20MB meant a
// large photo failed with no response and no error at all.
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let base64: string;
  let mediaType: string;
  let isPdf: boolean;
  let fileName: string;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `That file is a ${file.type || "unknown type"}. Upload a PDF, or take a photo — iPhone HEIC photos are converted automatically when picked here.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "That image is too large to send. Retake it, or pick it through the app so it can be resized first." }, { status: 400 });
    }

    isPdf = file.type === "application/pdf";
    mediaType = file.type;
    fileName = file.name;
    base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 400 });
  }

  try {
    // Scanned lab PDFs carry no text layer, so the document block (which is
    // read visually) is what makes this work at all — pdf-parse returns
    // nothing for them.
    const mediaBlock = isPdf
      ? {
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: base64,
          },
        };

    const response = await client.messages.create({
      model: MODEL_BALANCED,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content: [mediaBlock, { type: "text", text: PROMPT }] }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: RecordExtract;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Could not read this document. Try a clearer scan, or enter the results manually." },
        { status: 422 }
      );
    }

    return NextResponse.json(normalize(parsed, fileName));
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }
    console.error("[health/records/extract] ", err);
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
  }
}

/**
 * Tidy the model's output before it reaches the review screen: map each
 * result onto a catalog biomarker, backfill numeric bounds the model left
 * null but printed in ref_text, and drop rows that carry no measurement.
 *
 * Biomarker mapping is done here rather than in the prompt so the catalog
 * stays the single source of truth for what an analyte is called.
 */
function normalize(extract: RecordExtract, fileName: string): RecordExtract {
  const results = (extract.results ?? [])
    .filter((r) => r && typeof r.name === "string" && r.name.trim().length > 0)
    .filter((r) => r.value != null || (r.value_text ?? "").trim().length > 0)
    .map((r) => {
      const marker = findBiomarker(r.name);
      const fromText = parseReferenceText(r.ref_text);
      return {
        ...r,
        name: r.name.trim(),
        biomarker_key: marker?.key ?? null,
        unit: r.unit?.trim() || marker?.unit || null,
        ref_low: r.ref_low ?? fromText.low ?? null,
        ref_high: r.ref_high ?? fromText.high ?? null,
        flag: r.flag?.trim().toUpperCase() || null,
      };
    });

  const hasBodyComp =
    extract.body_composition != null &&
    Object.values(extract.body_composition).some((v) => v != null);
  const hasVitals =
    extract.vitals != null && Object.values(extract.vitals).some((v) => v != null);

  return {
    ...extract,
    title: extract.title?.trim() || fileName.replace(/\.[^.]+$/, ""),
    record_type:
      extract.record_type ??
      (hasBodyComp ? "body_composition" : results.length > 0 ? "lab_panel" : "other"),
    results,
    body_composition: hasBodyComp ? extract.body_composition : null,
    vitals: hasVitals ? extract.vitals : null,
  };
}
