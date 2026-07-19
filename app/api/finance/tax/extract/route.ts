import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const client = new Anthropic();

export interface W2Extract {
  employer: string;
  wages: number;              // box 1
  federal_withholding: number; // box 2
  state_withholding: number;   // box 17
  local_withholding: number;   // box 19
}

export interface PriorReturnExtract {
  filing: "mfj" | "single" | null;
  agi: number | null;
  taxable_income: number | null;
  total_tax: number | null;          // total federal tax liability
  total_payments: number | null;     // withholding + est. payments + credits
  wages: number | null;
  itemized_deductions: number | null; // Schedule A total, if itemized (else null)
  qualified_dividends: number | null;
  capital_gains: number | null;
  state_tax: number | null;          // state income tax (from Schedule A / state return)
}

export interface PaystubExtract {
  employer: string;
  pay_frequency: "weekly" | "biweekly" | "semimonthly" | "monthly" | null;
  pay_date: string | null;             // YYYY-MM-DD of this check / period end
  gross_this_period: number | null;
  federal_wh_this_period: number | null;
  state_wh_this_period: number | null;
  ytd_gross: number | null;            // year-to-date gross wages
  ytd_federal_wh: number | null;       // YTD federal income tax withheld
  ytd_state_wh: number | null;         // YTD state income tax withheld
  ytd_pretax_retirement: number | null; // YTD 401k/403b/pre-tax deferrals, if shown
}

export interface TaxDocExtract {
  doc_type: "w2" | "1040" | "paystub" | "unknown";
  w2: W2Extract | null;
  prior_return: PriorReturnExtract | null;
  paystub: PaystubExtract | null;
}

const SYSTEM = `You are a US tax document parser. You read W-2 wage statements, Form 1040 individual tax returns, and payroll paystubs / earnings statements.
Return ONLY valid JSON — no prose, no markdown, no code fences.`;

const PROMPT = `Identify whether this document is a W-2, a Form 1040 (individual income tax return), a payroll paystub / earnings statement, or none, then extract the figures.

Return JSON in exactly this shape:
{
  "doc_type": "w2" | "1040" | "paystub" | "unknown",
  "w2": {
    "employer": "string — employer name (box c)",
    "wages": number — box 1 (wages, tips, other comp),
    "federal_withholding": number — box 2 (federal income tax withheld),
    "state_withholding": number — box 17 (state income tax); 0 if absent,
    "local_withholding": number — box 19 (local income tax); 0 if absent
  } or null,
  "prior_return": {
    "filing": "mfj" | "single" | null — married-filing-jointly => "mfj", single/HoH => "single",
    "agi": number or null — adjusted gross income (1040 line 11),
    "taxable_income": number or null — 1040 line 15,
    "total_tax": number or null — total tax (1040 line 24),
    "total_payments": number or null — total payments (1040 line 33),
    "wages": number or null — 1040 line 1a,
    "itemized_deductions": number or null — Schedule A total if itemized, else null,
    "qualified_dividends": number or null — 1040 line 3a,
    "capital_gains": number or null — 1040 line 7,
    "state_tax": number or null — state income tax paid, if visible
  } or null,
  "paystub": {
    "employer": "string — employer name",
    "pay_frequency": "weekly" | "biweekly" | "semimonthly" | "monthly" | null — infer from pay period dates if not stated,
    "pay_date": "YYYY-MM-DD or null — this check's pay date or period-end date",
    "gross_this_period": number or null — gross earnings for THIS pay period,
    "federal_wh_this_period": number or null — federal income tax withheld this period,
    "state_wh_this_period": number or null — state income tax withheld this period,
    "ytd_gross": number or null — year-to-date gross wages,
    "ytd_federal_wh": number or null — YTD federal income tax withheld,
    "ytd_state_wh": number or null — YTD state income tax withheld,
    "ytd_pretax_retirement": number or null — YTD 401(k)/403(b)/pre-tax deferrals if shown
  } or null
}

Rules:
- Populate ONLY the object matching doc_type; set the others to null.
- All dollar amounts are plain numbers (no $ or commas).
- For a paystub, prioritize the YEAR-TO-DATE (YTD) column values.
- If a field is not present on the document, use 0 for W-2 withholding boxes and null for 1040 / paystub line items.
- If the document is none of these, return { "doc_type": "unknown", "w2": null, "prior_return": null, "paystub": null }.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let base64: string;
  let mediaType: string;
  let isPdf = false;

  try {
    const formData = await req.formData();
    const file = (formData.get("file") ?? formData.get("image")) as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported file type. Please upload a PDF or a JPEG/PNG/WebP image." }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 12 MB)." }, { status: 400 });
    }
    isPdf = file.type === "application/pdf";
    mediaType = file.type;

    const bytes = await file.arrayBuffer();
    base64 = Buffer.from(bytes).toString("base64");
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 400 });
  }

  try {
    const mediaBlock = isPdf
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } }
      : {
          type: "image" as const,
          source: { type: "base64" as const, media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 },
        };

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: [mediaBlock, { type: "text", text: PROMPT }] }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const result: TaxDocExtract = JSON.parse(cleaned);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
  }
}
