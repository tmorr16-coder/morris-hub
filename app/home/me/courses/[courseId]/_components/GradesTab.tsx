"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Icons } from "@/components/ios";

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
  if (pct >= 90) return { letter: "A", color: "var(--ios-green)" };
  if (pct >= 80) return { letter: "B", color: "var(--ios-tint)" };
  if (pct >= 70) return { letter: "C", color: "var(--ios-orange)" };
  if (pct >= 60) return { letter: "D", color: "#FF7A00" };
  return { letter: "F", color: "var(--ios-red)" };
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
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/student-support/grades/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate grade components");
      }
      const data = await res.json();
      setRows(data.components ?? []);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

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
          className={align === "right" ? "ios-num" : undefined}
          style={{
            width: "100%",
            padding: "4px 6px",
            border: `1px solid ${colorTag}`,
            borderRadius: 6,
            fontSize: 14,
            fontFamily: "inherit",
            background: "var(--ios-bg)",
            color: "var(--ios-label)",
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
        title="Tap to edit"
        className={align === "right" ? "ios-num" : undefined}
        style={{
          padding: "4px 6px",
          minHeight: 28,
          borderRadius: 6,
          cursor: "text",
          fontSize: 14,
          color: displayValue ? "var(--ios-label)" : "var(--ios-label-3)",
          textAlign: align,
          opacity: isSaving ? 0.5 : 1,
          userSelect: "none",
        }}
      >
        {displayValue || (
          <span style={{ fontStyle: "italic", fontSize: 13 }}>{placeholder ?? "—"}</span>
        )}
      </div>
    );
  };

  // ── Loading / error states ──────────────────────────────────────
  if (loading) {
    return (
      <div className="ios-footnote" style={{ color: "var(--ios-label-2)", paddingTop: 24 }}>
        Loading grade components…
      </div>
    );
  }

  if (error) {
    return (
      <div className="ios-footnote" style={{
        padding: "12px 16px",
        borderRadius: 10,
        background: "var(--ios-cell)",
        color: "var(--ios-red)",
        marginTop: 8,
      }}>
        {error}
      </div>
    );
  }

  // ── Grade summary badge ─────────────────────────────────────────
  const { letter, color: badgeColor } = totalGrade !== null
    ? getLetterGrade(totalGrade)
    : { letter: "—", color: "var(--ios-label-3)" };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div>
      {/* Header row */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 20,
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div>
          <h2 className="ios-title-3" style={{ margin: "0 0 4px 0" }}>Grade Tracker</h2>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: 0 }}>
            Tap any cell to edit. Changes save automatically on blur.
          </p>
        </div>

        {/* Generate / Regenerate button */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            title={rows.length > 0 ? "Regenerate from course content" : "Generate grade structure from course content"}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              background: generating ? "var(--ios-fill)" : colorTag,
              color: generating ? "var(--ios-label-2)" : "#fff",
              fontSize: 13,
              fontWeight: 600,
              opacity: generating ? 0.9 : 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            {generating ? (
              <>
                <span style={{ display: "inline-flex", gap: 2 }}>
                  <span style={{ animation: "blink 0.7s infinite" }}>•</span>
                  <span style={{ animation: "blink 0.7s infinite 0.2s" }}>•</span>
                  <span style={{ animation: "blink 0.7s infinite 0.4s" }}>•</span>
                </span>
                Generating…
              </>
            ) : rows.length > 0 ? (
              "Regenerate"
            ) : (
              <>
                <Icons.SparkleIcon style={{ width: 15, height: 15 }} />
                Generate from Content
              </>
            )}
          </button>
          {generateError && (
            <span className="ios-caption" style={{ color: "var(--ios-red)", maxWidth: 220, textAlign: "right" }}>
              {generateError}
            </span>
          )}
        </div>
        <style>{`
          @keyframes blink {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
        `}</style>

        {/* Overall grade badge */}
        {rows.length > 0 && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "var(--ios-cell)",
            border: `2px solid ${badgeColor}`,
            borderRadius: "var(--ios-radius-tile)",
            padding: "12px 20px",
            minWidth: 100,
          }}>
            <div className="ios-num" style={{
              fontSize: 48,
              fontWeight: 800,
              lineHeight: 1,
              color: badgeColor,
            }}>
              {letter}
            </div>
            <div className="ios-footnote ios-num" style={{ fontWeight: 600, color: badgeColor, marginTop: 4 }}>
              {totalGrade !== null ? `${totalGrade.toFixed(1)}%` : "No data"}
            </div>
            <div className="ios-caption" style={{
              color: "var(--ios-label-3)",
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
          background: "var(--ios-cell)",
          borderRadius: "var(--ios-radius-card)",
          padding: "48px 24px",
          textAlign: "center",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "var(--ios-label-3)" }}>
            <Icons.ChartIcon style={{ width: 34, height: 34 }} />
          </div>
          <p className="ios-headline" style={{ margin: "0 0 8px 0" }}>No grade components yet</p>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: "0 0 20px 0" }}>
            Generate a grade structure from your course content, or add categories manually.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                padding: "9px 20px",
                borderRadius: 10,
                background: generating ? "var(--ios-fill)" : colorTag,
                color: generating ? "var(--ios-label-2)" : "#fff",
                fontSize: 14,
                fontWeight: 600,
                opacity: generating ? 0.9 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {generating ? "Generating…" : (
                <>
                  <Icons.SparkleIcon style={{ width: 15, height: 15 }} />
                  Generate from Content
                </>
              )}
            </button>
            <button
              onClick={() => setShowSuggestions(true)}
              style={{
                padding: "9px 20px",
                borderRadius: 10,
                border: `1px solid ${colorTag}`,
                background: "transparent",
                color: colorTag,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Add Manually
            </button>
          </div>
          {generateError && (
            <p className="ios-footnote" style={{ color: "var(--ios-red)", marginTop: 12 }}>{generateError}</p>
          )}
        </div>
      ) : (
        /* Grade table */
        <div style={{ overflowX: "auto", marginBottom: 16, background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
          }}>
            <thead>
              <tr style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                background: "var(--ios-fill-2)",
                borderBottom: `2px solid ${colorTag}`,
              }}>
                {["Category", "Weight %", "Points Earned", "Points Possible", "Contribution", ""].map((col, i) => (
                  <th
                    key={col || `col-${i}`}
                    className="ios-caption"
                    style={{
                      padding: "10px 10px",
                      textAlign: col === "" ? "center" : col === "Weight %" || col === "Points Earned" || col === "Points Possible" || col === "Contribution" ? "right" : "left",
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
              {rows.map((row) => {
                const contribution = calcContribution(row);
                const isDeleting = deletingId === row.id;

                return (
                  <tr
                    key={row.id}
                    style={{
                      opacity: isDeleting ? 0.4 : 1,
                      transition: "opacity 0.2s",
                    }}
                  >
                    {/* Category */}
                    <td style={{ padding: "4px 10px", borderBottom: "var(--ios-hair) solid var(--ios-separator)" }}>
                      <EditableCell
                        rowId={row.id}
                        field="category"
                        value={row.category}
                        placeholder="e.g. Homework"
                      />
                    </td>

                    {/* Weight % */}
                    <td style={{ padding: "4px 10px", borderBottom: "var(--ios-hair) solid var(--ios-separator)" }}>
                      <EditableCell
                        rowId={row.id}
                        field="weight"
                        value={row.weight}
                        placeholder="0"
                        align="right"
                      />
                    </td>

                    {/* Points Earned */}
                    <td style={{ padding: "4px 10px", borderBottom: "var(--ios-hair) solid var(--ios-separator)" }}>
                      <EditableCell
                        rowId={row.id}
                        field="points_earned"
                        value={row.points_earned}
                        placeholder="—"
                        align="right"
                      />
                    </td>

                    {/* Points Possible */}
                    <td style={{ padding: "4px 10px", borderBottom: "var(--ios-hair) solid var(--ios-separator)" }}>
                      <EditableCell
                        rowId={row.id}
                        field="points_possible"
                        value={row.points_possible}
                        placeholder="—"
                        align="right"
                      />
                    </td>

                    {/* Contribution */}
                    <td className="ios-num" style={{
                      padding: "4px 10px",
                      borderBottom: "var(--ios-hair) solid var(--ios-separator)",
                      textAlign: "right",
                      fontWeight: contribution !== null ? 600 : 400,
                      color: contribution !== null ? colorTag : "var(--ios-label-3)",
                      whiteSpace: "nowrap",
                    }}>
                      {contribution !== null ? `${contribution.toFixed(1)}%` : "—"}
                    </td>

                    {/* Actions */}
                    <td style={{
                      padding: "4px 10px",
                      borderBottom: "var(--ios-hair) solid var(--ios-separator)",
                      textAlign: "center",
                    }}>
                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={isDeleting}
                        aria-label="Delete row"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          color: "var(--ios-red)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
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
                  background: "var(--ios-fill-2)",
                  borderTop: `2px solid ${colorTag}`,
                }}>
                  <td className="ios-caption" style={{
                    padding: "10px 10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--ios-label-2)",
                  }}>
                    Total Weight
                  </td>
                  <td className="ios-num" style={{
                    padding: "10px 10px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: Math.abs(totalWeight - 100) < 0.01 ? "var(--ios-green)" : "var(--ios-label)",
                  }}>
                    {totalWeight.toFixed(1)}%
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--ios-label-3)" }}>—</td>
                  <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--ios-label-3)" }}>—</td>
                  <td className="ios-num" style={{
                    padding: "10px 10px",
                    textAlign: "right",
                    fontWeight: 800,
                    fontSize: 15,
                    color: totalGrade !== null ? getLetterGrade(totalGrade).color : "var(--ios-label-3)",
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
            padding: "8px 16px",
            borderRadius: 10,
            border: `1px solid ${colorTag}`,
            background: "transparent",
            color: colorTag,
            fontSize: 13,
            fontWeight: 600,
            opacity: addingRow ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {addingRow ? "Adding…" : (
            <>
              <Icons.PlusIcon style={{ width: 15, height: 15 }} />
              Add Row
            </>
          )}
        </button>

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <div style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            background: "var(--ios-bg-elevated)",
            borderRadius: 12,
            boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
            minWidth: 200,
            overflow: "hidden",
          }}>
            <div className="ios-caption" style={{
              padding: "8px 14px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ios-label-3)",
              borderBottom: "var(--ios-hair) solid var(--ios-separator)",
            }}>
              Quick Add
            </div>
            {DEFAULT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleAddRow(cat)}
                className="ios-body"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 14px",
                  textAlign: "left",
                  color: "var(--ios-label)",
                  borderBottom: "var(--ios-hair) solid var(--ios-separator)",
                }}
              >
                {cat}
              </button>
            ))}
            <button
              onClick={() => handleAddRow("New Category")}
              className="ios-body"
              style={{
                display: "block",
                width: "100%",
                padding: "10px 14px",
                textAlign: "left",
                color: "var(--ios-tint)",
                fontWeight: 500,
              }}
            >
              Custom category…
            </button>
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
        <p className="ios-caption ios-num" style={{
          color: totalWeight > 100 ? "var(--ios-red)" : "var(--ios-orange)",
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
