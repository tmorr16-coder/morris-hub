"use client";

import type { ComponentType, SVGProps } from "react";
import { Icons } from "@/components/ios";

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
  if (pct >= 90) return { letter: "A", color: "var(--ios-green)" };
  if (pct >= 80) return { letter: "B", color: "var(--ios-tint)" };
  if (pct >= 70) return { letter: "C", color: "var(--ios-orange)" };
  if (pct >= 60) return { letter: "D", color: "#FF7A00" };
  return { letter: "F", color: "var(--ios-red)" };
}

function calcContribution(row: GradeComponent): number | null {
  if (row.points_earned === null || row.points_possible === null || row.points_possible === 0) {
    return null;
  }
  return (row.points_earned / row.points_possible) * row.weight;
}

const TYPE_ICON: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  test: Icons.ComposeIcon,
  assignment: Icons.ChecklistIcon,
  quiz: Icons.BookIcon,
  practice: Icons.ChartIcon,
  extra_credit: Icons.SparkleIcon,
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
    : { letter: "—", color: "var(--ios-label-3)" };

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 className="ios-title-3" style={{ margin: 0 }}>Grade Tracker</h2>
            {totalGrade !== null && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--ios-cell)",
                border: `2px solid ${badgeColor}`,
                borderRadius: 10,
                padding: "6px 14px",
              }}>
                <span className="ios-num" style={{ fontSize: 28, fontWeight: 800, color: badgeColor, lineHeight: 1 }}>
                  {letter}
                </span>
                <span className="ios-subhead ios-num" style={{ fontWeight: 700, color: badgeColor }}>
                  {totalGrade.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {grades.length === 0 ? (
            <div className="ios-footnote" style={{
              background: "var(--ios-cell)",
              borderRadius: "var(--ios-radius-card)",
              padding: "32px 20px",
              textAlign: "center",
              color: "var(--ios-label-2)",
            }}>
              No grade components added yet.
            </div>
          ) : (
            <div style={{ overflowX: "auto", background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "var(--ios-fill-2)", borderBottom: `2px solid ${colorTag}` }}>
                    {["Category", "Weight", "Earned", "Possible", "Score"].map((col) => (
                      <th
                        key={col}
                        className="ios-caption"
                        style={{
                          padding: "8px 10px",
                          textAlign: col === "Category" ? "left" : "right",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--ios-label-2)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grades.map((row) => {
                    const contribution = calcContribution(row);
                    return (
                      <tr key={row.id}>
                        <td style={{ padding: "8px 10px", borderBottom: "var(--ios-hair) solid var(--ios-separator)" }}>
                          <div style={{ fontWeight: 500 }}>{row.category}</div>
                          {row.notes && (
                            <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 2 }}>
                              {row.notes}
                            </div>
                          )}
                        </td>
                        <td className="ios-num" style={{ padding: "8px 10px", borderBottom: "var(--ios-hair) solid var(--ios-separator)", textAlign: "right", color: "var(--ios-label-2)" }}>
                          {row.weight}%
                        </td>
                        <td className="ios-num" style={{ padding: "8px 10px", borderBottom: "var(--ios-hair) solid var(--ios-separator)", textAlign: "right" }}>
                          {row.points_earned ?? <span style={{ color: "var(--ios-label-3)" }}>—</span>}
                        </td>
                        <td className="ios-num" style={{ padding: "8px 10px", borderBottom: "var(--ios-hair) solid var(--ios-separator)", textAlign: "right" }}>
                          {row.points_possible ?? <span style={{ color: "var(--ios-label-3)" }}>—</span>}
                        </td>
                        <td className="ios-num" style={{
                          padding: "8px 10px",
                          borderBottom: "var(--ios-hair) solid var(--ios-separator)",
                          textAlign: "right",
                          fontWeight: contribution !== null ? 600 : 400,
                          color: contribution !== null ? colorTag : "var(--ios-label-3)",
                        }}>
                          {contribution !== null ? `${contribution.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--ios-fill-2)", borderTop: `2px solid ${colorTag}` }}>
                    <td className="ios-caption" style={{ padding: "8px 10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ios-label-2)" }}>
                      Total
                    </td>
                    <td className="ios-num" style={{
                      padding: "8px 10px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: Math.abs(totalWeight - 100) < 0.01 ? "var(--ios-green)" : "var(--ios-label)",
                    }}>
                      {totalWeight.toFixed(1)}%
                    </td>
                    <td style={{ padding: "8px 10px" }} />
                    <td style={{ padding: "8px 10px" }} />
                    <td className="ios-num" style={{
                      padding: "8px 10px",
                      textAlign: "right",
                      fontWeight: 800,
                      fontSize: 15,
                      color: totalGrade !== null ? getLetterGrade(totalGrade).color : "var(--ios-label-3)",
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
          <h2 className="ios-title-3" style={{ margin: "0 0 12px 0" }}>Assignments</h2>

          {assignments.length === 0 ? (
            <div className="ios-footnote" style={{
              background: "var(--ios-cell)",
              borderRadius: "var(--ios-radius-card)",
              padding: "32px 20px",
              textAlign: "center",
              color: "var(--ios-label-2)",
            }}>
              No assignments added yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Upcoming */}
              {upcoming.length > 0 && (
                <>
                  <div className="ios-caption" style={{
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--ios-label-3)",
                    marginBottom: 4,
                  }}>
                    Upcoming ({upcoming.length})
                  </div>
                  {upcoming.map((a) => {
                    const days = daysUntil(a.due_date);
                    const urgentColor = days === 0 ? "var(--ios-red)" : days <= 3 ? "#FF7A00" : days <= 7 ? "var(--ios-orange)" : colorTag;
                    const TypeIcon = TYPE_ICON[a.type] ?? Icons.BellIcon;
                    return (
                      <div
                        key={a.id}
                        style={{
                          background: "var(--ios-cell)",
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
                          <TypeIcon style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2, color: urgentColor }} />
                          <div>
                            <div className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)" }}>
                              {a.title}
                            </div>
                            {a.description && (
                              <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 2 }}>
                                {a.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div className="ios-footnote ios-num" style={{ fontWeight: 600, color: urgentColor }}>
                            {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                          </div>
                          <div className="ios-caption ios-num" style={{ color: "var(--ios-label-3)" }}>
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
                  <div className="ios-caption" style={{
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--ios-label-3)",
                    marginTop: 12,
                    marginBottom: 4,
                  }}>
                    Past ({past.length})
                  </div>
                  {past.map((a) => {
                    const TypeIcon = TYPE_ICON[a.type] ?? Icons.BellIcon;
                    return (
                      <div
                        key={a.id}
                        style={{
                          background: "var(--ios-cell)",
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
                          {a.is_completed ? (
                            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ios-green)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 2 }}>
                              <path d="M5 12l5 5 9-11" />
                            </svg>
                          ) : (
                            <TypeIcon style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2, color: "var(--ios-label-3)" }} />
                          )}
                          <div className="ios-subhead" style={{ color: "var(--ios-label-2)", textDecoration: a.is_completed ? "line-through" : "none" }}>
                            {a.title}
                          </div>
                        </div>
                        <div className="ios-caption ios-num" style={{ color: "var(--ios-label-3)", flexShrink: 0 }}>
                          {formatDate(a.due_date)}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
