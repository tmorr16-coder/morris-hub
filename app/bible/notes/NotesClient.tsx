"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Note {
  id: string;
  reference: string;
  content: string;
  tags: string[];
  book_id: string;
  chapter_num: number;
  verse_start?: number;
  created_at: string;
  updated_at: string;
}

export default function NotesClient({ initialNotes, userId }: { initialNotes: Note[]; userId: string }) {
  const [notes, setNotes] = useState(initialNotes);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const db = createClient() as any;

  const filtered = notes.filter((n) =>
    n.content.toLowerCase().includes(search.toLowerCase()) ||
    n.reference.toLowerCase().includes(search.toLowerCase()) ||
    (n.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  async function saveEdit(noteId: string) {
    setSaving(true);
    await db.schema("bible").from("notes").update({ content: editContent, updated_at: new Date().toISOString() }).eq("id", noteId).eq("user_id", userId);
    setNotes(notes.map((n) => n.id === noteId ? { ...n, content: editContent } : n));
    setEditing(null);
    setSaving(false);
  }

  async function deleteNote(noteId: string) {
    if (!confirm("Delete this note?")) return;
    await db.schema("bible").from("notes").delete().eq("id", noteId).eq("user_id", userId);
    setNotes(notes.filter((n) => n.id !== noteId));
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif, serif)", fontSize: 26, fontWeight: 400, margin: 0 }}>
          My Notes
        </h1>
        <span style={{ fontSize: 13, color: "var(--color-ink-3)" }}>{notes.length} notes</span>
      </div>

      <input
        placeholder="Search notes…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "10px 14px", border: "1px solid var(--color-rule)",
          borderRadius: 10, fontSize: 14, fontFamily: "inherit",
          background: "var(--color-bg-card)", marginBottom: 20, boxSizing: "border-box",
        }}
      />

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-ink-3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
          {notes.length === 0
            ? <div>No notes yet. Tap a verse while reading to add one.</div>
            : <div>No notes match your search.</div>
          }
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map((note) => (
          <div key={note.id} style={{
            background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
            borderRadius: 12, padding: "16px 20px", boxShadow: "var(--shadow-card)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
              <Link href={`/bible/read/${note.book_id}/${note.chapter_num}`} style={{
                fontSize: 12, fontWeight: 700, color: "var(--color-accent)", textDecoration: "none",
              }}>
                {note.reference}
              </Link>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => { setEditing(note.id); setEditContent(note.content); }}
                  style={{ background: "none", border: "none", fontSize: 13, cursor: "pointer", color: "var(--color-ink-3)" }}>
                  ✎ Edit
                </button>
                <button onClick={() => deleteNote(note.id)}
                  style={{ background: "none", border: "none", fontSize: 13, cursor: "pointer", color: "var(--color-red)" }}>
                  ✕
                </button>
              </div>
            </div>

            {editing === note.id ? (
              <div>
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                  style={{
                    width: "100%", minHeight: 80, padding: "8px 10px",
                    border: "1px solid var(--color-rule)", borderRadius: 8,
                    fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => saveEdit(note.id)} disabled={saving}
                    style={{ padding: "6px 14px", background: "var(--color-accent)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => setEditing(null)}
                    style={{ padding: "6px 12px", border: "1px solid var(--color-rule)", background: "transparent", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: "var(--color-ink-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {note.content}
              </div>
            )}

            {(note.tags ?? []).length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {note.tags.map((tag) => (
                  <span key={tag} style={{ padding: "2px 8px", background: "var(--color-accent-soft)", color: "var(--color-accent)", borderRadius: 12, fontSize: 11, fontWeight: 500 }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 10 }}>
              {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
