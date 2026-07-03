"use client";

import { useState, useEffect, useCallback } from "react";
import type { ComponentType, SVGProps } from "react";
import { Icons } from "@/components/ios";

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

const TYPE_META: Record<string, { label: string; color: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  study:      { label: "Study",      color: "var(--ios-tint)",   Icon: Icons.BookIcon },
  reading:    { label: "Reading",    color: "#5856D6",           Icon: Icons.NewsIcon },
  review:     { label: "Review",     color: "#AF52DE",           Icon: Icons.SparkleIcon },
  assignment: { label: "Assignment", color: "var(--ios-orange)", Icon: Icons.ChecklistIcon },
  exam:       { label: "Exam",       color: "var(--ios-red)",    Icon: Icons.ComposeIcon },
  quiz:       { label: "Quiz",       color: "#FF2D55",           Icon: Icons.BookIcon },
  practice:   { label: "Practice",   color: "var(--ios-green)",  Icon: Icons.ChartIcon },
  other:      { label: "Other",      color: "var(--ios-label-2)", Icon: Icons.CalendarIcon },
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "var(--ios-hair) solid var(--ios-separator)",
  background: "var(--ios-cell)",
  color: "var(--ios-label)",
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
  colorScheme: "light dark",
};

const editLabel: React.CSSProperties = { display: "block", marginBottom: 4, color: "var(--ios-label-3)", textTransform: "uppercase", letterSpacing: "0.06em" };

function ClockIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}

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
      <div className="ios-footnote" style={{ color: "var(--ios-label-2)", paddingTop: 24 }}>
        Loading schedule…
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 className="ios-title-3" style={{ margin: "0 0 4px 0" }}>Study Schedule</h2>
          {hasSchedule && items.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 160, height: 6, background: "var(--ios-fill)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: colorTag, borderRadius: 3, transition: "width 0.3s" }} />
              </div>
              <span className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)" }}>
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
          {generating ? "Generating…" : hasSchedule ? "Regenerate" : (
            <>
              <Icons.SparkleIcon style={{ width: 15, height: 15 }} />
              Generate Schedule
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="ios-footnote" style={{ padding: "10px 14px", borderRadius: 10, background: "var(--ios-cell)", color: "var(--ios-red)", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!hasSchedule && !generating && (
        <div style={{
          background: "var(--ios-cell)",
          borderRadius: "var(--ios-radius-card)",
          padding: "48px 24px",
          textAlign: "center",
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "var(--ios-label-3)" }}>
            <Icons.CalendarIcon style={{ width: 34, height: 34 }} />
          </div>
          <p className="ios-headline" style={{ margin: "0 0 8px" }}>No schedule yet</p>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: 0 }}>
            Upload course materials and tap <strong>Generate Schedule</strong> — Morris will create a week-by-week study plan based on your content and deadlines.
          </p>
        </div>
      )}

      {/* Generating spinner */}
      {generating && (
        <div style={{ padding: "32px 0", textAlign: "center" }}>
          <div className="ios-body" style={{ color: "var(--ios-label-2)", marginBottom: 8 }}>Building your schedule…</div>
          <div className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>Reading your course materials — this takes about 10 seconds.</div>
        </div>
      )}

      {/* Schedule grouped by week */}
      {!generating && hasSchedule && (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {[...grouped.entries()].map(([weekKey, weekItems]) => (
            <div key={weekKey}>
              <div className="ios-caption" style={{
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ios-label-3)",
                marginBottom: 10,
                paddingBottom: 6,
                borderBottom: "var(--ios-hair) solid var(--ios-separator)",
              }}>
                {weekLabel(weekKey)}
                <span className="ios-num" style={{ marginLeft: 8, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
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
                        background: "var(--ios-cell)",
                        border: `1px solid ${colorTag}`,
                        borderRadius: "var(--ios-radius-card)",
                        padding: "14px 16px",
                      }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                          <div style={{ gridColumn: "1/-1" }}>
                            <input
                              autoFocus
                              value={editForm.title ?? ""}
                              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label className="ios-caption" style={editLabel}>Type</label>
                            <select
                              value={editForm.item_type ?? "study"}
                              onChange={(e) => setEditForm({ ...editForm, item_type: e.target.value })}
                              style={inputStyle}
                            >
                              {Object.entries(TYPE_META).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="ios-caption" style={editLabel}>Date</label>
                            <input
                              type="date"
                              value={editForm.scheduled_date ?? ""}
                              onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label className="ios-caption" style={editLabel}>Duration (min)</label>
                            <input
                              type="number"
                              min={15}
                              step={15}
                              value={editForm.duration_minutes ?? ""}
                              onChange={(e) => setEditForm({ ...editForm, duration_minutes: parseInt(e.target.value) || undefined })}
                              style={inputStyle}
                            />
                          </div>
                          <div style={{ gridColumn: "1/-1" }}>
                            <label className="ios-caption" style={editLabel}>Notes</label>
                            <textarea
                              value={editForm.description ?? ""}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              rows={2}
                              style={{ ...inputStyle, resize: "vertical" }}
                            />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button onClick={() => setEditingId(null)} className="ios-footnote" style={{ padding: "6px 14px", borderRadius: 8, background: "var(--ios-fill)", fontWeight: 600 }}>
                            Cancel
                          </button>
                          <button onClick={() => handleSaveEdit(item.id)} className="ios-footnote" style={{ padding: "6px 14px", borderRadius: 8, background: colorTag, color: "#fff", fontWeight: 600 }}>
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
                      background: "var(--ios-cell)",
                      borderRadius: "var(--ios-radius-card)",
                      padding: "12px 14px",
                      opacity: item.is_completed ? 0.6 : 1,
                      transition: "opacity 0.2s",
                    }}>
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggleComplete(item)}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          border: `2px solid ${item.is_completed ? colorTag : "var(--ios-separator)"}`,
                          background: item.is_completed ? colorTag : "transparent",
                          flexShrink: 0,
                          marginTop: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                        }}
                        aria-label={item.is_completed ? "Mark incomplete" : "Mark complete"}
                      >
                        {item.is_completed && (
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M5 12l5 5 9-11" />
                          </svg>
                        )}
                      </button>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span className="ios-caption" style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "var(--ios-fill)",
                            color: meta.color,
                          }}>
                            <meta.Icon style={{ width: 12, height: 12 }} />
                            {meta.label}
                          </span>
                          <span className="ios-subhead" style={{
                            fontWeight: 500,
                            color: "var(--ios-label)",
                            textDecoration: item.is_completed ? "line-through" : "none",
                          }}>
                            {item.title}
                          </span>
                        </div>

                        {item.description && (
                          <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: "5px 0 0 0" }}>
                            {item.description}
                          </p>
                        )}

                        <div className="ios-caption ios-num" style={{ display: "flex", gap: 12, marginTop: 6, color: "var(--ios-label-3)" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Icons.CalendarIcon style={{ width: 12, height: 12 }} /> {formatDate(item.scheduled_date)}
                          </span>
                          {item.duration_minutes && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <ClockIcon style={{ width: 12, height: 12 }} /> {item.duration_minutes} min
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                        {/* Remind button — any item with a date can become a platform reminder */}
                        {item.scheduled_date && (
                          remindedIds.has(item.id) ? (
                            <span className="ios-caption" style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--ios-green)", fontWeight: 600 }}>
                              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M5 12l5 5 9-11" />
                              </svg>
                              Reminded
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddReminder(item)}
                              disabled={addingReminderId === item.id}
                              aria-label="Add to platform reminders"
                              className="ios-caption"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                color: colorTag,
                                fontWeight: 600,
                                opacity: addingReminderId === item.id ? 0.6 : 1,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {addingReminderId === item.id ? "…" : (
                                <>
                                  <Icons.BellIcon style={{ width: 13, height: 13 }} /> Remind
                                </>
                              )}
                            </button>
                          )
                        )}
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="ios-caption"
                          style={{ color: "var(--ios-label-2)", fontWeight: 600 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          aria-label="Delete item"
                          style={{ color: "var(--ios-red)", opacity: deletingId === item.id ? 0.5 : 1, display: "inline-flex" }}
                        >
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
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
