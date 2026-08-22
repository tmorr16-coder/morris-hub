import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL_FAST } from "@/lib/models";

const anthropic = new Anthropic();

// POST: AI-powered question + flashcard generation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { domainId, count = 10, type } = body;

  if (!type || !["questions", "flashcards"].includes(type)) {
    return NextResponse.json(
      { error: "type must be 'questions' or 'flashcards'" },
      { status: 400 }
    );
  }

  const questionCount = Math.min(Math.max(Number(count), 1), 30);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Verify exam ownership
  const { data: exam } = await db
    .schema("student_support")
    .from("cert_exams")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!exam) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch domains
  let domainsQuery = db
    .schema("student_support")
    .from("cert_domains")
    .select("*")
    .eq("exam_id", id);

  if (domainId) {
    domainsQuery = domainsQuery.eq("id", domainId);
  }

  const { data: domains } = await domainsQuery.order("created_at", { ascending: true });

  // Fetch materials
  const { data: materials } = await db
    .schema("student_support")
    .from("cert_materials")
    .select("title, type, extracted_text")
    .eq("exam_id", id)
    .order("created_at", { ascending: true });

  // Build context string from materials, truncated to 12000 chars
  const rawContext = (materials ?? [])
    .filter((m: { extracted_text: string | null }) => m.extracted_text)
    .map((m: { title: string; type: string; extracted_text: string }) =>
      `[${m.type.toUpperCase()}] ${m.title}\n${m.extracted_text}`
    )
    .join("\n\n");

  const materialContext = rawContext.length > 12000
    ? rawContext.slice(0, 12000) + "\n[...truncated]"
    : rawContext || "No study materials uploaded yet.";

  const domainList = (domains ?? [])
    .map((d: { name: string; weight_pct: number | null }) =>
      `- ${d.name}${d.weight_pct ? ` (${d.weight_pct}%)` : ""}`
    )
    .join("\n");

  // ── Questions generation ──────────────────────────────────────────────────

  if (type === "questions") {
    const systemPrompt = `You are a certification exam question writer. Generate realistic, scenario-based multiple choice questions for the ${exam.name}${exam.exam_code ? ` (${exam.exam_code})` : ""} certification exam.`;

    const userPrompt = `Generate ${questionCount} multiple-choice questions (4 answer choices: A, B, C, D) for the ${exam.name} exam.

${domainList ? `## Exam Domains\n${domainList}\n` : ""}
## Study Material Context
${materialContext}

## Instructions
- Each question must have exactly 4 choices labeled A, B, C, D
- Exactly one choice must be correct (is_correct: true)
- Include a brief explanation of why the correct answer is right
- Assign a difficulty: "easy", "medium", or "hard"
- Assign a domain_name matching one of the domains above (or "General" if no domains defined)
- Questions should be scenario-based and test practical understanding

Respond with ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "stem": "Question text here?",
      "explanation": "Why the correct answer is right.",
      "difficulty": "medium",
      "domain_name": "Domain Name",
      "choices": [
        { "label": "A", "body": "Choice text", "is_correct": false },
        { "label": "B", "body": "Choice text", "is_correct": true },
        { "label": "C", "body": "Choice text", "is_correct": false },
        { "label": "D", "body": "Choice text", "is_correct": false }
      ]
    }
  ]
}`;

    let generated: Array<{
      stem: string;
      explanation: string;
      difficulty: string;
      domain_name: string;
      choices: Array<{ label: string; body: string; is_correct: boolean }>;
    }> = [];

    try {
      const response = await anthropic.messages.create({
        model: MODEL_FAST,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text = response.content.find((b) => b.type === "text")?.text ?? "";
      const jsonMatch = text.match(/\{[\s\S]*"questions"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        generated = Array.isArray(parsed.questions) ? parsed.questions : [];
      }
    } catch (err) {
      console.error("[certifications/generate] Claude error:", err);
      return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
    }

    if (generated.length === 0) {
      return NextResponse.json({ error: "No questions were generated" }, { status: 500 });
    }

    // Build a domain name → id lookup
    const domainMap = new Map<string, string>();
    for (const d of (domains ?? []) as Array<{ id: string; name: string }>) {
      domainMap.set(d.name.toLowerCase(), d.id);
    }

    const questionIds: string[] = [];

    for (const q of generated) {
      const domainIdResolved =
        domainMap.get(q.domain_name.toLowerCase()) ??
        (domains && domains.length > 0 ? domains[0].id : null);

      const { data: insertedQ, error: qErr } = await db
        .schema("student_support")
        .from("cert_questions")
        .insert({
          exam_id: id,
          domain_id: domainIdResolved ?? null,
          stem: q.stem,
          explanation: q.explanation ?? null,
          difficulty: ({ easy: 2, medium: 3, hard: 4 } as Record<string, number>)[q.difficulty] ?? 3,
        })
        .select("id")
        .single();

      if (qErr) {
        console.error("[certifications/generate] question insert error:", qErr.message);
        continue;
      }

      questionIds.push(insertedQ.id);

      const choiceRows = q.choices.map((c) => ({
        question_id: insertedQ.id,
        label: c.label,
        body: c.body,
        is_correct: c.is_correct,
      }));

      await db
        .schema("student_support")
        .from("cert_choices")
        .insert(choiceRows);
    }

    return NextResponse.json({ generated: questionIds.length, questionIds }, { status: 201 });
  }

  // ── Flashcards generation ─────────────────────────────────────────────────

  const flashcardPrompt = `Generate ${questionCount} flashcards for the ${exam.name}${exam.exam_code ? ` (${exam.exam_code})` : ""} certification exam.

${domainList ? `## Exam Domains\n${domainList}\n` : ""}
## Study Material Context
${materialContext}

## Instructions
- Each flashcard has a question (front) and answer (back)
- Assign a domain_name matching one of the domains above (or "General")
- Focus on key concepts, definitions, and practical knowledge

Respond with ONLY valid JSON:
{
  "cards": [
    {
      "question": "What does X mean?",
      "answer": "X means ...",
      "domain_name": "Domain Name"
    }
  ]
}`;

  let cards: Array<{ question: string; answer: string; domain_name: string }> = [];

  try {
    const response = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 4096,
      messages: [{ role: "user", content: flashcardPrompt }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*"cards"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      cards = Array.isArray(parsed.cards) ? parsed.cards : [];
    }
  } catch (err) {
    console.error("[certifications/generate] Claude flashcard error:", err);
    return NextResponse.json({ error: "Failed to generate flashcards" }, { status: 500 });
  }

  if (cards.length === 0) {
    return NextResponse.json({ error: "No flashcards were generated" }, { status: 500 });
  }

  return NextResponse.json({ cards }, { status: 200 });
}
