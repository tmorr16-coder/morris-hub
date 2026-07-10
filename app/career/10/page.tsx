export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";
import LearningPageClient from "./_components/LearningPageClient";

const STATUS_COLORS: Record<string, string> = {
  planned:     "#8A8278",
  in_progress: "#3B5C7F",
  completed:   "#4A6B3A",
  paused:      "#C97A3A",
};

const TYPE_COLORS: Record<string, string> = {
  course:       "#3B5C7F",
  conference:   "#6B5B95",
  book:         "#4A6B3A",
  workshop:     "#C97A3A",
  certification:"#9A3B2A",
  other:        "#8A8278",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function TenPercentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const [learningResult, certExamsResult, goalsResult] = await Promise.all([
    db
      .schema("career")
      .from("career_learning")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    db
      .schema("student_support")
      .from("cert_exams")
      .select("id, name, vendor, exam_code, target_exam_date, color_tag, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    db
      .schema("career")
      .from("career_goals")
      .select("id, title, color_tag")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("title", { ascending: true }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const learningItems = (learningResult.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const certExams = (certExamsResult.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const goals = (goalsResult.data ?? []) as any[];

  const goalsMap: Record<string, string> = {};
  goals.forEach((g) => { goalsMap[g.id] = g.title; });

  // Non-certification learning items
  const nonCertItems = learningItems.filter(
    (item) => item.learning_type !== "certification"
  );

  return (
    <div className="ios-scroll">      <LargeTitle title="10% · Learning" subtitle="Structured learning — courses, certs & books" />

      {/* Active certifications */}
      {certExams.length === 0 ? (
        <Group header="Certifications" footer="Track a certification to plan your exam prep.">
          <Cell
            lead={<IconBadge color="var(--ios-orange)"><Icons.PlusIcon /></IconBadge>}
            title="Add a certification"
            href="/career/certifications/new"
          />
        </Group>
      ) : (
        <Group header="Certifications">
          {certExams.map((cert) => (
            <Cell
              key={cert.id}
              href={`/career/certifications/${cert.id}`}
              lead={<IconBadge color={cert.color_tag ?? "var(--ios-orange)"}><Icons.BookIcon /></IconBadge>}
              title={cert.name}
              subtitle={[cert.exam_code, cert.vendor, cert.target_exam_date ? `Target ${formatDate(cert.target_exam_date)}` : null].filter(Boolean).join(" · ") || undefined}
            />
          ))}
          <Cell
            lead={<IconBadge color="#8E8E93"><Icons.ChecklistIcon /></IconBadge>}
            title="All certifications"
            href="/career/certifications"
          />
        </Group>
      )}

      {/* Courses / books / conferences + add learning (interactive client) */}
      <LearningPageClient
        learningItems={nonCertItems}
        goals={goals}
        goalsMap={goalsMap}
        statusColors={STATUS_COLORS}
        typeColors={TYPE_COLORS}
      />

      <div style={{ height: 12 }} />
    </div>
  );
}
