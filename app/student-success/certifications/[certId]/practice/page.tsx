export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import PracticeSetupClient from "./_components/PracticeSetupClient";

export default async function CertPracticeSetupPage({
  params,
}: {
  params: Promise<{ certId: string }>;
}) {
  const { certId } = await params;
  const userId = await getCurrentUserId();
  if (!userId) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Load exam (verify ownership)
  const { data: exam } = await db
    .schema("student_support")
    .from("cert_exams")
    .select("id, name, vendor, exam_code, passing_score_pct")
    .eq("id", certId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!exam) notFound();

  // Load domains for this exam
  const { data: domains } = await db
    .schema("student_support")
    .from("cert_domains")
    .select("id, name, weight_pct, sort_order")
    .eq("exam_id", certId)
    .order("sort_order");

  // Count questions per domain (and total)
  const { data: questionRows } = await db
    .schema("student_support")
    .from("cert_questions")
    .select("id, domain_id")
    .eq("exam_id", certId);

  const countByDomain: Record<string, number> = {};
  let totalQuestions = 0;
  for (const q of questionRows ?? []) {
    totalQuestions++;
    if (q.domain_id) {
      countByDomain[q.domain_id] = (countByDomain[q.domain_id] ?? 0) + 1;
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 28px 100px" }}>
        <Link
          href={`/student-success/certifications/${certId}`}
          style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none" }}
        >
          ← {exam.name}
        </Link>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 400,
            margin: "12px 0 4px",
          }}
        >
          New Practice Session
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 32 }}>
          Configure your session and start practicing.
        </p>

        <PracticeSetupClient
          certId={certId}
          examName={exam.name}
          domains={domains ?? []}
          countByDomain={countByDomain}
          totalQuestions={totalQuestions}
        />
      </main>
    </div>
  );
}
