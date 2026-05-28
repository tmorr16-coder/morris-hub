import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// ── GET: load existing schedule for a course ─────────────────────────────────
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseId = request.nextUrl.searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data: schedule } = await service
    .schema("student_support")
    .from("course_schedules")
    .select("*")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!schedule) return NextResponse.json({ schedule: null, items: [] });

  const { data: items } = await service
    .schema("student_support")
    .from("schedule_items")
    .select("*")
    .eq("schedule_id", schedule.id)
    .order("sort_order", { ascending: true });

  return NextResponse.json({ schedule, items: items ?? [] });
}

// ── POST: generate (or regenerate) schedule using Claude ─────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { courseId } = await request.json();
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Fetch course info, all content, and upcoming reminders in parallel
  const [courseRes, contentRes, remindersRes] = await Promise.all([
    service.schema("student_support").from("courses")
      .select("name, description, instructor, semester")
      .eq("id", courseId).eq("user_id", user.id).maybeSingle(),
    service.schema("student_support").from("course_content")
      .select("type, title, description, content_url, extracted_text")
      .eq("course_id", courseId).order("created_at", { ascending: true }),
    service.schema("student_support").from("course_reminders")
      .select("type, title, due_date, description")
      .eq("course_id", courseId).eq("user_id", user.id)
      .eq("is_completed", false)
      .order("due_date", { ascending: true }),
  ]);

  const course = courseRes.data;
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const content: Array<{ type: string; title: string; description: string | null; content_url: string | null; extracted_text: string | null }> = contentRes.data ?? [];
  const reminders: Array<{ type: string; title: string; due_date: string; description: string | null }> = remindersRes.data ?? [];

  // Build context for Claude
  const contentBlock = content.length > 0
    ? content.map((c) => {
        let s = `[${c.type.toUpperCase()}] ${c.title}`;
        if (c.description) s += `\n  ${c.description}`;
        if (c.content_url)  s += `\n  URL: ${c.content_url}`;
        if (c.extracted_text) {
          const excerpt = c.extracted_text.length > 2000
            ? c.extracted_text.slice(0, 2000) + "\n  [...]"
            : c.extracted_text;
          s += `\n\n  Content:\n  ${excerpt.replace(/\n/g, "\n  ")}`;
        }
        return s;
      }).join("\n\n")
    : "No materials uploaded yet.";

  const remindersBlock = reminders.length > 0
    ? reminders.map((r) => `• ${r.due_date} — [${r.type}] ${r.title}${r.description ? `: ${r.description}` : ""}`).join("\n")
    : "No upcoming deadlines.";

  const today = new Date().toISOString().split("T")[0];

  const prompt = `You are an academic planning assistant. Create a detailed, realistic study schedule for the following course.

## Course
Name: ${course.name}${course.semester ? ` (${course.semester})` : ""}
${course.instructor ? `Instructor: ${course.instructor}` : ""}
${course.description ? `Description: ${course.description}` : ""}
Today's date: ${today}

## Course Materials
${contentBlock}

## Known Deadlines / Assessments
${remindersBlock}

## Instructions
Generate a practical week-by-week study schedule. Each item must have:
- title: concise, specific action (e.g. "Read Chapter 3: Cell Division", "Review lecture notes on photosynthesis")
- item_type: one of study | reading | review | assignment | exam | quiz | practice | other
- scheduled_date: YYYY-MM-DD format, starting from today and spread across the coming weeks
- duration_minutes: realistic estimate (30, 45, 60, 90, 120)
- description: optional extra detail or goal for the session

Align scheduled_date values to known deadlines where relevant (schedule review/practice before exams, draft before assignment due dates). If the semester is long, spread sessions appropriately. Generate 15-30 items total.

Respond with ONLY valid JSON in this exact format:
{
  "items": [
    {
      "title": "...",
      "item_type": "study",
      "scheduled_date": "2026-05-28",
      "duration_minutes": 60,
      "description": "..."
    }
  ]
}`;

  let generated: Array<{ title: string; item_type: string; scheduled_date?: string; duration_minutes?: number; description?: string }> = [];

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*"items"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      generated = Array.isArray(parsed.items) ? parsed.items : [];
    }
  } catch (err) {
    console.error("[schedule/generate] Claude error:", err);
    return NextResponse.json({ error: "Failed to generate schedule" }, { status: 500 });
  }

  if (generated.length === 0) {
    return NextResponse.json({ error: "No schedule items generated" }, { status: 500 });
  }

  // Upsert schedule row (replace existing)
  const { data: existing } = await service
    .schema("student_support").from("course_schedules")
    .select("id").eq("course_id", courseId).eq("user_id", user.id).maybeSingle();

  let scheduleId: string;
  if (existing) {
    // Delete old items then update schedule
    await service.schema("student_support").from("schedule_items").delete().eq("schedule_id", existing.id);
    await service.schema("student_support").from("course_schedules")
      .update({ updated_at: new Date().toISOString() }).eq("id", existing.id);
    scheduleId = existing.id;
  } else {
    const { data: newSched, error: schedErr } = await service
      .schema("student_support").from("course_schedules")
      .insert({ course_id: courseId, user_id: user.id }).select("id").single();
    if (schedErr) {
      console.error("[schedule/generate] insert schedule:", schedErr);
      return NextResponse.json({ error: schedErr.message }, { status: 500 });
    }
    scheduleId = newSched.id;
  }

  // Insert new items
  const rows = generated.map((item, idx) => ({
    schedule_id: scheduleId,
    title: item.title,
    description: item.description ?? null,
    item_type: item.item_type ?? "study",
    scheduled_date: item.scheduled_date ?? null,
    duration_minutes: item.duration_minutes ?? null,
    sort_order: idx,
    is_completed: false,
  }));

  const { data: savedItems, error: itemsErr } = await service
    .schema("student_support").from("schedule_items")
    .insert(rows).select();

  if (itemsErr) {
    console.error("[schedule/generate] insert items:", itemsErr);
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  return NextResponse.json({ scheduleId, items: savedItems ?? [] });
}

// ── DELETE: remove a schedule entirely ───────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseId = request.nextUrl.searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  await service.schema("student_support").from("course_schedules")
    .delete().eq("course_id", courseId).eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
