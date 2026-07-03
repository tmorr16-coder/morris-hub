export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LargeTitle, Icons } from "@/components/ios";
import CertDetailClient from "./_components/CertDetailClient";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function CertDetailPage({
  params,
}: {
  params: Promise<{ certId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { certId } = await params;

  const db = createServiceClient() as any;

  const { data: exam, error: examErr } = await db
    .schema("student_support")
    .from("cert_exams")
    .select("*")
    .eq("id", certId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (examErr || !exam) {
    redirect("/career/certifications");
  }

  const [domainsResult, materialsResult, questionCountResult, sessionsResult, openSessionsResult, savedGuideResult] =
    await Promise.all([
      db
        .schema("student_support")
        .from("cert_domains")
        .select("*")
        .eq("exam_id", certId)
        .order("sort_order", { ascending: true }),
      db
        .schema("student_support")
        .from("cert_materials")
        .select("*")
        .eq("exam_id", certId)
        .order("created_at", { ascending: false }),
      db
        .schema("student_support")
        .from("cert_questions")
        .select("id", { count: "exact", head: true })
        .eq("exam_id", certId),
      db
        .schema("student_support")
        .from("cert_sessions")
        .select("id, mode, started_at, ended_at")
        .eq("exam_id", certId)
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(5),
      // Paused/open sessions — ended_at IS NULL
      db
        .schema("student_support")
        .from("cert_sessions")
        .select("id, mode, question_count, started_at")
        .eq("exam_id", certId)
        .eq("user_id", user.id)
        .is("ended_at", null)
        .order("started_at", { ascending: false }),
      // Saved study guide sections
      db
        .schema("student_support")
        .from("cert_study_guide_sections")
        .select("*")
        .eq("exam_id", certId)
        .order("created_at", { ascending: true }),
    ]);

  const domains = domainsResult.data ?? [];
  const materials = materialsResult.data ?? [];
  const questionCount = questionCountResult.count ?? 0;
  const recentSessions = sessionsResult.data ?? [];
  const openSessions = (openSessionsResult.data ?? []) as { id: string; mode: string; question_count: number; started_at: string }[];
  const savedGuideSections = ((savedGuideResult.data ?? []) as any[]).map((r) => ({
    id: r.domain_id ?? r.id,
    domain_name: r.domain_name,
    title: r.title,
    estimated_minutes: r.estimated_minutes,
    paragraphs: r.paragraphs ?? [],
    key_terms: r.key_terms ?? [],
    takeaways: r.takeaways ?? [],
    self_test: r.self_test ?? { question: "", answer: "" },
  }));

  // Compute best score from session attempts for each recent session
  // score_pct is not on cert_sessions — we derive it from cert_attempts via question count
  // For now pass sessions as-is; OverviewTab will show score if present
  const sessionsWithScore = recentSessions.map(
    (s: { id: string; mode: string; started_at: string; ended_at: string | null }) => ({
      ...s,
      score_pct: undefined as number | undefined,
    })
  );

  return (
    <div className="ios-scroll">
      <Link
        href="/career/certifications"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-tint)", padding: "6px 16px 0", fontWeight: 500 }}
        className="ios-subhead"
      >
        <Icons.ChevronLeft style={{ width: 16, height: 16 }} /> Certifications
      </Link>
      <LargeTitle
        title={exam.name}
        subtitle={[exam.exam_code, exam.vendor].filter(Boolean).join(" · ") || undefined}
      />
      <div style={{ padding: "4px 16px 40px" }}>
        <CertDetailClient
          exam={exam}
          domains={domains}
          materials={materials}
          questionCount={questionCount}
          recentSessions={sessionsWithScore}
          openSessions={openSessions}
          savedGuideSections={savedGuideSections}
        />
      </div>
    </div>
  );
}
