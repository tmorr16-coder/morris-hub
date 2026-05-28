import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// ── POST: generate grade components from course content via Claude ────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { courseId } = body;

  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Verify course ownership
  const { data: course } = await service
    .schema("student_support")
    .from("courses")
    .select("id, name, user_id")
    .eq("id", courseId)
    .maybeSingle();

  if (!course || course.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch course content — prioritize syllabus items, include extracted_text
  const { data: courseContent, error: contentErr } = await service
    .schema("student_support")
    .from("course_content")
    .select("type, title, description, extracted_text")
    .eq("course_id", courseId)
    .order("type", { ascending: true }); // syllabus sorts near top alphabetically

  if (contentErr) {
    console.error("[grades/generate] fetch content error:", contentErr.message);
    return NextResponse.json({ error: contentErr.message }, { status: 500 });
  }

  const content: Array<{
    type: string;
    title: string;
    description: string | null;
    extracted_text: string | null;
  }> = courseContent ?? [];

  // Build context — syllabus content first, then everything else
  const sortedContent = [
    ...content.filter((c) => c.type === "syllabus"),
    ...content.filter((c) => c.type !== "syllabus"),
  ];

  const contentBlock = sortedContent.length > 0
    ? sortedContent.map((c) => {
        let s = `[${c.type.toUpperCase()}] ${c.title}`;
        if (c.description) s += `\n  ${c.description}`;
        if (c.extracted_text) {
          const excerpt = c.extracted_text.length > 3000
            ? c.extracted_text.slice(0, 3000) + "\n  [...]"
            : c.extracted_text;
          s += `\n\n  Content:\n  ${excerpt.replace(/\n/g, "\n  ")}`;
        }
        return s;
      }).join("\n\n---\n\n")
    : "No course materials uploaded yet. Use common grade structures for a university course.";

  const prompt = `You are an academic grade tracking assistant. Analyze the course materials below and identify the grade components (categories) with their weights.

## Course: ${course.name}

## Course Materials
${contentBlock}

## Instructions
Extract the grading structure from the syllabus or course materials. If no explicit breakdown is found, propose a reasonable standard university grade breakdown.

For each grade component, provide:
- category: Clear name (e.g., "Homework", "Midterm Exam", "Final Exam", "Participation", "Quizzes", "Projects", "Lab Reports")
- weight: Percentage weight as a number (e.g., 20 for 20%). All weights MUST sum to exactly 100.
- points_possible: Typical total points for this component (e.g., 100, 200, 50). Use null if unknown.
- notes: Brief note about this component (optional, e.g., "Weekly assignments, lowest dropped")

Respond with ONLY valid JSON in this exact format:
{
  "components": [
    {
      "category": "Homework",
      "weight": 20,
      "points_possible": 200,
      "notes": "Weekly problem sets"
    }
  ]
}`;

  let generated: Array<{
    category: string;
    weight: number;
    points_possible: number | null;
    notes?: string;
  }> = [];

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*"components"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.components)) {
        generated = parsed.components;
      }
    }
  } catch (err) {
    console.error("[grades/generate] Claude error:", err);
    return NextResponse.json({ error: "Failed to generate grade components" }, { status: 500 });
  }

  if (generated.length === 0) {
    return NextResponse.json({ error: "No grade components were generated" }, { status: 500 });
  }

  // Normalize weights to sum to 100 (in case Claude drifts slightly)
  const totalWeight = generated.reduce((sum, c) => sum + (c.weight ?? 0), 0);
  if (totalWeight > 0 && Math.abs(totalWeight - 100) > 0.5) {
    generated = generated.map((c) => ({
      ...c,
      weight: Math.round((c.weight / totalWeight) * 100 * 10) / 10,
    }));
  }

  // Delete existing grade_components for this course + user
  const { error: deleteErr } = await service
    .schema("student_support")
    .from("grade_components")
    .delete()
    .eq("course_id", courseId)
    .eq("user_id", user.id);

  if (deleteErr) {
    console.error("[grades/generate] delete error:", deleteErr.message);
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  // Insert the generated components
  const rows = generated.map((c, idx) => ({
    user_id: user.id,
    course_id: courseId,
    category: c.category,
    weight: c.weight,
    points_earned: null,
    points_possible: c.points_possible ?? null,
    notes: c.notes ?? null,
    sort_order: idx,
  }));

  const { data: savedRows, error: insertErr } = await service
    .schema("student_support")
    .from("grade_components")
    .insert(rows)
    .select();

  if (insertErr) {
    console.error("[grades/generate] insert error:", insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ components: savedRows ?? [] }, { status: 201 });
}
