export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
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
    redirect("/home/me/courses");
  }

  const course = courseResult.data;
  const content = contentResult.data ?? [];
  const reminders = remindersResult.data ?? [];
  const flashcardSets = flashcardSetsResult.data ?? [];

  return (
    <IOSScreen>
      <LargeTitle title={course.name} subtitle={course.instructor ?? undefined} />

      <div style={{ padding: "0 16px" }}>
        <Suspense fallback={<div style={{ color: "var(--ios-label-2)" }}>Loading course details...</div>}>
          <CourseDetailClient
            courseId={courseId}
            course={course}
            initialContent={content}
            initialReminders={reminders}
            initialFlashcardSets={flashcardSets}
            userId={user.id}
          />
        </Suspense>
      </div>

      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
