"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface GradeComponent {
  id: string;
  category: string;
  weight: number;
  points_earned: number | null;
  points_possible: number | null;
  notes: string | null;
  sort_order: number;
}

interface GradesTabProps {
  courseId: string;
  colorTag: string;
}

type EditingCell = { id: string; field: keyof GradeComponent } | null;

const DEFAULT_CATEGORIES = [
  "Homework",
  "Quizzes",
  "Midterm",
  "Final Exam",
  "Participation",
];

function getLetterGrade(pct: number): { letter: string; color: string } {
  if (pct >= 90) return { letter: "A", color: "#16a34a" };
  if (pct >= 80) return { letter: "B", color: "#2563eb" };
  if (pct >= 70) return { letter: "C", color: "#ca8a04" };
  if (pct >= 60) return { letter: "D", color: "#ea580c" };
  return { letter: "F", color: "#dc2626" };
}

function calcContribution(row: GradeComponent): number | null {
  if (
    row.points_earned === null ||
    row.points_possible === null ||
    row.points_possible === 0
  ) {
    return null;
  }
  return (row.points_earned / row.points_possible) * row.weight;
}

export default function GradesTab({ courseId, colorTag }: GradesTabProps) {
  const [rows, setRows] = useState<GradeComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingRow, setAddingRow] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const loadGrades = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/student-support/grades?courseId=${courseId}`);
      if (!res.ok) throw new Error("Failed to load grade components");
      const data = await res.json();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load grades");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadGrades();
  }, [loadGrades]);

  // ── Derived totals ──────────────────────────────────────────────
  const totalWeight = rows.reduce((sum, r) => sum + (r.weight ?? 0), 0);
  const contributions = rows.map(calcContribution);
  const totalGrade = contributions.every((c) => c === null)
    ? null
    : contributions.reduce<number>((sum, c) => sum + (c ?? 0), 0);

  // ── Inline edit helpers ─────────────────────────────────────────
  const startEdit = (id: string, field: keyof GradeComponent, currentValue: unknown) => {
    setEditingCell({ id, field });
    setEditValue(currentValue === null || currentValue === undefined ? "" : String(currentValue));
    // Focus happens via the input ref callback
  };

  const handleBlur = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    setEditingCell(null);

    const row = rows.find((r) => r.id === id);
    if (!row) return;

    // Parse to appropriate type
    let parsed: string | number | null = editValue.trim() === "" ? null : editValue.trim();
    if (field === "weight" || field === "points_earned" || field === "points_possible" || field === "sort_order") {
      parsed = editValue.trim() === "" ? null : parseFloat(editValue.trim());
      if (parsed !== null && isNaN(parsed as number)) parsed = null;
    }

    // No change — skip PATCH
    if (parsed === (row[field] ?? null)) return;

    const updated = { ...row, [field]: parsed };
    setRows((prev) => prev.map((r) => r.id === id ? updated : r));

    setSavingId(id);
    try {
      await fetch("/api/student-support/grades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          category: updated.category,
          weight: updated.weight,
          points_earned: updated.points_earned,
          points_possible: updated.points_possible,
        }),
      });
    } catch (e) {
      console.error("Failed to save grade component", e);
    } finally {
      setSavingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      inputRef.current?.blur();
    }
  };

  // ── Add row ─────────────────────────────────────────────────────
  const handleAddRow = async (category: string = "New Category") => {
    setAddingRow(true);
    setShowSuggestions(false);
    try {
      const res = await fetch("/api/student-support/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          category,
          weight: 0,
          points_earned: null,
          points_possible: null,
          notes: null,
          sort_order: rows.length,
        }),
      });
      if (!res.ok) throw new Error("Failed to add row");
      const newRow = await res.json();
      setRows((prev) => [...prev, newRow]);
    } catch (e) {
      console.error("Failed to add grade component", e);
    } finally {
      setAddingRow(false);
    }
  };

  // ── Delete row ──────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/student-support/grades?id=${id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error("Failed to delete grade component", e);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Cell renderer ───────────────────────────────────────────────
  const EditableCell = ({
    rowId,
    field,
    value,
    placeholder,
    align = "left",
  }: {
    rowId: string;
    field: keyof GradeComponent;
    value: string | number | null;
    placeholder?: string;
    align?: "left" | "right" | "center";
  }) => {
    const isEditing = editingCell?.id === rowId && editingCell?.field === field;
    const displayValue = value === null || value === undefined ? "" : String(value);
    const isSaving = savingId === rowId;

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: "4px 6px",
            border: `1px solid ${colorTag}`,
            borderRadius: 4,
            fontSize: 13,
            fontFamily: "inherit",
            background: "var(--color-bg)",
            color: "var(--color-ink)",
            outline: "none",
            textAlign: align,
            boxSizing: "border-box",
          }}
        />
      );
    }

    return (
      <div
        onClick={() => startEdit(rowId, field, value)}
        title="Click to edit"
        style={{
          padding: "4px 6px",
          minHeight: 28,
          borderRadius: 4,
          cursor: "text",
          fontSize: 13,
          color: displayValue ? "var(--color-ink)" : "var(--color-ink-3)",
          textAlign: align,
          opacity: isSaving ? 0.5 : 1,
          transition: "background 0.15s",
          userSelect: "none",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = "var(--color-paper-deep)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }}
      >
        {displayValue || (
          <span style={{ fontStyle: "italic", fontSize: 12 }}>{placeholder ?? "—"}</span>
        )}
      </div>
    );
  };

  // ── Loading / error states ──────────────────────────────────────
  if (loading) {
    return (
      <div style={{ color: "var(--color-ink-3)", fontSize: 13, paddingTop: 24 }}>
        Loading grade components…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: "12px 16px",
        borderRadius: 8,
        background: "#fee2e2",
        color: "#991b1b",
        fontSize: 13,
        marginTop: 8,
      }}>
        {error}
      </div>
    );
  }

  // ── Grade summary badge ─────────────────────────────────────────
  const { letter, color: badgeColor } = totalGrade !== null
    ? getLetterGrade(totalGrade)
    : { letter: "—", color: "var(--color-ink-3)" };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div>
      {/* Header row */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 24,
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div>
          <h2
            className="serif"
            style={{
              fontSize: 20,
              fontWeight: 700,
              margin: "0 0 4px 0",
              color: "var(--color-ink)",
            }}
          >
            Grade Tracker
          </h2>
          <p style={{ fontSize: 12, color: "var(--color-ink-3)", margin: 0 }}>
            Click any cell to edit. Changes save automatically on blur.
          </p>
        </div>

        {/* Overall grade badge */}
        {rows.length > 0 && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: badgeColor + "18",
            border: `2px solid ${badgeColor}`,
            borderRadius: 12,
            padding: "12px 20px",
            minWidth: 100,
          }}>
            <div style={{
              fontSize: 48,
              fontWeight: 800,
              lineHeight: 1,
              color: badgeColor,
              fontFamily: "serif",
            }}>
              {letter}
            </div>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: badgeColor,
              marginTop: 4,
            }}>
              {totalGrade !== null ? `${totalGrade.toFixed(1)}%` : "No data"}
            </div>
            <div style={{
              fontSize: 10,
              color: "var(--color-ink-3)",
              marginTop: 2,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}>
              Overall
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {rows.length === 0 && !addingRow ? (
        <div style={{
          background: "var(--color-bg-card)",
          border: "1px dashed var(--color-rule)",
          borderRadius: 12,
          padding: "48px 24px",
          textAlign: "center",
          color: "var(--color-ink-3)",
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <p style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--color-ink-2)",
            margin: "0 0 8px 0",
          }}>
            No grade components yet
          </p>
          <p style={{ fontSize: 12, margin: "0 0 20px 0" }}>
            Add categories like Homework, Midterm, or Final Exam to start tracking your grade.
          </p>
          <button
            onClick={() => setShowSuggestions(true)}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: colorTag,
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add First Component
          </button>
        </div>
      ) : (
        /* Grade table */
        <div style={{ overflowX: "auto", marginBottom: 16 }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}>
            <thead>
              <tr style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                background: colorTag + "15",
                borderBottom: `2px solid ${colorTag}`,
              }}>
                {["Category", "Weight %", "Points Earned", "Points Possible", "Contribution", "Actions"].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "10px 10px",
                      textAlign: col === "Actions" ? "center" : col === "Weight %" || col === "Points Earned" || col === "Points Possible" || col === "Contribution" ? "right" : "left",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
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
              {rows.map((row, idx) => {
                const contribution = calcContribution(row);
                const isDeleting = deletingId === row.id;

                return (
                  <tr
                    key={row.id}
                    style={{
                      background: idx % 2 === 0 ? "var(--color-bg-card)" : "var(--color-bg)",
                      opacity: isDeleting ? 0.4 : 1,
                      transition: "opacity 0.2s",
                    }}
                  >
                    {/* Category */}
                    <td style={{ padding: "4px 10px", borderBottom: "1px solid var(--color-rule)" }}>
                      <EditableCell
                        rowId={row.id}
                        field="category"
                        value={row.category}
                        placeholder="e.g. Homework"
                      />
                    </td>

                    {/* Weight % */}
                    <td style={{ padding: "4px 10px", borderBottom: "1px solid var(--color-rule)" }}>
                      <EditableCell
                        rowId={row.id}
                        field="weight"
                        value={row.weight}
                        placeholder="0"
                        align="right"
                      />
                    </td>

                    {/* Points Earned */}
                    <td style={{ padding: "4px 10px", borderBottom: "1px solid var(--color-rule)" }}>
                      <EditableCell
                        rowId={row.id}
                        field="points_earned"
                        value={row.points_earned}
                        placeholder="—"
                        align="right"
                      />
                    </td>

                    {/* Points Possible */}
                    <td style={{ padding: "4px 10px", borderBottom: "1px solid var(--color-rule)" }}>
                      <EditableCell
                        rowId={row.id}
                        field="points_possible"
                        value={row.points_possible}
                        placeholder="—"
                        align="right"
                      />
                    </td>

                    {/* Contribution */}
                    <td style={{
                      padding: "4px 10px",
                      borderBottom: "1px solid var(--color-rule)",
                      textAlign: "right",
                      fontWeight: contribution !== null ? 600 : 400,
                      color: contribution !== null ? colorTag : "var(--color-ink-3)",
                      whiteSpace: "nowrap",
                    }}>
                      {contribution !== null ? `${contribution.toFixed(1)}%` : "—"}
                    </td>

                    {/* Actions */}
                    <td style={{
                      padding: "4px 10px",
                      borderBottom: "1px solid var(--color-rule)",
                      textAlign: "center",
                    }}>
                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={isDeleting}
                        title="Delete row"
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          border: "1px solid #fecaca",
                          background: "#fee2e2",
                          color: "#991b1b",
                          fontSize: 14,
                          lineHeight: 1,
                          cursor: isDeleting ? "default" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 600,
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totals footer */}
            {rows.length > 0 && (
              <tfoot>
                <tr style={{
                  background: "var(--color-paper-deep)",
                  borderTop: `2px solid ${colorTag}`,
                }}>
                  <td style={{
                    padding: "10px 10px",
                    fontWeight: 700,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--color-ink-2)",
                  }}>
                    Total Weight
                  </td>
                  <td style={{
                    padding: "10px 10px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: Math.abs(totalWeight - 100) < 0.01 ? "#16a34a" : "var(--color-ink)",
                  }}>
                    {totalWeight.toFixed(1)}%
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--color-ink-3)" }}>—</td>
                  <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--color-ink-3)" }}>—</td>
                  <td style={{
                    padding: "10px 10px",
                    textAlign: "right",
                    fontWeight: 800,
                    fontSize: 14,
                    color: totalGrade !== null ? getLetterGrade(totalGrade).color : "var(--color-ink-3)",
                  }}>
                    {totalGrade !== null ? `${totalGrade.toFixed(1)}%` : "—"}
                  </td>
                  <td style={{ padding: "10px 10px" }} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Add row button + suggestions */}
      <div style={{ position: "relative", display: "inline-block" }}>
        <button
          onClick={() => setShowSuggestions((v) => !v)}
          disabled={addingRow}
          style={{
            padding: "7px 16px",
            borderRadius: 7,
            border: `1px dashed ${colorTag}`,
            background: "transparent",
            color: colorTag,
            fontSize: 12,
            fontWeight: 600,
            cursor: addingRow ? "default" : "pointer",
            opacity: addingRow ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!addingRow) (e.currentTarget as HTMLButtonElement).style.background = colorTag + "12";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          {addingRow ? "Adding…" : "+ Add Row"}
        </button>

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <div style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            minWidth: 180,
            overflow: "hidden",
          }}>
            <div style={{
              padding: "6px 12px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-ink-3)",
              borderBottom: "1px solid var(--color-rule)",
            }}>
              Quick Add
            </div>
            {DEFAULT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleAddRow(cat)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 14px",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  fontSize: 13,
                  color: "var(--color-ink)",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--color-paper-deep)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                {cat}
              </button>
            ))}
            <div style={{ borderTop: "1px solid var(--color-rule)" }}>
              <button
                onClick={() => handleAddRow("New Category")}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 14px",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  fontSize: 13,
                  color: colorTag,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--color-paper-deep)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                + Custom category…
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Click-outside handler for suggestions */}
      {showSuggestions && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 49,
          }}
          onClick={() => setShowSuggestions(false)}
        />
      )}

      {/* Weight hint */}
      {rows.length > 0 && Math.abs(totalWeight - 100) > 0.01 && (
        <p style={{
          fontSize: 11,
          color: totalWeight > 100 ? "#dc2626" : "#ca8a04",
          marginTop: 10,
          marginBottom: 0,
        }}>
          {totalWeight > 100
            ? `Weights sum to ${totalWeight.toFixed(1)}% — reduce by ${(totalWeight - 100).toFixed(1)}%`
            : `Weights sum to ${totalWeight.toFixed(1)}% — ${(100 - totalWeight).toFixed(1)}% unassigned`}
        </p>
      )}
    </div>
  );
}
