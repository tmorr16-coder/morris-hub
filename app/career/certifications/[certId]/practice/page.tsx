export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { LargeTitle, Icons } from "@/components/ios";
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
    <div className="ios-scroll">
      <Link
        href={`/career/certifications/${certId}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-tint)", padding: "6px 16px 0", fontWeight: 500 }}
        className="ios-subhead"
      >
        <Icons.ChevronLeft style={{ width: 16, height: 16 }} /> {exam.name}
      </Link>
      <LargeTitle title="New Practice Session" subtitle="Configure your session and start practicing." />
      <div style={{ padding: "4px 16px 40px" }}>
        <PracticeSetupClient
          certId={certId}
          examName={exam.name}
          domains={domains ?? []}
          countByDomain={countByDomain}
          totalQuestions={totalQuestions}
        />
      </div>
    </div>
  );
}
