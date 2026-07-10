"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Group, Segmented, Chip, IconBadge, Icons } from "@/components/ios";

const LEARNING_TYPES = ["course", "conference", "book", "workshop", "other"];
const STATUS_OPTIONS = ["planned", "in_progress", "completed", "paused"];

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

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
  const [filter, setFilter] = useState<string>("all");

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const statusesPresent = Array.from(
    new Set(learningItems.map((i) => i.status ?? "planned"))
  );
  const filterOptions = [
    { value: "all", label: "All" },
    ...statusesPresent.map((s) => ({ value: s, label: titleCase(s) })),
  ];
  const visible = learningItems.filter(
    (i) => filter === "all" || (i.status ?? "planned") === filter
  );

  return (
    <section>
      {/* Header + add */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 16px 10px" }}>
        <h2 className="ios-title-3" style={{ margin: 0 }}>Courses, Books &amp; Conferences</h2>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="ios-btn--plain"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 0 }}
        >
          <Icons.PlusIcon style={{ width: 16, height: 16 }} /> Add
        </button>
      </div>

      {/* Status filter */}
      {filterOptions.length > 2 && (
        <div style={{ padding: "0 16px 4px" }}>
          <Segmented options={filterOptions} value={filter} onChange={setFilter} ariaLabel="Filter by status" />
        </div>
      )}

      {/* Add sheet */}
      {showForm && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setShowForm(false)} aria-hidden="true" />
          <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Add learning item">
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <button type="button" className="ios-btn--plain" onClick={() => setShowForm(false)}>Cancel</button>
              <span className="ios-headline">Add learning</span>
              <span style={{ width: 52 }} />
            </div>

            <form onSubmit={handleSubmit} style={{ overflowY: "auto" }}>
              {error && (
                <p className="ios-footnote" style={{ padding: "0 0 12px", color: "var(--ios-red)" }}>{error}</p>
              )}

              <div className="ios-group-header" style={{ padding: "0 0 8px" }}>
                Title <span style={{ color: "var(--ios-red)" }}>*</span>
              </div>
              <input name="title" value={form.title} onChange={handleChange} required placeholder="e.g. Deep Work by Cal Newport" style={inputStyle} />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Type</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LEARNING_TYPES.map((t) => (
                  <Chip key={t} small selected={form.learning_type === t} onClick={() => setForm((p) => ({ ...p, learning_type: t }))}>
                    {titleCase(t)}
                  </Chip>
                ))}
              </div>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Status</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {STATUS_OPTIONS.map((s) => (
                  <Chip key={s} small selected={form.status === s} onClick={() => setForm((p) => ({ ...p, status: s }))}>
                    {titleCase(s)}
                  </Chip>
                ))}
              </div>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Provider / Author</div>
              <input name="provider" value={form.provider} onChange={handleChange} placeholder="e.g. Coursera, O&apos;Reilly" style={inputStyle} />

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Start date</div>
                  <input type="date" name="start_date" value={form.start_date} onChange={handleChange} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>End / target</div>
                  <input type="date" name="end_date" value={form.end_date} onChange={handleChange} style={inputStyle} />
                </div>
              </div>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>URL</div>
              <input name="url" value={form.url} onChange={handleChange} type="url" placeholder="https://…" style={inputStyle} />

              {goals.length > 0 && (
                <>
                  <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Link to goals</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {goals.map((g) => (
                      <Chip key={g.id} small selected={form.linked_goal_ids.includes(g.id)} onClick={() => toggleGoal(g.id)}>
                        {g.title}
                      </Chip>
                    ))}
                  </div>
                </>
              )}

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Notes</div>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="Why are you taking this? Key things to learn…" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />

              <button type="submit" disabled={submitting} className="ios-btn ios-btn--primary" style={{ marginTop: 22, opacity: submitting ? 0.5 : 1 }}>
                {submitting ? "Saving…" : "Add Learning"}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Edit sheet */}
      {editItemId && editForm && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setEditItemId(null)} aria-hidden="true" />
          <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Edit learning item">
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <button type="button" className="ios-btn--plain" onClick={() => setEditItemId(null)}>Cancel</button>
              <span className="ios-headline">Edit learning</span>
              <span style={{ width: 52 }} />
            </div>

            <form onSubmit={saveEditItem} style={{ overflowY: "auto" }}>
              <div className="ios-group-header" style={{ padding: "0 0 8px" }}>Title</div>
              <input required value={editForm.title} onChange={(e) => setEditForm((f) => f ? { ...f, title: e.target.value } : f)} style={inputStyle} />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Type</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LEARNING_TYPES.map((t) => (
                  <Chip key={t} small selected={editForm.learning_type === t} onClick={() => setEditForm((f) => f ? { ...f, learning_type: t } : f)}>
                    {titleCase(t)}
                  </Chip>
                ))}
              </div>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Status</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["planned", "in_progress", "completed"].map((s) => (
                  <Chip key={s} small selected={editForm.status === s} onClick={() => setEditForm((f) => f ? { ...f, status: s } : f)}>
                    {titleCase(s)}
                  </Chip>
                ))}
              </div>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Provider</div>
              <input value={editForm.provider} onChange={(e) => setEditForm((f) => f ? { ...f, provider: e.target.value } : f)} style={inputStyle} />

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Start date</div>
                  <input type="date" value={editForm.start_date} onChange={(e) => setEditForm((f) => f ? { ...f, start_date: e.target.value } : f)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>End date</div>
                  <input type="date" value={editForm.end_date} onChange={(e) => setEditForm((f) => f ? { ...f, end_date: e.target.value } : f)} style={inputStyle} />
                </div>
              </div>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>URL</div>
              <input type="url" value={editForm.url} onChange={(e) => setEditForm((f) => f ? { ...f, url: e.target.value } : f)} placeholder="https://" style={inputStyle} />

              <button type="submit" disabled={submitting} className="ios-btn ios-btn--primary" style={{ marginTop: 22, opacity: submitting ? 0.5 : 1 }}>
                {submitting ? "Saving…" : "Save"}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Learning list */}
      {visible.length === 0 ? (
        <Group footer="Track the courses, books, and conferences you're learning from.">
          <button type="button" className="ios-cell" onClick={() => setShowForm(true)} style={{ color: "var(--ios-tint)" }}>
            <span className="ios-cell-lead">
              <IconBadge color="var(--ios-tint)"><Icons.PlusIcon /></IconBadge>
            </span>
            <span className="ios-cell-body">
              <span className="ios-cell-title" style={{ color: "var(--ios-tint)" }}>Add a learning item</span>
            </span>
          </button>
        </Group>
      ) : (
        <div className="ios-list" style={{ margin: "12px 16px 0" }}>
          {visible.map((item) => {
            const typeColor = typeColors[item.learning_type ?? "other"] ?? typeColors.other;
            const statusColor = statusColors[item.status ?? "planned"] ?? "var(--ios-label-2)";
            return (
              <div key={item.id} className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span className="ios-cell-lead">
                    <IconBadge color={typeColor}><Icons.BookIcon /></IconBadge>
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="ios-caption" style={{ textTransform: "uppercase", letterSpacing: "0.02em", fontWeight: 600, color: typeColor }}>
                        {item.learning_type ?? "other"}
                      </span>
                      <span className="ios-caption" style={{ fontWeight: 600, color: statusColor }}>
                        {titleCase(item.status ?? "planned")}
                      </span>
                    </div>
                    <div className="ios-headline" style={{ marginTop: 2 }}>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ios-label)", textDecoration: "none" }}>
                          {item.title}
                        </a>
                      ) : item.title}
                    </div>
                    {item.provider && (
                      <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>{item.provider}</div>
                    )}
                    {(item.start_date || item.end_date) && (
                      <div className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>
                        {item.start_date && formatDate(item.start_date)}
                        {item.start_date && item.end_date && " – "}
                        {item.end_date && formatDate(item.end_date)}
                      </div>
                    )}
                  </div>
                </div>

                {(item.linked_goal_ids ?? []).length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(item.linked_goal_ids ?? []).map((gid: string) =>
                      goalsMap[gid] ? (
                        <span key={gid} className="ios-caption" style={{ background: "var(--ios-fill)", color: "var(--ios-label-2)", borderRadius: 6, padding: "2px 8px" }}>
                          {goalsMap[gid]}
                        </span>
                      ) : null
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: 16 }}>
                  <button type="button" onClick={() => editItemId === item.id ? setEditItemId(null) : openEditItem(item)} className="ios-btn--plain" style={{ padding: 0, fontSize: 15 }}>
                    Edit
                  </button>
                  <button type="button" onClick={() => deleteItem(item.id)} disabled={deletingId === item.id} className="ios-btn--plain" style={{ padding: 0, fontSize: 15, color: "var(--ios-red)" }}>
                    {deletingId === item.id ? "…" : "Remove"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
