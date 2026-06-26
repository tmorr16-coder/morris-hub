export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
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
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: "var(--font-display, serif)",
            fontSize: 28,
            fontWeight: 400,
            color: "var(--color-ink)",
            margin: "0 0 6px",
          }}
        >
          10% · Structured Learning
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", margin: 0, maxWidth: 640 }}>
          10% of career growth comes from structured, formal learning — courses, certifications,
          conferences, and books that build your knowledge foundation.
        </p>
      </div>

      {/* Section 1: Active Certifications */}
      <section style={{ marginBottom: 36 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
            gap: 12,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--color-ink)",
              margin: 0,
            }}
          >
            Active Certifications
          </h2>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link
              href="/student-success/certifications"
              style={{
                fontSize: 13,
                color: "var(--color-accent)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Browse all certifications →
            </Link>
            <Link
              href="/student-success/certifications/new"
              style={{
                background: "var(--color-accent)",
                color: "#fff",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              + Add Certification
            </Link>
          </div>
        </div>

        {certExams.length === 0 ? (
          <div
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-rule)",
              borderRadius: 10,
              padding: "24px",
              textAlign: "center",
              color: "var(--color-ink-3)",
              fontSize: 14,
            }}
          >
            No certifications tracked yet.{" "}
            <Link href="/student-success/certifications/new" style={{ color: "var(--color-accent)" }}>
              Add one in Student Success
            </Link>
            .
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            }}
          >
            {certExams.map((cert) => (
              <Link
                key={cert.id}
                href={`/student-success/certifications/${cert.id}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    background: "var(--color-bg-card)",
                    border: "1px solid var(--color-rule)",
                    borderRadius: 10,
                    padding: "16px 18px",
                    borderLeft: "4px solid #9A3B2A",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", marginBottom: 2 }}>
                        {cert.name}
                      </div>
                      {cert.exam_code && (
                        <div style={{ fontSize: 12, color: "var(--color-ink-3)", fontFamily: "var(--font-mono)" }}>
                          {cert.exam_code}
                        </div>
                      )}
                      {cert.vendor && (
                        <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 2 }}>
                          {cert.vendor}
                        </div>
                      )}
                    </div>
                    {cert.exam_code && (
                      <span style={{ background: `${cert.color_tag ?? "#9A3B2A"}18`, color: cert.color_tag ?? "#9A3B2A", border: `1px solid ${cert.color_tag ?? "#9A3B2A"}44`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 500, whiteSpace: "nowrap" }}>
                        {cert.exam_code}
                      </span>
                    )}
                  </div>
                  {cert.target_exam_date && (
                    <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 8 }}>
                      Target: {formatDate(cert.target_exam_date)}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Section 2 & 3: Courses/Books/Conferences + Add Learning (client) */}
      <LearningPageClient
        learningItems={nonCertItems}
        goals={goals}
        goalsMap={goalsMap}
        statusColors={STATUS_COLORS}
        typeColors={TYPE_COLORS}
      />
    </div>
  );
}
