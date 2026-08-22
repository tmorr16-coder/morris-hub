import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODEL_FAST } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 30;

const client = new Anthropic();

export interface PensionOption {
  name: string;
  monthly_amount: number;
  survivor_pct: number | null;
  notes: string | null;
}

export interface PensionExtractResult {
  pension_name: string;
  options: PensionOption[];
}

const SYSTEM = `You are a financial document parser specializing in pension benefit statements.
Extract pension payment options from the provided image.
Return ONLY valid JSON — no prose, no markdown, no code fences.`;

const PROMPT = `Extract all pension payment options from this statement image.

Return JSON in exactly this shape:
{
  "pension_name": "string — the name of the pension plan",
  "options": [
    {
      "name": "string — e.g. Single Life Annuity, 50% Joint & Survivor, 100% Joint & Survivor",
      "monthly_amount": number — monthly dollar amount,
      "survivor_pct": number or null — survivor percentage (0 for single life, 50, 75, 100, etc.),
      "notes": "string or null — any relevant notes, start date, COLA info, etc."
    }
  ]
}

Common option names to look for:
- Single Life Annuity (no survivor benefit, highest payment)
- 50% Joint and Survivor (survivor receives 50% of your benefit)
- 75% Joint and Survivor
- 100% Joint and Survivor (survivor receives 100%, lowest payment)
- Period Certain options (e.g. "10-Year Certain and Continuous")

If amounts are shown annually, convert to monthly (divide by 12).
If the image is unclear or not a pension statement, return { "pension_name": "", "options": [] }.`;

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
      model: MODEL_FAST,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [mediaBlock, { type: "text", text: PROMPT }],
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const result: PensionExtractResult = JSON.parse(raw);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }
}
