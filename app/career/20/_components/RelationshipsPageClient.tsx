"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Goal {
  id: string;
  title: string;
  color_tag?: string;
}

interface Relationship {
  id: string;
  name: string;
  role?: string | null;
  organization?: string | null;
  relationship_type?: string;
  meeting_frequency?: string | null;
  last_interaction_date?: string | null;
  notes?: string | null;
}

interface Props {
  grouped: Record<string, Relationship[]>;
  goals: Goal[];
  relationshipTypes: string[];
  typeLabels: Record<string, string>;
  typeColors: Record<string, string>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const FREQ_BADGES: Record<string, { label: string; color: string }> = {
  weekly:    { label: "Weekly",    color: "#4A6B3A" },
  biweekly:  { label: "Bi-weekly", color: "#3B5C7F" },
  monthly:   { label: "Monthly",   color: "#6B5B95" },
  quarterly: { label: "Quarterly", color: "#C97A3A" },
  as_needed: { label: "As needed", color: "#8A8278" },
};

const INTERACTION_TYPES = [
  "coffee_chat",
  "formal_meeting",
  "email",
  "event",
  "feedback_session",
  "other",
];

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

export default function RelationshipsPageClient({
  grouped,
  goals,
  relationshipTypes,
  typeLabels,
  typeColors,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showAddRelForm, setShowAddRelForm] = useState(false);
  const [interactionFormFor, setInteractionFormFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editRelId, setEditRelId] = useState<string | null>(null);
  const [editRelForm, setEditRelForm] = useState<typeof relForm | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openEditRel(rel: Relationship) {
    setEditRelId(rel.id);
    setEditRelForm({ name: rel.name, role: rel.role ?? "", organization: rel.organization ?? "", relationship_type: rel.relationship_type ?? "mentor", meeting_frequency: rel.meeting_frequency ?? "monthly", notes: rel.notes ?? "" });
    setInteractionFormFor(null);
  }

  async function saveEditRel(e: React.FormEvent) {
    e.preventDefault();
    if (!editRelId || !editRelForm) return;
    setSubmitting(true);
    try {
      await fetch(`/api/career/relationships/${editRelId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editRelForm) });
      setEditRelId(null);
      startTransition(() => { router.refresh(); });
    } finally { setSubmitting(false); }
  }

  async function deleteRel(id: string) {
    if (!confirm("Remove this relationship?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/career/relationships/${id}`, { method: "DELETE" });
      startTransition(() => { router.refresh(); });
    } finally { setDeletingId(null); }
  }

  const [relForm, setRelForm] = useState({
    name: "",
    role: "",
    organization: "",
    relationship_type: "mentor",
    meeting_frequency: "monthly",
    notes: "",
  });

  const [interForm, setInterForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    interaction_type: "coffee_chat",
    notes: "",
    insights: "",
    action_items: "",
    linked_goal_ids: [] as string[],
  });

  function handleRelChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setRelForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleInterChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setInterForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function toggleInterGoal(id: string) {
    setInterForm((prev) => ({
      ...prev,
      linked_goal_ids: prev.linked_goal_ids.includes(id)
        ? prev.linked_goal_ids.filter((g) => g !== id)
        : [...prev.linked_goal_ids, id],
    }));
  }

  async function submitRelationship(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/career/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: relForm.name.trim(),
          role: relForm.role.trim() || null,
          organization: relForm.organization.trim() || null,
          relationship_type: relForm.relationship_type,
          meeting_frequency: relForm.meeting_frequency || null,
          notes: relForm.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to save");
      }
      setShowAddRelForm(false);
      setRelForm({ name: "", role: "", organization: "", relationship_type: "mentor", meeting_frequency: "monthly", notes: "" });
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInteraction(relationshipId: string, e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/career/relationships/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationship_id: relationshipId,
          interaction_date: interForm.date || null,
          interaction_type: interForm.interaction_type,
          notes: interForm.notes.trim() || null,
          insights: interForm.insights.trim() || null,
          action_items: interForm.action_items
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          linked_goal_ids: interForm.linked_goal_ids,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to save");
      }
      setInteractionFormFor(null);
      setInterForm({
        date: new Date().toISOString().slice(0, 10),
        interaction_type: "coffee_chat",
        notes: "",
        insights: "",
        action_items: "",
        linked_goal_ids: [],
      });
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const hasAny = relationshipTypes.some((t) => (grouped[t] ?? []).length > 0);

  return (
    <div>
      {/* Add Relationship button */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => setShowAddRelForm((v) => !v)}
          style={{
            background: "var(--color-accent)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {showAddRelForm ? "Cancel" : "+ Add Relationship"}
        </button>
      </div>

      {/* Add Relationship form */}
      {showAddRelForm && (
        <form
          onSubmit={submitRelationship}
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 12,
            padding: "24px",
            marginBottom: 28,
          }}
        >
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 600, color: "var(--color-ink)" }}>
            Add a Relationship
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
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle()}>Name *</label>
              <input
                name="name"
                value={relForm.name}
                onChange={handleRelChange}
                required
                placeholder="Full name"
                style={inputStyle()}
              />
            </div>
            <div>
              <label style={labelStyle()}>Role / Title</label>
              <input name="role" value={relForm.role} onChange={handleRelChange} placeholder="e.g. Senior Director" style={inputStyle()} />
            </div>
            <div>
              <label style={labelStyle()}>Organization</label>
              <input name="organization" value={relForm.organization} onChange={handleRelChange} placeholder="Company or institution" style={inputStyle()} />
            </div>
            <div>
              <label style={labelStyle()}>Relationship Type</label>
              <select name="relationship_type" value={relForm.relationship_type} onChange={handleRelChange} style={inputStyle()}>
                {relationshipTypes.map((t) => (
                  <option key={t} value={t}>{typeLabels[t] ?? t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle()}>Meeting Frequency</label>
              <select name="meeting_frequency" value={relForm.meeting_frequency} onChange={handleRelChange} style={inputStyle()}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="as_needed">As needed</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle()}>Notes</label>
              <textarea name="notes" value={relForm.notes} onChange={handleRelChange} rows={2} placeholder="How did you meet? What do you hope to learn?" style={{ ...inputStyle(), resize: "vertical" }} />
            </div>
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: "var(--color-accent)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "9px 20px",
                fontSize: 14,
                fontWeight: 500,
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Saving…" : "Add Relationship"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddRelForm(false)}
              style={{
                background: "transparent",
                border: "1px solid var(--color-rule)",
                borderRadius: 8,
                padding: "9px 16px",
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

      {/* Grouped relationship cards */}
      {!hasAny ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--color-ink-3)", fontSize: 15 }}>
          No relationships added yet. Add your mentors, coaches, and peers above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {relationshipTypes.map((type) => {
            const rels = grouped[type] ?? [];
            if (rels.length === 0) return null;
            const color = typeColors[type] ?? "#8A8278";
            return (
              <div key={type}>
                <h2
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    margin: "0 0 12px",
                    paddingBottom: 6,
                    borderBottom: `2px solid ${color}22`,
                  }}
                >
                  {typeLabels[type]}
                </h2>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                  {rels.map((rel) => {
                    const freq = FREQ_BADGES[rel.meeting_frequency ?? ""] ?? null;
                    const isInterFormOpen = interactionFormFor === rel.id;
                    return (
                      <div
                        key={rel.id}
                        style={{
                          background: "var(--color-bg-card)",
                          border: "1px solid var(--color-rule)",
                          borderRadius: 10,
                          padding: "16px 18px",
                          borderTop: `3px solid ${color}`,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)", marginBottom: 2 }}>
                              {rel.name}
                            </div>
                            {rel.role && <div style={{ fontSize: 13, color: "var(--color-ink-2)" }}>{rel.role}</div>}
                            {rel.organization && <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>{rel.organization}</div>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            {freq && <span style={{ background: `${freq.color}18`, color: freq.color, border: `1px solid ${freq.color}44`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 500 }}>{freq.label}</span>}
                            <button onClick={() => editRelId === rel.id ? setEditRelId(null) : openEditRel(rel)} style={{ padding: "3px 9px", borderRadius: 5, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                              {editRelId === rel.id ? "Cancel" : "Edit"}
                            </button>
                            <button onClick={() => deleteRel(rel.id)} disabled={deletingId === rel.id} style={{ padding: "3px 9px", borderRadius: 5, border: "1px solid rgba(154,59,42,0.3)", background: "rgba(154,59,42,0.05)", color: "var(--color-red, #9a3b2a)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                              {deletingId === rel.id ? "…" : "Remove"}
                            </button>
                          </div>
                        </div>

                        {/* Inline edit form */}
                        {editRelId === rel.id && editRelForm && (
                          <form onSubmit={saveEditRel} style={{ marginTop: 14, padding: "14px 16px", background: "var(--color-bg-sunk, #f3f1ec)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                            {[["name","Name"],["role","Role"],["organization","Organization"]] .map(([k,l]) => (
                              <div key={k}>
                                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--color-ink-3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{l}</label>
                                <input value={editRelForm[k as keyof typeof editRelForm]} onChange={e => setEditRelForm(f => f ? {...f, [k]: e.target.value} : f)} style={{ width:"100%", padding:"7px 10px", border:"1px solid var(--color-rule)", borderRadius:6, fontSize:13, fontFamily:"inherit", background:"var(--color-bg)", color:"var(--color-ink)", boxSizing:"border-box" }} />
                              </div>
                            ))}
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                              <div>
                                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--color-ink-3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Type</label>
                                <select value={editRelForm.relationship_type} onChange={e => setEditRelForm(f => f ? {...f, relationship_type: e.target.value} : f)} style={{ width:"100%", padding:"7px 10px", border:"1px solid var(--color-rule)", borderRadius:6, fontSize:13, fontFamily:"inherit", background:"var(--color-bg)", color:"var(--color-ink)" }}>
                                  {relationshipTypes.map(t => <option key={t} value={t}>{typeLabels[t] ?? t}</option>)}
                                </select>
                              </div>
                              <div>
                                <label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--color-ink-3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Frequency</label>
                                <select value={editRelForm.meeting_frequency} onChange={e => setEditRelForm(f => f ? {...f, meeting_frequency: e.target.value} : f)} style={{ width:"100%", padding:"7px 10px", border:"1px solid var(--color-rule)", borderRadius:6, fontSize:13, fontFamily:"inherit", background:"var(--color-bg)", color:"var(--color-ink)" }}>
                                  {Object.keys(FREQ_BADGES).map(k => <option key={k} value={k}>{FREQ_BADGES[k].label}</option>)}
                                </select>
                              </div>
                            </div>
                            <div>
                              <label style={{ display:"block", fontSize:11, fontWeight:600, color:"var(--color-ink-3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Notes</label>
                              <textarea value={editRelForm.notes} onChange={e => setEditRelForm(f => f ? {...f, notes: e.target.value} : f)} rows={2} style={{ width:"100%", padding:"7px 10px", border:"1px solid var(--color-rule)", borderRadius:6, fontSize:13, fontFamily:"inherit", background:"var(--color-bg)", color:"var(--color-ink)", resize:"vertical", boxSizing:"border-box" }} />
                            </div>
                            <div style={{ display:"flex", gap:8 }}>
                              <button type="submit" disabled={submitting} style={{ padding:"7px 18px", borderRadius:7, border:"none", background:"var(--color-accent,#3B5C7F)", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{submitting ? "Saving…" : "Save"}</button>
                              <button type="button" onClick={() => setEditRelId(null)} style={{ padding:"7px 14px", borderRadius:7, border:"1px solid var(--color-rule)", background:"transparent", color:"var(--color-ink-3)", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
                            </div>
                          </form>
                        )}

                        {rel.last_interaction_date && (
                          <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 8 }}>
                            Last interaction: {formatDate(rel.last_interaction_date)}
                          </div>
                        )}

                        <button
                          onClick={() => {
                            setInteractionFormFor(isInterFormOpen ? null : rel.id);
                            setError(null);
                          }}
                          style={{
                            marginTop: 12,
                            background: isInterFormOpen ? "var(--color-bg-deep)" : "transparent",
                            border: "1px solid var(--color-rule)",
                            borderRadius: 6,
                            padding: "5px 12px",
                            fontSize: 12,
                            color: "var(--color-ink-2)",
                            cursor: "pointer",
                          }}
                        >
                          {isInterFormOpen ? "Cancel" : "+ Log Interaction"}
                        </button>

                        {/* Inline interaction form */}
                        {isInterFormOpen && (
                          <form
                            onSubmit={(e) => submitInteraction(rel.id, e)}
                            style={{
                              marginTop: 14,
                              borderTop: "1px solid var(--color-rule)",
                              paddingTop: 14,
                              display: "flex",
                              flexDirection: "column",
                              gap: 12,
                            }}
                          >
                            {error && (
                              <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 6, padding: "6px 10px", color: "#9A3B2A", fontSize: 12 }}>
                                {error}
                              </div>
                            )}
                            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                              <div>
                                <label style={labelStyle()}>Date</label>
                                <input type="date" name="date" value={interForm.date} onChange={handleInterChange} style={inputStyle()} />
                              </div>
                              <div>
                                <label style={labelStyle()}>Type</label>
                                <select name="interaction_type" value={interForm.interaction_type} onChange={handleInterChange} style={inputStyle()}>
                                  {INTERACTION_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                      {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div>
                              <label style={labelStyle()}>Notes</label>
                              <textarea name="notes" value={interForm.notes} onChange={handleInterChange} rows={2} placeholder="What did you discuss?" style={{ ...inputStyle(), resize: "vertical" }} />
                            </div>
                            <div>
                              <label style={labelStyle()}>Insights</label>
                              <textarea name="insights" value={interForm.insights} onChange={handleInterChange} rows={2} placeholder="Key takeaways or advice received" style={{ ...inputStyle(), resize: "vertical" }} />
                            </div>
                            <div>
                              <label style={labelStyle()}>Action Items (one per line)</label>
                              <textarea name="action_items" value={interForm.action_items} onChange={handleInterChange} rows={2} placeholder="Follow-up tasks..." style={{ ...inputStyle(), resize: "vertical" }} />
                            </div>
                            {goals.length > 0 && (
                              <div>
                                <label style={labelStyle()}>Link to Goals</label>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {goals.map((g) => {
                                    const selected = interForm.linked_goal_ids.includes(g.id);
                                    return (
                                      <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => toggleInterGoal(g.id)}
                                        style={{
                                          border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-rule)"}`,
                                          background: selected ? "var(--color-accent-soft)" : "transparent",
                                          color: selected ? "var(--color-accent-dark)" : "var(--color-ink-2)",
                                          borderRadius: 6,
                                          padding: "3px 8px",
                                          fontSize: 12,
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
                            <button
                              type="submit"
                              disabled={submitting}
                              style={{
                                background: "var(--color-accent)",
                                color: "#fff",
                                border: "none",
                                borderRadius: 6,
                                padding: "7px 16px",
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: submitting ? "wait" : "pointer",
                                opacity: submitting ? 0.7 : 1,
                                alignSelf: "flex-start",
                              }}
                            >
                              {submitting ? "Saving…" : "Log Interaction"}
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
