"use client";

interface GradeComponent {
  id: string;
  category: string;
  weight: number;
  points_earned: number | null;
  points_possible: number | null;
  notes: string | null;
}

interface CourseReminder {
  id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string;
  is_completed: boolean;
}

interface SharedCourseClientProps {
  courseId: string;
  colorTag: string;
  grades: GradeComponent[];
  assignments: CourseReminder[];
  canViewGrades: boolean;
  canViewAssignments: boolean;
}

function getLetterGrade(pct: number): { letter: string; color: string } {
  if (pct >= 90) return { letter: "A", color: "#16a34a" };
  if (pct >= 80) return { letter: "B", color: "#2563eb" };
  if (pct >= 70) return { letter: "C", color: "#ca8a04" };
  if (pct >= 60) return { letter: "D", color: "#ea580c" };
  return { letter: "F", color: "#dc2626" };
}

function calcContribution(row: GradeComponent): number | null {
  if (row.points_earned === null || row.points_possible === null || row.points_possible === 0) {
    return null;
  }
  return (row.points_earned / row.points_possible) * row.weight;
}

const TYPE_EMOJI: Record<string, string> = {
  test: "📝",
  assignment: "📋",
  quiz: "❓",
  practice: "🔁",
  extra_credit: "⭐",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function SharedCourseClient({
  colorTag,
  grades,
  assignments,
  canViewGrades,
  canViewAssignments,
}: SharedCourseClientProps) {
  const contributions = grades.map(calcContribution);
  const totalWeight = grades.reduce((s, r) => s + (r.weight ?? 0), 0);
  const totalGrade = contributions.every((c) => c === null)
    ? null
    : contributions.reduce<number>((s, c) => s + (c ?? 0), 0);

  const { letter, color: badgeColor } = totalGrade !== null
    ? getLetterGrade(totalGrade)
    : { letter: "—", color: "var(--color-ink-3)" };

  const upcoming = assignments
    .filter((a) => !a.is_completed && daysUntil(a.due_date) >= 0)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const past = assignments
    .filter((a) => a.is_completed || daysUntil(a.due_date) < 0)
    .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());

  return (
    <div style={{ display: "grid", gridTemplateColumns: canViewGrades && canViewAssignments ? "1fr 1fr" : "1fr", gap: 32, alignItems: "start" }}>

      {/* ── Grades panel ── */}
      {canViewGrades && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 className="serif" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              📊 Grade Tracker
            </h2>
            {totalGrade !== null && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: badgeColor + "15",
                border: `2px solid ${badgeColor}`,
                borderRadius: 10,
                padding: "6px 14px",
              }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: badgeColor, fontFamily: "serif", lineHeight: 1 }}>
                  {letter}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: badgeColor }}>
                  {totalGrade.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {grades.length === 0 ? (
            <div style={{
              background: "var(--color-bg-card)",
              border: "1px dashed var(--color-rule)",
              borderRadius: 10,
              padding: "32px 20px",
              textAlign: "center",
              color: "var(--color-ink-3)",
              fontSize: 13,
            }}>
              No grade components added yet.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: colorTag + "15", borderBottom: `2px solid ${colorTag}` }}>
                    {["Category", "Weight", "Earned", "Possible", "Score"].map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: "8px 10px",
                          textAlign: col === "Category" ? "left" : "right",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--color-ink-2)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grades.map((row, idx) => {
                    const contribution = calcContribution(row);
                    return (
                      <tr
                        key={row.id}
                        style={{
                          background: idx % 2 === 0 ? "var(--color-bg-card)" : "var(--color-bg)",
                        }}
                      >
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--color-rule)" }}>
                          <div style={{ fontWeight: 500 }}>{row.category}</div>
                          {row.notes && (
                            <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2 }}>
                              {row.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--color-rule)", textAlign: "right", color: "var(--color-ink-2)" }}>
                          {row.weight}%
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--color-rule)", textAlign: "right" }}>
                          {row.points_earned ?? <span style={{ color: "var(--color-ink-3)" }}>—</span>}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--color-rule)", textAlign: "right" }}>
                          {row.points_possible ?? <span style={{ color: "var(--color-ink-3)" }}>—</span>}
                        </td>
                        <td style={{
                          padding: "8px 10px",
                          borderBottom: "1px solid var(--color-rule)",
                          textAlign: "right",
                          fontWeight: contribution !== null ? 600 : 400,
                          color: contribution !== null ? colorTag : "var(--color-ink-3)",
                        }}>
                          {contribution !== null ? `${contribution.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--color-paper-deep)", borderTop: `2px solid ${colorTag}` }}>
                    <td style={{ padding: "8px 10px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-2)" }}>
                      Total
                    </td>
                    <td style={{
                      padding: "8px 10px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: Math.abs(totalWeight - 100) < 0.01 ? "#16a34a" : "var(--color-ink)",
                    }}>
                      {totalWeight.toFixed(1)}%
                    </td>
                    <td style={{ padding: "8px 10px" }} />
                    <td style={{ padding: "8px 10px" }} />
                    <td style={{
                      padding: "8px 10px",
                      textAlign: "right",
                      fontWeight: 800,
                      fontSize: 14,
                      color: totalGrade !== null ? getLetterGrade(totalGrade).color : "var(--color-ink-3)",
                    }}>
                      {totalGrade !== null ? `${totalGrade.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Assignments panel ── */}
      {canViewAssignments && (
        <div>
          <h2 className="serif" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 16px 0" }}>
            📋 Assignments
          </h2>

          {assignments.length === 0 ? (
            <div style={{
              background: "var(--color-bg-card)",
              border: "1px dashed var(--color-rule)",
              borderRadius: 10,
              padding: "32px 20px",
              textAlign: "center",
              color: "var(--color-ink-3)",
              fontSize: 13,
            }}>
              No assignments added yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Upcoming */}
              {upcoming.length > 0 && (
                <>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--color-ink-3)",
                    marginBottom: 4,
                  }}>
                    Upcoming ({upcoming.length})
                  </div>
                  {upcoming.map((a) => {
                    const days = daysUntil(a.due_date);
                    const urgentColor = days === 0 ? "#dc2626" : days <= 3 ? "#ea580c" : days <= 7 ? "#ca8a04" : colorTag;
                    return (
                      <div
                        key={a.id}
                        style={{
                          background: "var(--color-bg-card)",
                          border: `1px solid ${urgentColor}30`,
                          borderLeft: `3px solid ${urgentColor}`,
                          borderRadius: 8,
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1 }}>
                          <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>
                            {TYPE_EMOJI[a.type] ?? "📌"}
                          </span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>
                              {a.title}
                            </div>
                            {a.description && (
                              <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2 }}>
                                {a.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: urgentColor }}>
                            {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--color-ink-3)" }}>
                            {formatDate(a.due_date)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Past / completed */}
              {past.length > 0 && (
                <>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--color-ink-3)",
                    marginTop: 12,
                    marginBottom: 4,
                  }}>
                    Past ({past.length})
                  </div>
                  {past.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        background: a.is_completed ? "#f0fdf4" : "var(--color-bg-card)",
                        border: "1px solid var(--color-rule)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        opacity: 0.7,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1 }}>
                        <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>
                          {a.is_completed ? "✅" : TYPE_EMOJI[a.type] ?? "📌"}
                        </span>
                        <div style={{ fontSize: 13, color: "var(--color-ink-2)", textDecoration: a.is_completed ? "line-through" : "none" }}>
                          {a.title}
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--color-ink-3)", flexShrink: 0 }}>
                        {formatDate(a.due_date)}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
