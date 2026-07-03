"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Group, Segmented, Chip, IconBadge } from "@/components/ios";

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

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
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

function labelForType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
  const [typeFilter, setTypeFilter] = useState<string>("all");

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
  const typesWithItems = relationshipTypes.filter((t) => (grouped[t] ?? []).length > 0);
  const filterOptions = [
    { value: "all", label: "All" },
    ...typesWithItems.map((t) => ({ value: t, label: typeLabels[t] ?? t })),
  ];
  const interRel = interactionFormFor
    ? Object.values(grouped).flat().find((r) => r.id === interactionFormFor) ?? null
    : null;

  return (
    <div>
      {/* Add + filter */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 16px 10px" }}>
        <h2 className="ios-title-3" style={{ margin: 0 }}>Mentors, Coaches &amp; Peers</h2>
        <button type="button" onClick={() => setShowAddRelForm(true)} className="ios-btn--plain" style={{ padding: 0 }}>
          + Add
        </button>
      </div>

      {filterOptions.length > 2 && (
        <div style={{ padding: "0 16px 4px" }}>
          <Segmented options={filterOptions} value={typeFilter} onChange={setTypeFilter} ariaLabel="Filter by relationship type" />
        </div>
      )}

      {/* Add relationship sheet */}
      {showAddRelForm && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setShowAddRelForm(false)} aria-hidden="true" />
          <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Add a relationship">
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <button type="button" className="ios-btn--plain" onClick={() => setShowAddRelForm(false)}>Cancel</button>
              <span className="ios-headline">Add relationship</span>
              <span style={{ width: 52 }} />
            </div>

            <form onSubmit={submitRelationship} style={{ overflowY: "auto" }}>
              {error && (
                <p className="ios-footnote" style={{ padding: "0 0 12px", color: "var(--ios-red)" }}>{error}</p>
              )}

              <div className="ios-group-header" style={{ padding: "0 0 8px" }}>
                Name <span style={{ color: "var(--ios-red)" }}>*</span>
              </div>
              <input name="name" value={relForm.name} onChange={handleRelChange} required placeholder="Full name" style={inputStyle} />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Role / Title</div>
              <input name="role" value={relForm.role} onChange={handleRelChange} placeholder="e.g. Senior Director" style={inputStyle} />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Organization</div>
              <input name="organization" value={relForm.organization} onChange={handleRelChange} placeholder="Company or institution" style={inputStyle} />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Relationship type</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {relationshipTypes.map((t) => (
                  <Chip key={t} small selected={relForm.relationship_type === t} onClick={() => setRelForm((p) => ({ ...p, relationship_type: t }))}>
                    {typeLabels[t] ?? t}
                  </Chip>
                ))}
              </div>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Meeting frequency</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.keys(FREQ_BADGES).map((k) => (
                  <Chip key={k} small selected={relForm.meeting_frequency === k} onClick={() => setRelForm((p) => ({ ...p, meeting_frequency: k }))}>
                    {FREQ_BADGES[k].label}
                  </Chip>
                ))}
              </div>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Notes</div>
              <textarea name="notes" value={relForm.notes} onChange={handleRelChange} rows={2} placeholder="How did you meet? What do you hope to learn?" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />

              <button type="submit" disabled={submitting} className="ios-btn ios-btn--primary" style={{ marginTop: 22, opacity: submitting ? 0.5 : 1 }}>
                {submitting ? "Saving…" : "Add Relationship"}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Edit relationship sheet */}
      {editRelId && editRelForm && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setEditRelId(null)} aria-hidden="true" />
          <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Edit relationship">
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <button type="button" className="ios-btn--plain" onClick={() => setEditRelId(null)}>Cancel</button>
              <span className="ios-headline">Edit relationship</span>
              <span style={{ width: 52 }} />
            </div>

            <form onSubmit={saveEditRel} style={{ overflowY: "auto" }}>
              {([["name", "Name"], ["role", "Role"], ["organization", "Organization"]] as const).map(([k, l]) => (
                <div key={k}>
                  <div className="ios-group-header" style={{ padding: k === "name" ? "0 0 8px" : "18px 0 8px" }}>{l}</div>
                  <input value={editRelForm[k]} onChange={(e) => setEditRelForm((f) => f ? { ...f, [k]: e.target.value } : f)} style={inputStyle} />
                </div>
              ))}

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Type</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {relationshipTypes.map((t) => (
                  <Chip key={t} small selected={editRelForm.relationship_type === t} onClick={() => setEditRelForm((f) => f ? { ...f, relationship_type: t } : f)}>
                    {typeLabels[t] ?? t}
                  </Chip>
                ))}
              </div>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Frequency</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.keys(FREQ_BADGES).map((k) => (
                  <Chip key={k} small selected={editRelForm.meeting_frequency === k} onClick={() => setEditRelForm((f) => f ? { ...f, meeting_frequency: k } : f)}>
                    {FREQ_BADGES[k].label}
                  </Chip>
                ))}
              </div>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Notes</div>
              <textarea value={editRelForm.notes} onChange={(e) => setEditRelForm((f) => f ? { ...f, notes: e.target.value } : f)} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />

              <button type="submit" disabled={submitting} className="ios-btn ios-btn--primary" style={{ marginTop: 22, opacity: submitting ? 0.5 : 1 }}>
                {submitting ? "Saving…" : "Save"}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Log interaction sheet */}
      {interactionFormFor && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setInteractionFormFor(null)} aria-hidden="true" />
          <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Log interaction">
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <button type="button" className="ios-btn--plain" onClick={() => setInteractionFormFor(null)}>Cancel</button>
              <span className="ios-headline">Log interaction</span>
              <span style={{ width: 52 }} />
            </div>

            {interRel && (
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "0 0 8px" }}>with {interRel.name}</div>
            )}

            <form onSubmit={(e) => submitInteraction(interactionFormFor, e)} style={{ overflowY: "auto" }}>
              {error && (
                <p className="ios-footnote" style={{ padding: "0 0 12px", color: "var(--ios-red)" }}>{error}</p>
              )}

              <div className="ios-group-header" style={{ padding: "0 0 8px" }}>Date</div>
              <input type="date" name="date" value={interForm.date} onChange={handleInterChange} style={inputStyle} />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Type</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {INTERACTION_TYPES.map((t) => (
                  <Chip key={t} small selected={interForm.interaction_type === t} onClick={() => setInterForm((p) => ({ ...p, interaction_type: t }))}>
                    {labelForType(t)}
                  </Chip>
                ))}
              </div>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Notes</div>
              <textarea name="notes" value={interForm.notes} onChange={handleInterChange} rows={2} placeholder="What did you discuss?" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Insights</div>
              <textarea name="insights" value={interForm.insights} onChange={handleInterChange} rows={2} placeholder="Key takeaways or advice received" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Action items (one per line)</div>
              <textarea name="action_items" value={interForm.action_items} onChange={handleInterChange} rows={2} placeholder="Follow-up tasks…" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />

              {goals.length > 0 && (
                <>
                  <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Link to goals</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {goals.map((g) => (
                      <Chip key={g.id} small selected={interForm.linked_goal_ids.includes(g.id)} onClick={() => toggleInterGoal(g.id)}>
                        {g.title}
                      </Chip>
                    ))}
                  </div>
                </>
              )}

              <button type="submit" disabled={submitting} className="ios-btn ios-btn--primary" style={{ marginTop: 22, opacity: submitting ? 0.5 : 1 }}>
                {submitting ? "Saving…" : "Log Interaction"}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Grouped relationships */}
      {!hasAny ? (
        <Group footer="Add your mentors, coaches, and peers to track how you invest in relationships.">
          <button type="button" className="ios-cell" onClick={() => setShowAddRelForm(true)} style={{ color: "var(--ios-tint)" }}>
            <span className="ios-cell-lead">
              <IconBadge color="var(--ios-tint)">
                <span style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>+</span>
              </IconBadge>
            </span>
            <span className="ios-cell-body">
              <span className="ios-cell-title" style={{ color: "var(--ios-tint)" }}>Add your first relationship</span>
            </span>
          </button>
        </Group>
      ) : (
        relationshipTypes.map((type) => {
          const rels = grouped[type] ?? [];
          if (rels.length === 0) return null;
          if (typeFilter !== "all" && typeFilter !== type) return null;
          const color = typeColors[type] ?? "var(--ios-label-2)";
          return (
            <Group key={type} header={typeLabels[type]}>
              {rels.map((rel) => {
                const freq = FREQ_BADGES[rel.meeting_frequency ?? ""] ?? null;
                return (
                  <div key={rel.id} className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <span className="ios-cell-lead">
                        <IconBadge color={color}>
                          <span style={{ color: "#fff", fontWeight: 600, fontSize: 12 }}>{initials(rel.name)}</span>
                        </IconBadge>
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ios-headline">{rel.name}</div>
                        {rel.role && <div className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>{rel.role}</div>}
                        {rel.organization && <div className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>{rel.organization}</div>}
                        {rel.last_interaction_date && (
                          <div className="ios-footnote" style={{ color: "var(--ios-label-3)", marginTop: 2 }}>
                            Last interaction: {formatDate(rel.last_interaction_date)}
                          </div>
                        )}
                      </div>
                      {freq && (
                        <span className="ios-caption" style={{ fontWeight: 600, color: freq.color, flexShrink: 0 }}>{freq.label}</span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => { setInteractionFormFor(rel.id); setError(null); }} className="ios-btn--plain" style={{ padding: 0, fontSize: 15 }}>
                        Log interaction
                      </button>
                      <button type="button" onClick={() => openEditRel(rel)} className="ios-btn--plain" style={{ padding: 0, fontSize: 15 }}>
                        Edit
                      </button>
                      <button type="button" onClick={() => deleteRel(rel.id)} disabled={deletingId === rel.id} className="ios-btn--plain" style={{ padding: 0, fontSize: 15, color: "var(--ios-red)" }}>
                        {deletingId === rel.id ? "…" : "Remove"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </Group>
          );
        })
      )}
    </div>
  );
}
