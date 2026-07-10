"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface JournalEntry {
  id: string;
  title: string | null;
  content: string;
  mood: number | null;
  created_at: string;
  updated_at: string;
}

export default function JournalClient({ initialEntries, userId }: { initialEntries: JournalEntry[]; userId: string }) {
  const [entries, setEntries] = useState(initialEntries);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any;

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    const { data, error } = await db.schema("hub").from("journal_entries")
      .insert({ user_id: userId, title: title.trim() || null, content: content.trim() })
      .select("id, title, content, mood, created_at, updated_at")
      .single();
    setSaving(false);
    if (!error && data) {
      setEntries((prev) => [data, ...prev]);
      setTitle(""); setContent(""); setFormOpen(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this journal entry? This can't be undone.")) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await db.schema("hub").from("journal_entries").delete().eq("id", id);
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function startEdit(e: JournalEntry) {
    setEditingId(e.id);
    setEditTitle(e.title ?? "");
    setEditContent(e.content);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    if (!editContent.trim()) return;
    setEditSaving(true);
    const updated_at = new Date().toISOString();
    const { data, error } = await db.schema("hub").from("journal_entries")
      .update({ title: editTitle.trim() || null, content: editContent.trim(), updated_at })
      .eq("id", id)
      .select("id, title, content, mood, created_at, updated_at")
      .single();
    setEditSaving(false);
    if (!error && data) {
      setEntries((prev) => prev.map((e) => (e.id === id ? data : e)));
      setEditingId(null);
    }
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <span className="ios-footnote" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--ios-label-2)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Private to you — never shared.
        </span>
        <button onClick={() => setFormOpen((o) => !o)} className="ios-subhead" style={{ color: "var(--ios-tint)", fontWeight: 500, flexShrink: 0 }}>
          {formOpen ? "Cancel" : "New entry"}
        </button>
      </div>

      {formOpen && (
        <form onSubmit={addEntry} style={{
          background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)",
          padding: "16px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 10,
        }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            style={{ padding: "10px 12px", border: "var(--ios-hair) solid var(--ios-separator)", borderRadius: 10, background: "var(--ios-bg)", color: "var(--ios-label)", fontSize: 16 }}
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            required
            style={{ minHeight: 160, padding: "10px 12px", border: "var(--ios-hair) solid var(--ios-separator)", borderRadius: 10, background: "var(--ios-bg)", color: "var(--ios-label)", fontSize: 16, resize: "vertical" }}
          />
          <button type="submit" disabled={saving || !content.trim()} className="ios-btn ios-btn--primary" style={{ alignSelf: "flex-start", width: "auto", minHeight: 0, padding: "11px 20px", fontSize: 15, opacity: saving || !content.trim() ? 0.5 : 1 }}>
            {saving ? "Saving…" : "Save entry"}
          </button>
        </form>
      )}

      {entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ios-label-2)" }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, color: "var(--ios-label-3)" }} aria-hidden="true">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5Z" />
            <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
          </svg>
          <div className="ios-headline">No entries yet</div>
          <div className="ios-footnote" style={{ marginTop: 4, color: "var(--ios-label-2)" }}>Start writing — nobody but you will ever see this.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {entries.map((e) => (
            <div key={e.id} style={{
              background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)",
              padding: "16px",
            }}>
              {editingId === e.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    value={editTitle}
                    onChange={(ev) => setEditTitle(ev.target.value)}
                    placeholder="Title (optional)"
                    style={{ padding: "10px 12px", border: "var(--ios-hair) solid var(--ios-separator)", borderRadius: 10, background: "var(--ios-bg)", color: "var(--ios-label)", fontSize: 16 }}
                  />
                  <textarea
                    value={editContent}
                    onChange={(ev) => setEditContent(ev.target.value)}
                    style={{ minHeight: 140, padding: "10px 12px", border: "var(--ios-hair) solid var(--ios-separator)", borderRadius: 10, background: "var(--ios-bg)", color: "var(--ios-label)", fontSize: 16, resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => saveEdit(e.id)} disabled={editSaving || !editContent.trim()} className="ios-btn ios-btn--primary" style={{ width: "auto", minHeight: 0, padding: "9px 18px", fontSize: 15, opacity: editSaving || !editContent.trim() ? 0.5 : 1 }}>
                      {editSaving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={cancelEdit} className="ios-subhead" style={{ color: "var(--ios-tint)", padding: "9px 14px" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                    <div>
                      {e.title && <div className="ios-headline">{e.title}</div>}
                      <div className="ios-caption" style={{ color: "var(--ios-label-2)" }}>
                        {new Date(e.created_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                        {e.updated_at !== e.created_at && " · edited"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                      <button onClick={() => startEdit(e)} className="ios-footnote" style={{ color: "var(--ios-tint)", fontWeight: 500 }}>
                        Edit
                      </button>
                      <button onClick={() => remove(e.id)} className="ios-footnote" style={{ color: "var(--ios-red)", fontWeight: 500 }}>
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="ios-subhead" style={{ color: "var(--ios-label)", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{e.content}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
