import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL_FAST } from "@/lib/models";

const anthropic = new Anthropic();

const CARD_STYLE_DESCRIPTIONS: Record<string, string> = {
  definition: "Term on front, concise definition on back",
  qa: "A clear question on front, detailed answer on back",
  concept: "Concept name on front, explanation + example on back",
  fillinblank: "A sentence with a blank on front, the missing word/phrase on back",
};

// ── POST: generate flashcards via Claude and save to a flashcard set ──────────
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { setId, courseId, topic, cardStyle, difficulty, count } = body;

  if (!setId || !courseId || !cardStyle || !difficulty || !count) {
    return NextResponse.json({ error: "setId, courseId, cardStyle, difficulty, and count are required" }, { status: 400 });
  }

  if (!CARD_STYLE_DESCRIPTIONS[cardStyle]) {
    return NextResponse.json({ error: "Invalid cardStyle. Must be one of: definition, qa, concept, fillinblank" }, { status: 400 });
  }

  const cardCount = Math.min(Math.max(Number(count), 5), 20);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Verify set ownership
  const { data: set } = await service
    .schema("student_support")
    .from("flashcard_sets")
    .select("user_id")
    .eq("id", setId)
    .maybeSingle();

  if (!set || set.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch course content for context
  const { data: courseContent, error: contentErr } = await service
    .schema("student_support")
    .from("course_content")
    .select("type, title, description, content_url, extracted_text")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });

  if (contentErr) {
    console.error("[flashcards/generate] fetch content error:", contentErr.message);
    return NextResponse.json({ error: contentErr.message }, { status: 500 });
  }

  const content: Array<{
    type: string;
    title: string;
    description: string | null;
    content_url: string | null;
    extracted_text: string | null;
  }> = courseContent ?? [];

  // Build course material context block
  const contentBlock = content.length > 0
    ? content.map((c) => {
        let s = `[${c.type.toUpperCase()}] ${c.title}`;
        if (c.description) s += `\n  ${c.description}`;
        if (c.content_url) s += `\n  URL: ${c.content_url}`;
        if (c.extracted_text) {
          const excerpt = c.extracted_text.length > 2000
            ? c.extracted_text.slice(0, 2000) + "\n  [...]"
            : c.extracted_text;
          s += `\n\n  Content:\n  ${excerpt.replace(/\n/g, "\n  ")}`;
        }
        return s;
      }).join("\n\n")
    : "No course materials uploaded yet.";

  const styleDescription = CARD_STYLE_DESCRIPTIONS[cardStyle];
  const topicClause = topic ? `Focus specifically on the topic: "${topic}".` : "Cover the most important concepts from the course material.";

  const prompt = `You are an expert study tool generator. Create ${cardCount} flashcards based on the course material below.

## Card Style: ${cardStyle}
Format: ${styleDescription}

## Difficulty: ${difficulty}
- beginner: focus on fundamental definitions, key terms, and basic concepts
- intermediate: include application, comparison, and multi-step concepts
- advanced: emphasize analysis, synthesis, edge cases, and nuanced distinctions

## Topic Focus
${topicClause}

## Course Material
${contentBlock}

## Instructions
Generate exactly ${cardCount} flashcards using the "${cardStyle}" style at "${difficulty}" difficulty level.
Each card must have:
- question: the front of the card (term, question, concept, or fill-in-the-blank sentence)
- answer: the back of the card (definition, answer, explanation+example, or missing word/phrase)
- context: (optional) a brief note about why this card matters or where it appears in the material

Respond with ONLY valid JSON in this exact format:
{
  "cards": [
    {
      "question": "...",
      "answer": "...",
      "context": "..."
    }
  ]
}`;

  let generated: Array<{ question: string; answer: string; context?: string }> = [];

  try {
    const response = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*"cards"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      generated = Array.isArray(parsed.cards) ? parsed.cards : [];
    }
  } catch (err) {
    console.error("[flashcards/generate] Claude error:", err);
    return NextResponse.json({ error: "Failed to generate flashcards" }, { status: 500 });
  }

  if (generated.length === 0) {
    return NextResponse.json({ error: "No flashcards were generated" }, { status: 500 });
  }

  // Insert all generated cards into the database
  const rows = generated.map((card) => ({
    set_id: setId,
    user_id: user.id,
    question: card.question,
    answer: card.answer,
    context: card.context ?? null,
  }));

  const { data: savedCards, error: insertErr } = await service
    .schema("student_support")
    .from("flashcards")
    .insert(rows)
    .select();

  if (insertErr) {
    console.error("[flashcards/generate] insert cards error:", insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ cards: savedCards ?? [] }, { status: 201 });
}
