"use client";

import Link from "next/link";

interface SharedCourse {
  shareId: string;
  courseId: string;
  shareGrades: boolean;
  shareAssignments: boolean;
  course: {
    id: string;
    name: string;
    instructor: string | null;
    semester: string | null;
    color_tag: string;
  } | null;
  ownerName: string;
}

export default function SharedCoursesSection({
  sharedCourses,
}: {
  sharedCourses: SharedCourse[];
}) {
  const valid = sharedCourses.filter((s) => s.course !== null);
  if (valid.length === 0) return null;

  return (
    <section>
      <div style={{ marginBottom: 16 }}>
        <h2 className="serif" style={{ fontSize: 24, margin: "0 0 4px 0" }}>
          Shared with Me
        </h2>
        <p style={{ fontSize: 12, color: "var(--color-ink-3)", margin: 0 }}>
          Read-only access to courses shared by family members
        </p>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {valid.map((s) => {
          const c = s.course!;
          return (
            <Link
              key={s.shareId}
              href={`/student-success/shared/${c.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  boxShadow: "var(--shadow-card)",
                  cursor: "pointer",
                  transition: "box-shadow 0.2s ease",
                  borderLeft: `4px solid ${c.color_tag}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
                }}
              >
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)", margin: "0 0 3px 0" }}>
                    {c.name}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--color-ink-3)", margin: 0 }}>
                    Shared by {s.ownerName}
                    {c.instructor && ` · 📚 ${c.instructor}`}
                  </p>
                </div>

                {/* Access badges */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {s.shareGrades && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: c.color_tag + "20",
                      color: c.color_tag,
                      border: `1px solid ${c.color_tag}40`,
                      letterSpacing: "0.04em",
                    }}>
                      📊 Grades
                    </span>
                  )}
                  {s.shareAssignments && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: c.color_tag + "20",
                      color: c.color_tag,
                      border: `1px solid ${c.color_tag}40`,
                      letterSpacing: "0.04em",
                    }}>
                      📋 Assignments
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
