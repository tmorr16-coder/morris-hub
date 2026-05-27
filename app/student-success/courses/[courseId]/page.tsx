export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import CourseDetailClient from "./_components/CourseDetailClient";

export default async function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { courseId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const [courseResult, contentResult, remindersResult, flashcardSetsResult] = await Promise.all([
    service
      .schema("student_support")
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .eq("user_id", user.id)
      .maybeSingle(),
    service
      .schema("student_support")
      .from("course_content")
      .select("*")
      .eq("course_id", courseId)
      .order("imported_at", { ascending: false }),
    service
      .schema("student_support")
      .from("course_reminders")
      .select("*")
      .eq("course_id", courseId)
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .order("due_date", { ascending: true }),
    service
      .schema("student_support")
      .from("flashcard_sets")
      .select("*")
      .eq("course_id", courseId)
      .eq("user_id", user.id),
  ]);

  if (!courseResult.data) {
    redirect("/student-success");
  }

  const course = courseResult.data;
  const content = contentResult.data ?? [];
  const reminders = remindersResult.data ?? [];
  const flashcardSets = flashcardSetsResult.data ?? [];

  return (
    <div style={{ background: "var(--color-bg)" }}>
      <div
        style={{
          background: `linear-gradient(135deg, ${course.color_tag}15 0%, ${course.color_tag}05 100%)`,
          borderBottom: `2px solid ${course.color_tag}`,
          padding: "20px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Link
            href="/student-success"
            style={{
              color: "var(--color-accent-dark)",
              textDecoration: "none",
              fontSize: 13,
              marginBottom: 12,
              display: "inline-block",
            }}
          >
            ← Back to Student Success
          </Link>
          <h1 className="serif" style={{ fontSize: 36, margin: "0 0 8px 0", color: course.color_tag }}>
            {course.name}
          </h1>
          {course.instructor && <p style={{ color: "var(--color-ink-3)", margin: 0 }}>📚 {course.instructor}</p>}
        </div>
      </div>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px 80px" }}>
        <Suspense fallback={<div style={{ color: "var(--color-ink-3)" }}>Loading course details...</div>}>
          <CourseDetailClient
            courseId={courseId}
            course={course}
            initialContent={content}
            initialReminders={reminders}
            initialFlashcardSets={flashcardSets}
            userId={user.id}
          />
        </Suspense>
      </main>
    </div>
  );
}
