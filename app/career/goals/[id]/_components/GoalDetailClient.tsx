/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Group, Segmented, Chip, IconBadge, RadialGauge, Icons } from "@/components/ios";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Goal {
  id: string;
  title: string;
  description: string | null;
  why: string | null;
  success_criteria: string | null;
  progress_pct: number;
  target_date: string | null;
  color_tag: string | null;
  status: string;
}

interface Milestone {
  id: string;
  title: string;
  target_date: string | null;
  completed: boolean;
  completed_at: string | null;
}

interface Note {
  id: string;
  content: string;
  note_type: string;
  created_at: string;
}

interface GoalDetailClientProps {
  goal: Goal;
  milestones: Milestone[];
  notes: Note[];
  experiences: any[];
  learningItems: any[];
  daysUntil: number | null;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "var(--ios-hair) solid var(--ios-separator)",
  background: "var(--ios-cell)",
  color: "var(--ios-label)",
  fontSize: 16,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  colorScheme: "light dark",
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 400,
  color: "var(--ios-label-2)",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  marginBottom: 6,
};

// ── Main component ────────────────────────────────────────────────────────────

export default function GoalDetailClient({
  goal,
  milestones: initialMilestones,
  notes: initialNotes,
  daysUntil,
}: GoalDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "milestones" | "notes" | "resources">(
    "overview"
  );
  const [progress, setProgress] = useState(goal.progress_pct ?? 0);
  const [savingProgress, setSavingProgress] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [refineModal, setRefineModal] = useState<{ open: boolean; content: string | null }>({
    open: false,
    content: null,
  });
  const [refining, setRefining] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  // ── Edit mode ─────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: goal.title,
    description: goal.description ?? "",
    why: goal.why ?? "",
    success_criteria: goal.success_criteria ?? "",
    category: (goal as any).category ?? "career",
    horizon: (goal as any).horizon ?? "medium",
    target_date: goal.target_date ?? "",
    status: goal.status,
    color_tag: goal.color_tag ?? "#3B5C7F",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await fetch(`/api/career/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          target_date: editForm.target_date || null,
        }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setSavingEdit(false);
    }
  }

  const color = goal.color_tag ?? "var(--ios-tint)";

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "milestones", label: "Milestones" },
    { value: "notes", label: "Notes" },
    { value: "resources", label: "Resources" },
  ] as const;

  // ── Progress update ────────────────────────────────────────────────────────

  async function saveProgress(val: number) {
    setSavingProgress(true);
    try {
      await fetch(`/api/career/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress_pct: val }),
      });
      router.refresh();
    } finally {
      setSavingProgress(false);
    }
  }

  // ── AI Refine ─────────────────────────────────────────────────────────────

  async function handleRefine() {
    setRefining(true);
    try {
      const res = await fetch(`/api/career/goals/${goal.id}/refine`, { method: "POST" });
      const data = await res.json();
      setRefineModal({ open: true, content: data.refinements ?? data.message ?? "No suggestions returned." });
    } catch {
      setRefineModal({ open: true, content: "Failed to get AI suggestions. Please try again." });
    } finally {
      setRefining(false);
    }
  }

  // ── Milestones ────────────────────────────────────────────────────────────

  async function toggleMilestone(id: string, completed: boolean) {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, completed, completed_at: completed ? new Date().toISOString() : null } : m))
    );
    await fetch(`/api/career/milestones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
  }

  async function addMilestone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string).trim();
    const target_date = fd.get("target_date") as string;
    if (!title) return;

    const res = await fetch(`/api/career/goals/${goal.id}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, target_date: target_date || null }),
    });
    const newM = await res.json();
    if (newM.id) {
      setMilestones((prev) =>
        [...prev, newM].sort((a, b) => {
          if (!a.target_date) return 1;
          if (!b.target_date) return -1;
          return a.target_date.localeCompare(b.target_date);
        })
      );
      (e.target as HTMLFormElement).reset();
    }
  }

  // ── Notes ─────────────────────────────────────────────────────────────────

  async function addNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const content = (fd.get("content") as string).trim();
    const note_type = fd.get("note_type") as string;
    if (!content) return;

    const res = await fetch(`/api/career/goals/${goal.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, note_type }),
    });
    const newNote = await res.json();
    if (newNote.id) {
      setNotes((prev) => [newNote, ...prev]);
      (e.target as HTMLFormElement).reset();
    }
  }

  // ── AI Recommend ──────────────────────────────────────────────────────────

  async function handleRecommend() {
    setRecommending(true);
    try {
      const res = await fetch(`/api/career/goals/${goal.id}/recommend`, { method: "POST" });
      const data = await res.json();
      setRecommendations(data.recommendations ?? []);
    } catch {
      // silent
    } finally {
      setRecommending(false);
    }
  }

  // ── Criteria lines ────────────────────────────────────────────────────────

  const criteriaLines = (goal.success_criteria ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const pct = Math.min(100, Math.max(0, progress));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Tabs */}
      <div style={{ padding: "8px 16px 0" }}>
        <Segmented
          options={tabs.map((t) => ({ value: t.value, label: t.label }))}
          value={activeTab}
          onChange={(v) => {
            setActiveTab(v as typeof activeTab);
            setEditing(false);
          }}
          ariaLabel="Goal sections"
        />
      </div>

      {/* Edit action */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 16px 0" }}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ios-btn--plain"
          style={{ padding: 0, display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          Edit goal
        </button>
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div>
          {goal.why && (
            <Group header="Why this matters">
              <div className="ios-body" style={{ padding: "12px 16px", fontStyle: "italic", color: "var(--ios-label)", lineHeight: 1.5 }}>
                &ldquo;{goal.why}&rdquo;
              </div>
            </Group>
          )}

          {goal.description && (
            <Group header="Description">
              <div className="ios-body" style={{ padding: "12px 16px", color: "var(--ios-label)", lineHeight: 1.5 }}>
                {goal.description}
              </div>
            </Group>
          )}

          {criteriaLines.length > 0 && (
            <Group header="Success criteria">
              {criteriaLines.map((line, i) => (
                <div key={i} className="ios-cell">
                  <span className="ios-cell-lead">
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 5,
                        border: `2px solid ${color}`,
                        flexShrink: 0,
                        display: "block",
                      }}
                    />
                  </span>
                  <span className="ios-cell-body">
                    <span className="ios-cell-title">{line}</span>
                  </span>
                </div>
              ))}
            </Group>
          )}

          {/* Progress */}
          <Group header="Progress">
            <div className="ios-cell" style={{ gap: 16 }}>
              <span className="ios-cell-lead">
                <RadialGauge
                  value={pct / 100}
                  color={color}
                  size={64}
                  center={<span className="ios-num" style={{ fontSize: 16, fontWeight: 700, color }}>{pct}%</span>}
                />
              </span>
              <span className="ios-cell-body" style={{ gap: 10 }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  onMouseUp={() => saveProgress(progress)}
                  onTouchEnd={() => saveProgress(progress)}
                  style={{ width: "100%", accentColor: color }}
                />
                <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
                  {savingProgress ? "Saving…" : "Drag to update progress"}
                </span>
              </span>
            </div>
          </Group>

          {/* Days remaining */}
          {daysUntil !== null && (
            <Group>
              <div className="ios-cell">
                <span className="ios-cell-lead">
                  <IconBadge color={daysUntil < 0 ? "var(--ios-red)" : daysUntil < 30 ? "var(--ios-orange)" : "var(--ios-tint)"}>
                    <Icons.CalendarIcon />
                  </IconBadge>
                </span>
                <span className="ios-cell-body">
                  <span className="ios-cell-title">
                    {daysUntil < 0
                      ? `${Math.abs(daysUntil)} days overdue`
                      : daysUntil === 0
                      ? "Target date is today"
                      : `${daysUntil} days remaining`}
                  </span>
                  <span className="ios-cell-sub">
                    {daysUntil < 0
                      ? "This goal is past its target date."
                      : daysUntil === 0
                      ? "The target date is today."
                      : "Until the target date."}
                  </span>
                </span>
              </div>
            </Group>
          )}

          {/* AI Refine button */}
          <div style={{ padding: "8px 16px 16px" }}>
            <button
              type="button"
              onClick={handleRefine}
              disabled={refining}
              className="ios-btn ios-btn--primary"
              style={{ opacity: refining ? 0.5 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Icons.SparkleIcon style={{ width: 18, height: 18 }} />
              {refining ? "Analyzing…" : "AI Refine Goal"}
            </button>
          </div>
        </div>
      )}

      {/* Milestones tab */}
      {activeTab === "milestones" && (
        <div>
          {milestones.length === 0 ? (
            <Group>
              <div className="ios-cell" style={{ justifyContent: "center", color: "var(--ios-label-2)" }}>
                No milestones yet
              </div>
            </Group>
          ) : (
            <Group header="Milestones">
              {milestones.map((m) => (
                <div key={m.id} className="ios-cell" style={{ opacity: m.completed ? 0.6 : 1 }}>
                  <span className="ios-cell-lead">
                    <button
                      type="button"
                      onClick={() => toggleMilestone(m.id, !m.completed)}
                      aria-label={m.completed ? "Mark incomplete" : "Mark complete"}
                      aria-pressed={m.completed}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: m.completed ? color : "transparent",
                        border: m.completed ? "none" : "1.5px solid var(--ios-label-3)",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      {m.completed && (
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </span>
                  <span className="ios-cell-body">
                    <span className="ios-cell-title" style={{ textDecoration: m.completed ? "line-through" : "none" }}>
                      {m.title}
                    </span>
                    {m.target_date && (
                      <span className="ios-cell-sub">
                        {new Date(m.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </span>
                  {m.completed && m.completed_at && (
                    <span className="ios-cell-trail ios-caption" style={{ color: "var(--ios-label-2)" }}>
                      Done {new Date(m.completed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </Group>
          )}

          {/* Add milestone */}
          <Group header="Add milestone">
            <form onSubmit={addMilestone} style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <input name="title" placeholder="Milestone title…" required style={inputStyle} />
              <input name="target_date" type="date" style={inputStyle} />
              <button type="submit" className="ios-btn ios-btn--primary">
                Add milestone
              </button>
            </form>
          </Group>
        </div>
      )}

      {/* Notes tab */}
      {activeTab === "notes" && (
        <div>
          {/* Add note */}
          <Group header="Add note">
            <form onSubmit={addNote} style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={fieldLabel}>Type</label>
                <select name="note_type" defaultValue="reflection" style={inputStyle}>
                  <option value="reflection">Reflection</option>
                  <option value="feedback">Feedback</option>
                  <option value="update">Update</option>
                </select>
              </div>
              <textarea
                name="content"
                placeholder="Write a reflection, piece of feedback, or progress update…"
                required
                rows={4}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />
              <button type="submit" className="ios-btn ios-btn--primary">
                Add note
              </button>
            </form>
          </Group>

          {notes.length === 0 ? (
            <Group>
              <div className="ios-cell" style={{ justifyContent: "center", color: "var(--ios-label-2)" }}>
                No notes yet
              </div>
            </Group>
          ) : (
            <Group header="Notes & reflection">
              {notes.map((note) => (
                <div key={note.id} className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <NoteTypeBadge type={note.note_type} />
                    <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>
                      {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <p className="ios-body" style={{ margin: 0, color: "var(--ios-label)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {note.content}
                  </p>
                </div>
              ))}
            </Group>
          )}
        </div>
      )}

      {/* Resources tab */}
      {activeTab === "resources" && (
        <div>
          <div style={{ padding: "12px 16px 0" }}>
            <button
              type="button"
              onClick={handleRecommend}
              disabled={recommending}
              className="ios-btn ios-btn--primary"
              style={{ opacity: recommending ? 0.5 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Icons.SparkleIcon style={{ width: 18, height: 18 }} />
              {recommending ? "Finding resources…" : "Get AI Recommendations"}
            </button>
          </div>

          {recommendations.length > 0 && (
            <Group header="Recommended resources">
              {recommendations.map((rec, i) => (
                <div key={i} className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Chip small>{rec.type ?? "Resource"}</Chip>
                  </div>
                  <span className="ios-cell-title">{rec.title}</span>
                  {rec.why && (
                    <p className="ios-footnote" style={{ margin: 0, color: "var(--ios-label-2)", lineHeight: 1.45 }}>
                      {rec.why}
                    </p>
                  )}
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(rec.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ios-subhead"
                    style={{ color: "var(--ios-tint)", textDecoration: "none", fontWeight: 500 }}
                  >
                    Search →
                  </a>
                </div>
              ))}
            </Group>
          )}

          {recommendations.length === 0 && !recommending && (
            <Group>
              <div className="ios-cell" style={{ justifyContent: "center", color: "var(--ios-label-2)", textAlign: "center" }}>
                Tap &ldquo;Get AI Recommendations&rdquo; for curated resources for this goal.
              </div>
            </Group>
          )}
        </div>
      )}

      {/* Edit sheet */}
      {editing && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setEditing(false)} aria-hidden="true" />
          <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Edit goal" style={{ maxHeight: "88vh", overflowY: "auto" }}>
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button type="button" className="ios-btn--plain" onClick={() => setEditing(false)}>Cancel</button>
              <span className="ios-headline">Edit goal</span>
              <span style={{ width: 52 }} />
            </div>

            <form onSubmit={saveEdit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {(["title", "description", "why", "success_criteria"] as const).map((key) => {
                const isTextarea = key !== "title";
                const labels: Record<string, string> = {
                  title: "Title",
                  description: "Description",
                  why: "Why this matters",
                  success_criteria: "Success criteria",
                };
                return (
                  <div key={key}>
                    <label style={fieldLabel}>{labels[key]}</label>
                    {isTextarea ? (
                      <textarea
                        value={editForm[key]}
                        onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                        rows={3}
                        style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
                      />
                    ) : (
                      <input
                        required
                        value={editForm[key]}
                        onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                        style={inputStyle}
                      />
                    )}
                  </div>
                );
              })}

              <div>
                <label style={fieldLabel}>Category</label>
                <select value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} style={inputStyle}>
                  <option value="career">Career</option>
                  <option value="personal">Personal</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Horizon</label>
                <select value={editForm.horizon} onChange={(e) => setEditForm((f) => ({ ...f, horizon: e.target.value }))} style={inputStyle}>
                  <option value="short">Short-term (0-6mo)</option>
                  <option value="medium">Medium-term (6-24mo)</option>
                  <option value="long">Long-term (2yr+)</option>
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))} style={inputStyle}>
                  <option value="active">Active</option>
                  <option value="achieved">Achieved</option>
                  <option value="paused">Paused</option>
                  <option value="abandoned">Abandoned</option>
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Target date</label>
                <input type="date" value={editForm.target_date} onChange={(e) => setEditForm((f) => ({ ...f, target_date: e.target.value }))} style={inputStyle} />
              </div>

              <button
                type="submit"
                disabled={savingEdit}
                className="ios-btn ios-btn--primary"
                style={{ marginTop: 6, opacity: savingEdit ? 0.5 : 1 }}
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </form>
          </div>
        </>
      )}

      {/* AI Refine Modal */}
      {refineModal.open && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setRefineModal({ open: false, content: null })} aria-hidden="true" />
          <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="AI goal refinements" style={{ maxHeight: "82vh", overflowY: "auto" }}>
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ width: 52 }} />
              <span className="ios-headline">AI Goal Refinements</span>
              <button type="button" className="ios-btn--plain" onClick={() => setRefineModal({ open: false, content: null })}>Done</button>
            </div>
            <p className="ios-body" style={{ color: "var(--ios-label)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
              {refineModal.content}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function NoteTypeBadge({ type }: { type: string }) {
  return (
    <span className="ios-chip ios-chip--sm" style={{ textTransform: "capitalize" }}>
      {type}
    </span>
  );
}
