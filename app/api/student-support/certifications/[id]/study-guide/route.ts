import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface KeyTerm {
  term: string;
  definition: string;
  exam_tip: string | null;
}

export interface StudySection {
  id: string;             // domain_id or "general-N"
  domain_name: string;
  title: string;
  estimated_minutes: number;
  paragraphs: string[];
  key_terms: KeyTerm[];
  takeaways: string[];
  self_test: { question: string; answer: string };
}

// ── GET: load saved sections ──────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createServiceClient() as any;

  // Verify ownership
  const { data: exam } = await db.schema("student_support").from("cert_exams")
    .select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!exam) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: rows } = await db.schema("student_support")
    .from("cert_study_guide_sections")
    .select("*")
    .eq("exam_id", id)
    .order("created_at", { ascending: true });

  const sections: StudySection[] = (rows ?? []).map((r: any) => ({
    id: r.domain_id ?? r.id,
    domain_name: r.domain_name,
    title: r.title,
    estimated_minutes: r.estimated_minutes,
    paragraphs: r.paragraphs ?? [],
    key_terms: r.key_terms ?? [],
    takeaways: r.takeaways ?? [],
    self_test: r.self_test ?? { question: "", answer: "" },
  }));

  return NextResponse.json({ sections });
}

// ── POST: generate and save ───────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createServiceClient() as any;

  const { data: exam } = await db.schema("student_support").from("cert_exams")
    .select("name, vendor, exam_code, description")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!exam) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { domainIds } = body as { domainIds?: string[] };

  let domainsQuery = db.schema("student_support").from("cert_domains")
    .select("id, name, description, weight_pct").eq("exam_id", id).order("sort_order");
  if (domainIds?.length) domainsQuery = domainsQuery.in("id", domainIds);
  const { data: domains } = await domainsQuery;

  const { data: materials } = await db.schema("student_support").from("cert_materials")
    .select("title, extracted_text").eq("exam_id", id);

  const materialContext = (materials ?? [])
    .filter((m: any) => m.extracted_text)
    .map((m: any) => `[${m.title}]\n${m.extracted_text}`)
    .join("\n\n")
    .slice(0, 10000) || "No uploaded materials — generate from general knowledge of the exam.";

  const domainList = ((domains ?? []) as any[]);
  const targetDomains = domainList.length > 0
    ? domainList
    : [{ id: "general", name: "Core Concepts", description: exam.description, weight_pct: 100 }];

  const sections: StudySection[] = [];

  for (const domain of targetDomains) {
    const prompt = `You are writing a certification study guide section for:

Exam: ${exam.name}${exam.exam_code ? ` (${exam.exam_code})` : ""}
Domain: ${domain.name}${domain.weight_pct ? ` — ${domain.weight_pct}% of the exam` : ""}
${domain.description ? `Domain description: ${domain.description}` : ""}

Reference material:
${materialContext}

Generate a complete, educational study section for this domain. Return ONLY valid JSON:
{
  "title": "Engaging section title for this domain",
  "estimated_minutes": number (realistic reading time 5-15),
  "paragraphs": [
    "First paragraph — overview and why this domain matters",
    "Second paragraph — core concepts explained clearly",
    "Third paragraph — practical application and real-world context",
    "Fourth paragraph — common exam patterns and what to watch for"
  ],
  "key_terms": [
    {
      "term": "Term name",
      "definition": "Clear, concise definition",
      "exam_tip": "What the exam typically tests about this term, or null"
    }
  ],
  "takeaways": [
    "Concise bullet point 1",
    "Concise bullet point 2",
    "Concise bullet point 3",
    "Concise bullet point 4",
    "Concise bullet point 5"
  ],
  "self_test": {
    "question": "A scenario-based question testing understanding of this domain",
    "answer": "The correct answer with a 2-sentence explanation"
  }
}

Requirements:
- 4 paragraphs minimum (100-180 words each)
- 6-10 key terms
- 5-7 takeaways
- Self-test must be a real exam-style question
- Write for someone preparing for certification — precise, practical, memorable`;

    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 3000,
        system: "You are a certification exam instructor. Return only valid JSON. No markdown fences.",
        messages: [{ role: "user", content: prompt }],
      });

      const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
      let jsonStr = raw;
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) jsonStr = fence[1].trim();
      if (!jsonStr.startsWith("{")) {
        const obj = jsonStr.match(/\{[\s\S]*\}/);
        if (obj) jsonStr = obj[0];
      }

      const parsed = JSON.parse(jsonStr);
      sections.push({
        id: domain.id,
        domain_name: domain.name,
        title: parsed.title ?? domain.name,
        estimated_minutes: parsed.estimated_minutes ?? 8,
        paragraphs: Array.isArray(parsed.paragraphs) ? parsed.paragraphs : [],
        key_terms: Array.isArray(parsed.key_terms) ? parsed.key_terms : [],
        takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways : [],
        self_test: parsed.self_test ?? { question: "", answer: "" },
      });
    } catch (err) {
      console.error(`[study-guide] Failed for domain ${domain.name}:`, err);
    }
  }

  if (sections.length === 0) {
    return NextResponse.json({ error: "Failed to generate study guide" }, { status: 500 });
  }

  // Upsert generated sections to DB — delete existing for these domains then insert fresh
  const domainNames = sections.map((s) => s.domain_name);
  await db.schema("student_support").from("cert_study_guide_sections")
    .delete().eq("exam_id", id).in("domain_name", domainNames);

  const rows = sections.map((s) => ({
    exam_id: id,
    domain_id: s.id === "general" ? null : s.id,
    domain_name: s.domain_name,
    title: s.title,
    estimated_minutes: s.estimated_minutes,
    paragraphs: s.paragraphs,
    key_terms: s.key_terms,
    takeaways: s.takeaways,
    self_test: s.self_test,
  }));

  const { error: saveErr } = await db.schema("student_support")
    .from("cert_study_guide_sections").insert(rows);
  if (saveErr) console.error("[study-guide] save error:", saveErr.message);

  return NextResponse.json({ sections });
}
