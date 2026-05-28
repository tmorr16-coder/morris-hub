"use client";

import { useState, useEffect, useCallback } from "react";

// Map schedule item_type → course_reminders.type
// All item types can become reminders; unmapped types default to "assignment"
const REMINDER_TYPE_MAP: Record<string, string> = {
  assignment: "assignment",
  exam:       "test",
  quiz:       "quiz",
  practice:   "practice",
  study:      "assignment",
  reading:    "assignment",
  review:     "assignment",
  other:      "assignment",
};

interface ScheduleItem {
  id: string;
  schedule_id: string;
  title: string;
  description: string | null;
  item_type: string;
  scheduled_date: string | null;
  duration_minutes: number | null;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
}

interface ScheduleTabProps {
  courseId: string;
  courseName: string;
  colorTag: string;
}

const TYPE_META: Record<string, { label: string; color: string; emoji: string }> = {
  study:      { label: "Study",      color: "#3b82f6", emoji: "📖" },
  reading:    { label: "Reading",    color: "#6366f1", emoji: "📄" },
  review:     { label: "Review",     color: "#8b5cf6", emoji: "🔍" },
  assignment: { label: "Assignment", color: "#f59e0b", emoji: "📝" },
  exam:       { label: "Exam",       color: "#ef4444", emoji: "🎓" },
  quiz:       { label: "Quiz",       color: "#ec4899", emoji: "❓" },
  practice:   { label: "Practice",   color: "#10b981", emoji: "🎯" },
  other:      { label: "Other",      color: "#6b7280", emoji: "📌" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "No date";
  const d = new Date(dateStr + "T12:00:00"); // noon to avoid TZ-shift issues
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function groupByWeek(items: ScheduleItem[]): Map<string, ScheduleItem[]> {
  const map = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const key = item.scheduled_date
      ? (() => {
          const d = new Date(item.scheduled_date + "T12:00:00");
          // Monday of that week
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(d.setDate(diff));
          return monday.toISOString().split("T")[0];
        })()
      : "undated";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  // Sort by week key
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function weekLabel(weekKey: string): string {
  if (weekKey === "undated") return "No date assigned";
  const d = new Date(weekKey + "T12:00:00");
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export default function ScheduleTab({ courseId, courseName, colorTag }: ScheduleTabProps) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ScheduleItem>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingReminderId, setAddingReminderId] = useState<string | null>(null);
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/student-support/schedule?courseId=${courseId}`);
      if (res.ok) {
        const data = await res.json();
        setHasSchedule(!!data.schedule);
        setItems(data.items ?? []);
      }
    } catch (e) {
      console.error("Failed to load schedule", e);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/student-support/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setItems(data.items ?? []);
      setHasSchedule(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate schedule");
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleComplete = async (item: ScheduleItem) => {
    const next = !item.is_completed;
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_completed: next } : i));
    await fetch(`/api/student-support/schedule/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_completed: next }),
    });
  };

  const handleStartEdit = (item: ScheduleItem) => {
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      description: item.description ?? "",
      item_type: item.item_type,
      scheduled_date: item.scheduled_date ?? "",
      duration_minutes: item.duration_minutes ?? undefined,
    });
  };

  const handleSaveEdit = async (id: string) => {
    const res = await fetch(`/api/student-support/schedule/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((i) => i.id === id ? updated : i));
    }
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const res = await fetch(`/api/student-support/schedule/items/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    setDeletingId(null);
  };

  const handleAddReminder = async (item: ScheduleItem) => {
    if (!item.scheduled_date) return;
    setAddingReminderId(item.id);
    try {
      const res = await fetch("/api/student-support/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          type: REMINDER_TYPE_MAP[item.item_type] ?? "assignment",
          title: item.title,
          description: item.description ?? null,
          due_date: item.scheduled_date,
        }),
      });
      if (res.ok) {
        setRemindedIds((prev) => new Set([...prev, item.id]));
      }
    } catch (e) {
      console.error("Failed to add reminder", e);
    } finally {
      setAddingReminderId(null);
    }
  };

  const grouped = groupByWeek(items);
  const completedCount = items.filter((i) => i.is_completed).length;
  const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  if (loading) {
    return (
      <div style={{ color: "var(--color-ink-3)", fontSize: 13, paddingTop: 24 }}>
        Loading schedule...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px 0" }}>Study Schedule</h2>
          {hasSchedule && items.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 160, height: 6, background: "var(--color-rule)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: colorTag, borderRadius: 3, transition: "width 0.3s" }} />
              </div>
              <span style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
                {completedCount}/{items.length} done
              </span>
            </div>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: generating ? "var(--color-paper-deep)" : colorTag,
            color: "white",
            fontSize: 12,
            fontWeight: 600,
            cursor: generating ? "not-allowed" : "pointer",
            opacity: generating ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {generating ? "Generating…" : hasSchedule ? "↺ Regenerate Schedule" : "✨ Generate Schedule"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "#fee2e2", color: "#991b1b", fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!hasSchedule && !generating && (
        <div style={{
          background: "var(--color-bg-card)",
          border: "1px dashed var(--color-rule)",
          borderRadius: 12,
          padding: "48px 24px",
          textAlign: "center",
          color: "var(--color-ink-3)",
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-ink-2)", margin: "0 0 8px" }}>
            No schedule yet
          </p>
          <p style={{ fontSize: 12, margin: 0 }}>
            Upload course materials and click <strong>Generate Schedule</strong> — Claude will create a week-by-week study plan based on your content and deadlines.
          </p>
        </div>
      )}

      {/* Generating spinner */}
      {generating && (
        <div style={{ padding: "32px 0", textAlign: "center", color: "var(--color-ink-3)", fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>Building your schedule…</div>
          <div style={{ fontSize: 11 }}>Claude is reading your course materials — this takes about 10 seconds.</div>
        </div>
      )}

      {/* Schedule grouped by week */}
      {!generating && hasSchedule && (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {[...grouped.entries()].map(([weekKey, weekItems]) => (
            <div key={weekKey}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--color-ink-3)",
                marginBottom: 10,
                paddingBottom: 6,
                borderBottom: "1px solid var(--color-rule)",
              }}>
                {weekLabel(weekKey)}
                <span style={{ marginLeft: 8, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                  ({weekItems.filter((i) => i.is_completed).length}/{weekItems.length} done)
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {weekItems.map((item) => {
                  const meta = TYPE_META[item.item_type] ?? TYPE_META.other;
                  const isEditing = editingId === item.id;

                  if (isEditing) {
                    return (
                      <div key={item.id} style={{
                        background: "var(--color-bg-card)",
                        border: `1px solid ${colorTag}`,
                        borderRadius: 8,
                        padding: "14px 16px",
                      }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                          <div style={{ gridColumn: "1/-1" }}>
                            <input
                              autoFocus
                              value={editForm.title ?? ""}
                              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                              style={{ width: "100%", padding: "6px 10px", borderRadius: 5, border: "1px solid var(--color-rule)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "var(--color-ink-3)", display: "block", marginBottom: 4 }}>TYPE</label>
                            <select
                              value={editForm.item_type ?? "study"}
                              onChange={(e) => setEditForm({ ...editForm, item_type: e.target.value })}
                              style={{ width: "100%", padding: "6px 10px", borderRadius: 5, border: "1px solid var(--color-rule)", fontSize: 12, fontFamily: "inherit" }}
                            >
                              {Object.entries(TYPE_META).map(([k, v]) => (
                                <option key={k} value={k}>{v.emoji} {v.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "var(--color-ink-3)", display: "block", marginBottom: 4 }}>DATE</label>
                            <input
                              type="date"
                              value={editForm.scheduled_date ?? ""}
                              onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
                              style={{ width: "100%", padding: "6px 10px", borderRadius: 5, border: "1px solid var(--color-rule)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "var(--color-ink-3)", display: "block", marginBottom: 4 }}>DURATION (min)</label>
                            <input
                              type="number"
                              min={15}
                              step={15}
                              value={editForm.duration_minutes ?? ""}
                              onChange={(e) => setEditForm({ ...editForm, duration_minutes: parseInt(e.target.value) || undefined })}
                              style={{ width: "100%", padding: "6px 10px", borderRadius: 5, border: "1px solid var(--color-rule)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }}
                            />
                          </div>
                          <div style={{ gridColumn: "1/-1" }}>
                            <label style={{ fontSize: 10, fontWeight: 600, color: "var(--color-ink-3)", display: "block", marginBottom: 4 }}>NOTES</label>
                            <textarea
                              value={editForm.description ?? ""}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              rows={2}
                              style={{ width: "100%", padding: "6px 10px", borderRadius: 5, border: "1px solid var(--color-rule)", fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                            />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button onClick={() => setEditingId(null)} style={{ padding: "5px 12px", borderRadius: 5, border: "1px solid var(--color-rule)", background: "transparent", fontSize: 12, cursor: "pointer" }}>
                            Cancel
                          </button>
                          <button onClick={() => handleSaveEdit(item.id)} style={{ padding: "5px 12px", borderRadius: 5, border: "none", background: colorTag, color: "white", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={item.id} style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      background: "var(--color-bg-card)",
                      border: "1px solid var(--color-rule)",
                      borderRadius: 8,
                      padding: "12px 14px",
                      opacity: item.is_completed ? 0.6 : 1,
                      transition: "opacity 0.2s",
                    }}>
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggleComplete(item)}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: `2px solid ${item.is_completed ? colorTag : "var(--color-rule)"}`,
                          background: item.is_completed ? colorTag : "transparent",
                          cursor: "pointer",
                          flexShrink: 0,
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: 10,
                        }}
                        title={item.is_completed ? "Mark incomplete" : "Mark complete"}
                      >
                        {item.is_completed && "✓"}
                      </button>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: 10,
                            background: `${meta.color}18`,
                            color: meta.color,
                          }}>
                            {meta.emoji} {meta.label}
                          </span>
                          <span style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "var(--color-ink)",
                            textDecoration: item.is_completed ? "line-through" : "none",
                          }}>
                            {item.title}
                          </span>
                        </div>

                        {item.description && (
                          <p style={{ fontSize: 12, color: "var(--color-ink-3)", margin: "5px 0 0 0" }}>
                            {item.description}
                          </p>
                        )}

                        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "var(--color-ink-4)" }}>
                          <span>📅 {formatDate(item.scheduled_date)}</span>
                          {item.duration_minutes && <span>⏱ {item.duration_minutes} min</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                        {/* Remind button — any item with a date can become a platform reminder */}
                        {item.scheduled_date && (
                          remindedIds.has(item.id) ? (
                            <span style={{
                              padding: "4px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              color: "#16a34a",
                              fontWeight: 600,
                            }}>
                              ✓ Reminded
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddReminder(item)}
                              disabled={addingReminderId === item.id}
                              title="Add to platform reminders"
                              style={{
                                padding: "4px 8px",
                                borderRadius: 4,
                                border: `1px solid ${colorTag}50`,
                                background: `${colorTag}10`,
                                color: colorTag,
                                fontSize: 11,
                                cursor: addingReminderId === item.id ? "default" : "pointer",
                                opacity: addingReminderId === item.id ? 0.6 : 1,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {addingReminderId === item.id ? "…" : "🔔 Remind"}
                            </button>
                          )
                        )}
                        <button
                          onClick={() => handleStartEdit(item)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            border: "1px solid var(--color-rule)",
                            background: "transparent",
                            fontSize: 11,
                            cursor: "pointer",
                            color: "var(--color-ink-3)",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            border: "1px solid #fecaca",
                            background: "#fee2e2",
                            color: "#991b1b",
                            fontSize: 11,
                            cursor: "pointer",
                            opacity: deletingId === item.id ? 0.5 : 1,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
