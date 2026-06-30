export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import PlatformMenu from "@/components/PlatformMenu";
import CertDetailClient from "./_components/CertDetailClient";

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: exam, error: examErr } = await db
    .schema("student_support")
    .from("cert_exams")
    .select("*")
    .eq("id", certId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (examErr || !exam) {
    redirect("/student-success/certifications");
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

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    isAdmin: false,
  };

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <PlatformMenu currentApp="student-success" user={menuUser} />

      {/* Header band */}
      <div
        style={{
          background: `linear-gradient(135deg, ${exam.color_tag}18 0%, ${exam.color_tag}06 100%)`,
          borderBottom: `2px solid ${exam.color_tag}`,
          padding: "20px 28px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Link
            href="/student-success/certifications"
            style={{
              color: "var(--color-accent-dark)",
              textDecoration: "none",
              fontSize: 13,
              marginBottom: 12,
              display: "inline-block",
            }}
          >
            ← Back to Certifications
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {/* Color dot */}
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: exam.color_tag,
                flexShrink: 0,
              }}
            />

            <h1
              className="serif"
              style={{ fontSize: 32, margin: 0, color: exam.color_tag, lineHeight: 1.1 }}
            >
              {exam.name}
            </h1>

            {/* Exam code badge */}
            {exam.exam_code && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  borderRadius: 6,
                  background: exam.color_tag + "20",
                  border: `1px solid ${exam.color_tag}50`,
                  color: exam.color_tag,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  fontFamily: "monospace",
                }}
              >
                {exam.exam_code}
              </span>
            )}

            {/* Vendor */}
            {exam.vendor && (
              <span
                style={{
                  fontSize: 13,
                  color: "var(--color-ink-3)",
                }}
              >
                {exam.vendor}
              </span>
            )}
          </div>

          {exam.description && (
            <p
              style={{
                color: "var(--color-ink-3)",
                margin: "10px 0 0 30px",
                fontSize: 13,
                lineHeight: 1.5,
                maxWidth: 700,
              }}
            >
              {exam.description}
            </p>
          )}
        </div>
      </div>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px 100px" }}>
        <CertDetailClient
          exam={exam}
          domains={domains}
          materials={materials}
          questionCount={questionCount}
          recentSessions={sessionsWithScore}
          openSessions={openSessions}
          savedGuideSections={savedGuideSections}
        />
      </main>
    </div>
  );
}
