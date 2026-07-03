export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PRESETS = [
  {
    key: "ai900",
    name: "Microsoft Azure AI Fundamentals",
    vendor: "Microsoft",
    exam_code: "AI-900",
    description: "Foundation-level knowledge of machine learning and AI concepts, and related Microsoft Azure services.",
    color_tag: "#0078D4",
  },
  {
    key: "az900",
    name: "Microsoft Azure Fundamentals",
    vendor: "Microsoft",
    exam_code: "AZ-900",
    description: "Cloud concepts, core Azure services, security, compliance, privacy, pricing, and support.",
    color_tag: "#0078D4",
  },
  {
    key: "claude-arch",
    name: "Claude Certified Architect – Foundations",
    vendor: "Anthropic",
    exam_code: "CCA-F",
    description: "Design and build production-ready systems with Claude APIs, agentic patterns, and responsible AI principles.",
    color_tag: "#C97A3A",
  },
];

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function CertificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const db = createServiceClient() as any;

  const { data: certs, error } = await db
    .schema("student_support")
    .from("cert_exams")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[certifications] fetch error:", error.message);
  }

  const certList = certs ?? [];

  // Fetch question counts per exam
  const questionCounts: Record<string, number> = {};
  if (certList.length > 0) {
    const examIds = certList.map((c: any) => c.id);
    const { data: qRows } = await db
      .schema("student_support")
      .from("cert_questions")
      .select("exam_id")
      .in("exam_id", examIds);
    for (const row of qRows ?? []) {
      questionCounts[row.exam_id] = (questionCounts[row.exam_id] ?? 0) + 1;
    }
  }

  return (
    <div className="ios-scroll">      <LargeTitle title="Certifications" subtitle="Study for cloud, AI & professional exams" />

      {certList.length === 0 ? (
        <>
          <Group header="Popular certifications" footer="No certifications yet. Start with a popular one or add your own.">
            {PRESETS.map((preset) => (
              <Cell
                key={preset.key}
                href={`/career/certifications/new?preset=${preset.key}`}
                lead={<IconBadge color={preset.color_tag}><Icons.BookIcon /></IconBadge>}
                title={preset.name}
                subtitle={`${preset.exam_code} · ${preset.vendor}`}
              />
            ))}
          </Group>
          <Group>
            <Cell
              lead={<IconBadge color="var(--ios-tint)"><Icons.PlusIcon /></IconBadge>}
              title="Add your own"
              href="/career/certifications/new"
            />
          </Group>
        </>
      ) : (
        <>
          <Group header="Your certifications">
            {certList.map((cert: any) => (
              <Cell
                key={cert.id}
                href={`/career/certifications/${cert.id}`}
                lead={<IconBadge color={cert.color_tag || "var(--ios-tint)"}><Icons.BookIcon /></IconBadge>}
                title={cert.name}
                subtitle={[cert.exam_code, cert.vendor, formatDate(cert.target_exam_date)].filter(Boolean).join(" · ") || undefined}
                trailing={<span className="ios-num">{questionCounts[cert.id] ?? 0}</span>}
              />
            ))}
          </Group>
          <Group>
            <Cell
              lead={<IconBadge color="var(--ios-tint)"><Icons.PlusIcon /></IconBadge>}
              title="Add certification"
              href="/career/certifications/new"
            />
          </Group>
        </>
      )}

      <div style={{ height: 12 }} />
    </div>
  );
}
