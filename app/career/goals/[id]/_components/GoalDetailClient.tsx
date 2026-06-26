"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  experiences: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  learningItems: any[];
  daysUntil: number | null;
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const color = goal.color_tag ?? "var(--color-accent)";

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "milestones", label: "Milestones" },
    { key: "notes", label: "Notes & Reflection" },
    { key: "resources", label: "Resources" },
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Tabs + Edit button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid var(--color-line, #e5e2da)", marginBottom: 32 }}>
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setEditing(false); }}
              style={{
                padding: "10px 18px", fontSize: 13, fontWeight: 500,
                background: "none", border: "none",
                borderBottom: activeTab === tab.key && !editing ? `2px solid ${color}` : "2px solid transparent",
                marginBottom: -2, cursor: "pointer",
                color: activeTab === tab.key && !editing ? "var(--color-ink)" : "var(--color-ink-3, #8a8278)",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          style={{
            padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
            border: `1px solid ${editing ? color : "var(--color-line, #e5e2da)"}`,
            background: editing ? `${color}12` : "transparent",
            color: editing ? color : "var(--color-ink-3, #8a8278)",
            cursor: "pointer", fontFamily: "inherit", marginBottom: 2,
          }}
        >
          {editing ? "← Cancel edit" : "✎ Edit goal"}
        </button>
      </div>

      {/* Edit form */}
      {editing && (
        <form onSubmit={saveEdit} style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32, background: "var(--color-bg-card, #f9f8f5)", border: "1px solid var(--color-line, #e5e2da)", borderRadius: 12, padding: "22px 24px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink)", marginBottom: 4 }}>Edit Goal</div>
          {(["title", "description", "why", "success_criteria"] as const).map((key) => {
            const isTextarea = key !== "title";
            const labels: Record<string, string> = { title: "Title", description: "Description", why: "Why this matters", success_criteria: "Success criteria" };
            return (
              <div key={key}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{labels[key]}</label>
                {isTextarea ? (
                  <textarea value={editForm[key]} onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))} rows={3} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--color-line)", borderRadius: 7, fontSize: 13, fontFamily: "inherit", resize: "vertical", background: "var(--color-bg)", color: "var(--color-ink)", boxSizing: "border-box" }} />
                ) : (
                  <input required value={editForm[key]} onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--color-line)", borderRadius: 7, fontSize: 13, fontFamily: "inherit", background: "var(--color-bg)", color: "var(--color-ink)", boxSizing: "border-box" }} />
                )}
              </div>
            );
          })}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Category</label>
              <select value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--color-line)", borderRadius: 7, fontSize: 13, fontFamily: "inherit", background: "var(--color-bg)", color: "var(--color-ink)" }}>
                <option value="career">Career</option>
                <option value="personal">Personal</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Horizon</label>
              <select value={editForm.horizon} onChange={(e) => setEditForm((f) => ({ ...f, horizon: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--color-line)", borderRadius: 7, fontSize: 13, fontFamily: "inherit", background: "var(--color-bg)", color: "var(--color-ink)" }}>
                <option value="short">Short-term (0-6mo)</option>
                <option value="medium">Medium-term (6-24mo)</option>
                <option value="long">Long-term (2yr+)</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Status</label>
              <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--color-line)", borderRadius: 7, fontSize: 13, fontFamily: "inherit", background: "var(--color-bg)", color: "var(--color-ink)" }}>
                <option value="active">Active</option>
                <option value="achieved">Achieved</option>
                <option value="paused">Paused</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Target date</label>
              <input type="date" value={editForm.target_date} onChange={(e) => setEditForm((f) => ({ ...f, target_date: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--color-line)", borderRadius: 7, fontSize: 13, fontFamily: "inherit", background: "var(--color-bg)", color: "var(--color-ink)" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button type="submit" disabled={savingEdit} style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: savingEdit ? "var(--color-line)" : color, color: "#fff", fontSize: 13, fontWeight: 600, cursor: savingEdit ? "wait" : "pointer", fontFamily: "inherit" }}>
              {savingEdit ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={() => setEditing(false)} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid var(--color-line)", background: "transparent", color: "var(--color-ink-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {goal.why && (
            <Section title="Why This Matters">
              <p
                style={{
                  fontSize: 15,
                  color: "var(--color-ink-2, #423e37)",
                  lineHeight: 1.7,
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                &ldquo;{goal.why}&rdquo;
              </p>
            </Section>
          )}

          {goal.description && (
            <Section title="Description">
              <p
                style={{
                  fontSize: 14,
                  color: "var(--color-ink-2, #423e37)",
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {goal.description}
              </p>
            </Section>
          )}

          {criteriaLines.length > 0 && (
            <Section title="Success Criteria">
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {criteriaLines.map((line, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      fontSize: 14,
                      color: "var(--color-ink-2, #423e37)",
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `2px solid ${color}`,
                        flexShrink: 0,
                        marginTop: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    />
                    {line}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Progress slider */}
          <Section title="Progress">
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                onMouseUp={() => saveProgress(progress)}
                onTouchEnd={() => saveProgress(progress)}
                style={{ flex: 1, accentColor: color }}
              />
              <span
                style={{
                  fontSize: 22,
                  fontFamily: "var(--font-display)",
                  fontWeight: 400,
                  color,
                  minWidth: 48,
                  textAlign: "right",
                }}
              >
                {progress}%
              </span>
              {savingProgress && (
                <span style={{ fontSize: 11, color: "var(--color-ink-3, #8a8278)" }}>Saving…</span>
              )}
            </div>
            <div
              style={{
                height: 8,
                background: "var(--color-line, #e5e2da)",
                borderRadius: 4,
                overflow: "hidden",
                marginTop: 8,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: color,
                  borderRadius: 4,
                  transition: "width 0.2s",
                }}
              />
            </div>
          </Section>

          {/* Days remaining */}
          {daysUntil !== null && (
            <div
              style={{
                padding: "14px 18px",
                borderRadius: 10,
                background:
                  daysUntil < 0
                    ? "#fce8e6"
                    : daysUntil < 30
                    ? "#fef7e0"
                    : "var(--color-bg-sunk, #f0ede6)",
                border: "1px solid var(--color-line, #e5e2da)",
                fontSize: 14,
                fontWeight: 500,
                color:
                  daysUntil < 0
                    ? "#8a2a2a"
                    : daysUntil < 30
                    ? "#8a6a2a"
                    : "var(--color-ink-2, #423e37)",
              }}
            >
              {daysUntil < 0
                ? `This goal is ${Math.abs(daysUntil)} days past its target date.`
                : daysUntil === 0
                ? "Target date is today."
                : `${daysUntil} days until the target date.`}
            </div>
          )}

          {/* AI Refine button */}
          <div>
            <button
              onClick={handleRefine}
              disabled={refining}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: refining ? "#6b8aab" : "var(--color-accent, #3b5c7f)",
                border: "none",
                cursor: refining ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {refining ? "Analyzing…" : "AI Refine Goal"}
            </button>
          </div>
        </div>
      )}

      {/* Milestones tab */}
      {activeTab === "milestones" && (
        <div>
          {/* Add form */}
          <form
            onSubmit={addMilestone}
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 28,
              flexWrap: "wrap",
            }}
          >
            <input
              name="title"
              placeholder="Milestone title…"
              required
              style={{
                flex: 1,
                minWidth: 200,
                padding: "9px 12px",
                background: "var(--color-bg-raised, #fff)",
                border: "1px solid var(--color-line, #e5e2da)",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--color-ink)",
                fontFamily: "inherit",
              }}
            />
            <input
              name="target_date"
              type="date"
              style={{
                padding: "9px 12px",
                background: "var(--color-bg-raised, #fff)",
                border: "1px solid var(--color-line, #e5e2da)",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--color-ink)",
                fontFamily: "inherit",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "9px 18px",
                background: "var(--color-accent, #3b5c7f)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Add Milestone
            </button>
          </form>

          {/* List */}
          {milestones.length === 0 ? (
            <EmptyState>No milestones yet. Add one above.</EmptyState>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {milestones.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: "var(--color-bg-raised, #fff)",
                    border: "1px solid var(--color-line, #e5e2da)",
                    borderRadius: 8,
                    opacity: m.completed ? 0.65 : 1,
                  }}
                >
                  <button
                    onClick={() => toggleMilestone(m.id, !m.completed)}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      border: `2px solid ${m.completed ? color : "var(--color-line-2, #d0cdc5)"}`,
                      background: m.completed ? color : "transparent",
                      cursor: "pointer",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                    aria-label={m.completed ? "Mark incomplete" : "Mark complete"}
                  >
                    {m.completed ? "✓" : ""}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--color-ink)",
                        textDecoration: m.completed ? "line-through" : "none",
                      }}
                    >
                      {m.title}
                    </div>
                    {m.target_date && (
                      <div style={{ fontSize: 11, color: "var(--color-ink-3, #8a8278)", marginTop: 2 }}>
                        {new Date(m.target_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    )}
                  </div>
                  {m.completed && m.completed_at && (
                    <div style={{ fontSize: 11, color: "var(--color-ink-4, #b8af9f)" }}>
                      Done {new Date(m.completed_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes tab */}
      {activeTab === "notes" && (
        <div>
          {/* Add form */}
          <form
            onSubmit={addNote}
            style={{
              marginBottom: 28,
              background: "var(--color-bg-raised, #fff)",
              border: "1px solid var(--color-line, #e5e2da)",
              borderRadius: 10,
              padding: "18px 18px",
            }}
          >
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <select
                name="note_type"
                defaultValue="reflection"
                style={{
                  padding: "7px 10px",
                  border: "1px solid var(--color-line, #e5e2da)",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "var(--color-bg-sunk, #f0ede6)",
                  color: "var(--color-ink-2)",
                  fontFamily: "inherit",
                }}
              >
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
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--color-line, #e5e2da)",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--color-ink)",
                background: "var(--color-bg-sunk, #f0ede6)",
                fontFamily: "inherit",
                resize: "vertical",
                marginBottom: 10,
              }}
            />
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                background: "var(--color-accent, #3b5c7f)",
                color: "#fff",
                border: "none",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Add Note
            </button>
          </form>

          {notes.length === 0 ? (
            <EmptyState>No notes yet. Add your first reflection above.</EmptyState>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {notes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    background: "var(--color-bg-raised, #fff)",
                    border: "1px solid var(--color-line, #e5e2da)",
                    borderRadius: 10,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <NoteTypeBadge type={note.note_type} />
                    <span style={{ fontSize: 11, color: "var(--color-ink-4, #b8af9f)" }}>
                      {new Date(note.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 14,
                      color: "var(--color-ink-2, #423e37)",
                      lineHeight: 1.65,
                      margin: 0,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resources tab */}
      {activeTab === "resources" && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <button
              onClick={handleRecommend}
              disabled={recommending}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: recommending ? "#6b8aab" : "var(--color-accent, #3b5c7f)",
                border: "none",
                cursor: recommending ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {recommending ? "Finding resources…" : "Get AI Recommendations"}
            </button>
          </div>

          {recommendations.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--color-bg-raised, #fff)",
                    border: "1px solid var(--color-line, #e5e2da)",
                    borderRadius: 10,
                    padding: "16px 18px",
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.07em",
                          textTransform: "uppercase",
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "var(--color-accent-soft, #dde5ee)",
                          color: "var(--color-accent)",
                        }}
                      >
                        {rec.type ?? "Resource"}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--color-ink)",
                        marginBottom: 4,
                      }}
                    >
                      {rec.title}
                    </div>
                    {rec.why && (
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--color-ink-3, #8a8278)",
                          margin: "0 0 10px",
                          lineHeight: 1.5,
                        }}
                      >
                        {rec.why}
                      </p>
                    )}
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(rec.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        color: "var(--color-accent)",
                        textDecoration: "none",
                        fontWeight: 500,
                      }}
                    >
                      Search →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {recommendations.length === 0 && !recommending && (
            <EmptyState>
              Click &quot;Get AI Recommendations&quot; to receive curated resources for this goal.
            </EmptyState>
          )}
        </div>
      )}

      {/* AI Refine Modal */}
      {refineModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 20,
          }}
          onClick={() => setRefineModal({ open: false, content: null })}
        >
          <div
            style={{
              background: "var(--color-bg-raised, #fff)",
              borderRadius: 14,
              padding: "28px 28px",
              maxWidth: 560,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 400,
                margin: "0 0 16px",
                color: "var(--color-ink)",
              }}
            >
              AI Goal Refinements
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "var(--color-ink-2, #423e37)",
                lineHeight: 1.7,
                margin: "0 0 24px",
                whiteSpace: "pre-wrap",
              }}
            >
              {refineModal.content}
            </p>
            <button
              onClick={() => setRefineModal({ open: false, content: null })}
              style={{
                padding: "9px 20px",
                background: "var(--color-accent, #3b5c7f)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--color-ink-3, #8a8278)",
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "28px 20px",
        background: "var(--color-bg-sunk, #f0ede6)",
        borderRadius: 10,
        textAlign: "center",
        fontSize: 14,
        color: "var(--color-ink-4, #b8af9f)",
      }}
    >
      {children}
    </div>
  );
}

function NoteTypeBadge({ type }: { type: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    reflection: { bg: "#e6eaf0", text: "#3a4a6b" },
    feedback: { bg: "#e6f0e0", text: "#3a6b3a" },
    update: { bg: "#f5eede", text: "#7a5a2a" },
  };
  const c = map[type] ?? { bg: "#f0ede6", text: "#8a8278" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "capitalize",
        background: c.bg,
        color: c.text,
      }}
    >
      {type}
    </span>
  );
}
