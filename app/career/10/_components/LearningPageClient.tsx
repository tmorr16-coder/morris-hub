"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const LEARNING_TYPES = ["course", "conference", "book", "workshop", "other"];

interface Goal {
  id: string;
  title: string;
  color_tag?: string;
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  learningItems: any[];
  goals: Goal[];
  goalsMap: Record<string, string>;
  statusColors: Record<string, string>;
  typeColors: Record<string, string>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--color-ink-3)",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    background: "var(--color-bg)",
    border: "1px solid var(--color-rule)",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 14,
    color: "var(--color-ink)",
    outline: "none",
  };
}

export default function LearningPageClient({
  learningItems,
  goals,
  goalsMap,
  statusColors,
  typeColors,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<typeof form | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    learning_type: "course",
    provider: "",
    start_date: "",
    end_date: "",
    status: "planned",
    url: "",
    linked_goal_ids: [] as string[],
    notes: "",
  });

  function openEditItem(item: any) {
    setEditItemId(item.id);
    setEditForm({ title: item.title ?? "", learning_type: item.learning_type ?? "course", provider: item.provider ?? "", start_date: item.start_date ?? "", end_date: item.end_date ?? "", status: item.status ?? "planned", url: item.url ?? "", linked_goal_ids: item.linked_goal_ids ?? [], notes: item.notes ?? "" });
  }

  async function saveEditItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editItemId || !editForm) return;
    setSubmitting(true);
    try {
      await fetch(`/api/career/learning/${editItemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
      setEditItemId(null);
      startTransition(() => { router.refresh(); });
    } finally { setSubmitting(false); }
  }

  async function deleteItem(id: string) {
    if (!confirm("Remove this learning item?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/career/learning/${id}`, { method: "DELETE" });
      startTransition(() => { router.refresh(); });
    } finally { setDeletingId(null); }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function toggleGoal(id: string) {
    setForm((prev) => ({
      ...prev,
      linked_goal_ids: prev.linked_goal_ids.includes(id)
        ? prev.linked_goal_ids.filter((g) => g !== id)
        : [...prev.linked_goal_ids, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/career/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          learning_type: form.learning_type,
          provider: form.provider.trim() || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          status: form.status,
          url: form.url.trim() || null,
          linked_goal_ids: form.linked_goal_ids,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to save");
      }
      setShowForm(false);
      setForm({
        title: "",
        learning_type: "course",
        provider: "",
        start_date: "",
        end_date: "",
        status: "planned",
        url: "",
        linked_goal_ids: [],
        notes: "",
      });
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
          Courses, Books &amp; Conferences
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            background: "var(--color-accent)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "7px 16px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {showForm ? "Cancel" : "+ Add Learning"}
        </button>
      </div>

      {/* Add Learning form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 12,
            padding: "22px",
            marginBottom: 24,
          }}
        >
          <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 600, color: "var(--color-ink)" }}>
            Add Learning Item
          </h3>
          {error && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: 6,
                padding: "8px 12px",
                color: "#9A3B2A",
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle()}>Title *</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder="e.g. Deep Work by Cal Newport"
                style={inputStyle()}
              />
            </div>
            <div>
              <label style={labelStyle()}>Type</label>
              <select name="learning_type" value={form.learning_type} onChange={handleChange} style={inputStyle()}>
                {LEARNING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle()}>Provider / Author</label>
              <input name="provider" value={form.provider} onChange={handleChange} placeholder="e.g. Coursera, O&apos;Reilly" style={inputStyle()} />
            </div>
            <div>
              <label style={labelStyle()}>Start Date</label>
              <input type="date" name="start_date" value={form.start_date} onChange={handleChange} style={inputStyle()} />
            </div>
            <div>
              <label style={labelStyle()}>End / Target Date</label>
              <input type="date" name="end_date" value={form.end_date} onChange={handleChange} style={inputStyle()} />
            </div>
            <div>
              <label style={labelStyle()}>Status</label>
              <select name="status" value={form.status} onChange={handleChange} style={inputStyle()}>
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
              </select>
            </div>
            <div>
              <label style={labelStyle()}>URL</label>
              <input name="url" value={form.url} onChange={handleChange} type="url" placeholder="https://..." style={inputStyle()} />
            </div>
            {goals.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle()}>Link to Goals</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {goals.map((g) => {
                    const selected = form.linked_goal_ids.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGoal(g.id)}
                        style={{
                          border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-rule)"}`,
                          background: selected ? "var(--color-accent-soft)" : "transparent",
                          color: selected ? "var(--color-accent-dark)" : "var(--color-ink-2)",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        {g.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle()}>Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Why are you taking this? Key things to learn..."
                style={{ ...inputStyle(), resize: "vertical" }}
              />
            </div>
          </div>
          <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: "var(--color-accent)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 14,
                fontWeight: 500,
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Saving…" : "Add Learning"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                background: "transparent",
                border: "1px solid var(--color-rule)",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 14,
                color: "var(--color-ink-2)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Learning item list */}
      {learningItems.length === 0 ? (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 10,
            padding: "24px",
            textAlign: "center",
            color: "var(--color-ink-3)",
            fontSize: 14,
          }}
        >
          No courses, books, or conferences tracked yet. Click &ldquo;+ Add Learning&rdquo; to start.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {learningItems.map((item) => {
            const typeColor = typeColors[item.learning_type ?? "other"] ?? typeColors.other;
            const statusColor = statusColors[item.status ?? "planned"] ?? "#8A8278";
            return (
              <div
                key={item.id}
                style={{
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 10,
                  padding: "15px 16px",
                  borderLeft: `4px solid ${typeColor}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      background: `${typeColor}18`,
                      color: typeColor,
                      border: `1px solid ${typeColor}44`,
                      borderRadius: 4,
                      padding: "1px 7px",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {item.learning_type ?? "other"}
                  </span>
                  <span
                    style={{
                      background: `${statusColor}18`,
                      color: statusColor,
                      border: `1px solid ${statusColor}44`,
                      borderRadius: 4,
                      padding: "1px 7px",
                      fontSize: 11,
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(item.status ?? "planned").replace(/_/g, " ")}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", marginBottom: 2 }}>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--color-ink)", textDecoration: "none" }}
                    >
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </div>
                {item.provider && (
                  <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginBottom: 4 }}>
                    {item.provider}
                  </div>
                )}
                {(item.start_date || item.end_date) && (
                  <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginBottom: 4 }}>
                    {item.start_date && formatDate(item.start_date)}
                    {item.start_date && item.end_date && " – "}
                    {item.end_date && formatDate(item.end_date)}
                  </div>
                )}
                {(item.linked_goal_ids ?? []).length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                    {(item.linked_goal_ids ?? []).map((gid: string) =>
                      goalsMap[gid] ? (
                        <span key={gid} style={{ background: "var(--color-bg-deep)", color: "var(--color-ink-2)", borderRadius: 4, padding: "1px 6px", fontSize: 11 }}>{goalsMap[gid]}</span>
                      ) : null
                    )}
                  </div>
                )}
                {/* Edit / Delete buttons */}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => editItemId === item.id ? setEditItemId(null) : openEditItem(item)} style={{ padding: "4px 12px", borderRadius: 5, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                    {editItemId === item.id ? "Cancel" : "Edit"}
                  </button>
                  <button onClick={() => deleteItem(item.id)} disabled={deletingId === item.id} style={{ padding: "4px 12px", borderRadius: 5, border: "1px solid rgba(154,59,42,0.3)", background: "rgba(154,59,42,0.05)", color: "var(--color-red, #9a3b2a)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                    {deletingId === item.id ? "…" : "Remove"}
                  </button>
                </div>
                {/* Inline edit form */}
                {editItemId === item.id && editForm && (
                  <form onSubmit={saveEditItem} style={{ marginTop: 12, padding: "14px", background: "var(--color-bg-sunk, #f3f1ec)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div><label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--color-ink-3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Title</label><input required value={editForm.title} onChange={e => setEditForm(f => f ? {...f, title: e.target.value} : f)} style={{ width:"100%", padding:"7px 10px", border:"1px solid var(--color-rule)", borderRadius:6, fontSize:13, fontFamily:"inherit", background:"var(--color-bg)", color:"var(--color-ink)", boxSizing:"border-box" }} /></div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                      <div><label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--color-ink-3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Type</label>
                        <select value={editForm.learning_type} onChange={e => setEditForm(f => f ? {...f, learning_type: e.target.value} : f)} style={{ width:"100%", padding:"7px 10px", border:"1px solid var(--color-rule)", borderRadius:6, fontSize:13, fontFamily:"inherit", background:"var(--color-bg)", color:"var(--color-ink)" }}>
                          {["course","conference","book","workshop","other"].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div><label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--color-ink-3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Status</label>
                        <select value={editForm.status} onChange={e => setEditForm(f => f ? {...f, status: e.target.value} : f)} style={{ width:"100%", padding:"7px 10px", border:"1px solid var(--color-rule)", borderRadius:6, fontSize:13, fontFamily:"inherit", background:"var(--color-bg)", color:"var(--color-ink)" }}>
                          {["planned","in_progress","completed"].map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
                        </select>
                      </div>
                      <div><label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--color-ink-3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Provider</label><input value={editForm.provider} onChange={e => setEditForm(f => f ? {...f, provider: e.target.value} : f)} style={{ width:"100%", padding:"7px 10px", border:"1px solid var(--color-rule)", borderRadius:6, fontSize:13, fontFamily:"inherit", background:"var(--color-bg)", color:"var(--color-ink)", boxSizing:"border-box" }} /></div>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                      <div><label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--color-ink-3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Start date</label><input type="date" value={editForm.start_date} onChange={e => setEditForm(f => f ? {...f, start_date: e.target.value} : f)} style={{ width:"100%", padding:"7px 10px", border:"1px solid var(--color-rule)", borderRadius:6, fontSize:13, fontFamily:"inherit", background:"var(--color-bg)", color:"var(--color-ink)" }} /></div>
                      <div><label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--color-ink-3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>End date</label><input type="date" value={editForm.end_date} onChange={e => setEditForm(f => f ? {...f, end_date: e.target.value} : f)} style={{ width:"100%", padding:"7px 10px", border:"1px solid var(--color-rule)", borderRadius:6, fontSize:13, fontFamily:"inherit", background:"var(--color-bg)", color:"var(--color-ink)" }} /></div>
                    </div>
                    <div><label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--color-ink-3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>URL</label><input type="url" value={editForm.url} onChange={e => setEditForm(f => f ? {...f, url: e.target.value} : f)} placeholder="https://" style={{ width:"100%", padding:"7px 10px", border:"1px solid var(--color-rule)", borderRadius:6, fontSize:13, fontFamily:"inherit", background:"var(--color-bg)", color:"var(--color-ink)", boxSizing:"border-box" }} /></div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button type="submit" disabled={submitting} style={{ padding:"7px 18px", borderRadius:7, border:"none", background:"var(--color-accent,#3B5C7F)", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{submitting ? "Saving…" : "Save"}</button>
                      <button type="button" onClick={() => setEditItemId(null)} style={{ padding:"7px 14px", borderRadius:7, border:"1px solid var(--color-rule)", background:"transparent", color:"var(--color-ink-3)", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
