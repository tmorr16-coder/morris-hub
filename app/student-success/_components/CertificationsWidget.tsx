import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";

interface CertExam {
  id: string;
  name: string;
  vendor: string | null;
  exam_code: string | null;
  target_exam_date: string | null;
  color_tag: string;
}

export default async function CertificationsWidget({ userId }: { userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data } = await service
    .schema("student_support")
    .from("cert_exams")
    .select("id, name, vendor, exam_code, target_exam_date, color_tag")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3);

  const exams: CertExam[] = data ?? [];

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 400, margin: 0 }}>
          Certification Prep
        </h2>
        <Link
          href="/student-success/certifications"
          style={{
            fontSize: 11, color: "var(--color-ink-3)", textDecoration: "none",
            padding: "4px 10px", borderRadius: 6, border: "1px solid var(--color-rule)",
          }}
        >
          View all
        </Link>
      </div>

      {exams.length === 0 ? (
        <Link href="/student-success/certifications" style={{ textDecoration: "none" }}>
          <div style={{
            background: "var(--color-bg-card)",
            border: "1px dashed var(--color-rule)",
            borderRadius: 14,
            padding: "24px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🏅</div>
            <div style={{ fontWeight: 600, color: "var(--color-ink)", marginBottom: 4 }}>No exams yet</div>
            <div style={{ fontSize: 13, color: "var(--color-ink-3)", lineHeight: 1.5 }}>
              Prepare for AI-900, AZ-900, Claude Certified Architect and more →
            </div>
          </div>
        </Link>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {exams.map((exam) => (
            <Link
              key={exam.id}
              href={`/student-success/certifications/${exam.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  boxShadow: "var(--shadow-card)",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  transition: "box-shadow 150ms",
                }}
              >
                {/* Color swatch */}
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: exam.color_tag + "22",
                  border: `2px solid ${exam.color_tag}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: exam.color_tag }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>
                      {exam.name}
                    </span>
                    {exam.exam_code && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.06em", color: "var(--color-ink-4)",
                      }}>
                        {exam.exam_code}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
                    {exam.vendor ?? "Certification"}
                    {exam.target_exam_date && (
                      <span style={{ marginLeft: 8 }}>
                        · Target {new Date(exam.target_exam_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>

                <span style={{ color: "var(--color-ink-4)", fontSize: 18, flexShrink: 0 }}>›</span>
              </div>
            </Link>
          ))}

          <Link
            href="/student-success/certifications"
            style={{
              display: "block", textAlign: "center", padding: "10px",
              color: "var(--color-accent)", fontSize: 13, textDecoration: "none",
              borderRadius: 8, border: "1px dashed var(--color-rule)",
            }}
          >
            + Add certification exam
          </Link>
        </div>
      )}
    </section>
  );
}
