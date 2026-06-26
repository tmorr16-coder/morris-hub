import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface RecommendedSource {
  title: string;
  url: string;
  type: "official" | "practice" | "video" | "community" | "book";
  description: string;
  free: boolean;
  rating: number;        // 1-5 overall quality/relevance for this exam
  fits_testing: boolean; // true if this source can be used to generate practice questions
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createServiceClient() as any;
  const { data: exam } = await db.schema("student_support").from("cert_exams")
    .select("name, vendor, exam_code, description")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!exam) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prompt = `You are a certification exam expert. Recommend the best credible study resources for the following certification:

Exam: ${exam.name}
Vendor: ${exam.vendor ?? "Unknown"}
Exam Code: ${exam.exam_code ?? "Unknown"}
${exam.description ? `Description: ${exam.description}` : ""}

Return a JSON array of exactly 8 recommended sources. Mix official docs, free practice tests, video courses, and community resources.

Rules:
- Only recommend real, well-known websites (Microsoft Learn, Anthropic docs, YouTube, Coursera, etc.)
- For official vendor docs, use the real base URL (e.g. learn.microsoft.com for Microsoft, docs.anthropic.com for Anthropic)
- Mark free resources accurately
- Prioritize official sources first, then high-quality free alternatives

Return ONLY valid JSON in this exact shape:
[
  {
    "title": "string",
    "url": "string — real base URL, no made-up paths",
    "type": "official" | "practice" | "video" | "community" | "book",
    "description": "1-2 sentence description of what this resource covers",
    "free": boolean,
    "rating": number from 1-5 (5 = essential/authoritative for this exact exam, 1 = loosely related),
    "fits_testing": boolean (true if the resource contains enough structured content to generate practice questions from — e.g. official docs, study guides, whitepapers yes; video courses, forums no)
  }
]`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      system: "You are a certification exam expert. Return only valid JSON arrays. No markdown, no code fences, just the raw JSON array.",
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";

    // Strip markdown code fences if Claude wraps output despite instructions
    let jsonStr = raw;
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    // Also try to extract first JSON array if there's leading text
    if (!jsonStr.startsWith("[")) {
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) jsonStr = arrayMatch[0];
    }

    const sources: RecommendedSource[] = JSON.parse(jsonStr);
    return NextResponse.json({ sources });
  } catch (err) {
    console.error("[recommended-sources]", err);
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}
