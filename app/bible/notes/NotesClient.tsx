"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LargeTitle, IconBadge, Icons } from "@/components/ios";

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

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17, flex: "0 0 auto" }} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }} aria-hidden>
      <path d="M4 7h16" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6.5 7l.7 11a1.5 1.5 0 0 0 1.5 1.4h6.6a1.5 1.5 0 0 0 1.5-1.4l.7-11" />
    </svg>
  );
}

export default function NotesClient({ initialNotes, userId }: { initialNotes: Note[]; userId: string }) {
  const [notes, setNotes] = useState(initialNotes);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    <>
      <LargeTitle title="Notes" subtitle={`${notes.length} ${notes.length === 1 ? "note" : "notes"}`} />

      {/* Search field */}
      <div style={{ padding: "6px var(--ios-gutter) 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--ios-fill)", borderRadius: 10, padding: "9px 12px", color: "var(--ios-label-3)" }}>
          <SearchGlyph />
          <input
            placeholder="Search notes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontSize: 17, color: "var(--ios-label)" }}
          />
        </div>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--ios-label-2)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: 26, background: "var(--ios-fill)", color: "var(--ios-label-3)", marginBottom: 14 }}>
            <Icons.ComposeIcon aria-hidden style={{ width: 26, height: 26 }} />
          </span>
          <div className="ios-body">
            {notes.length === 0
              ? "No notes yet. Tap a verse while reading to add one."
              : "No notes match your search."}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 0 8px" }}>
        {filtered.map((note) => (
          <div key={note.id} style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", margin: "0 var(--ios-gutter)", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <IconBadge color="#5E5CE6"><Icons.ComposeIcon /></IconBadge>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/bible/read/${note.book_id}/${note.chapter_num}`} className="ios-headline" style={{ color: "var(--ios-tint)", textDecoration: "none" }}>
                  {note.reference}
                </Link>
                <div className="ios-footnote ios-num" style={{ color: "var(--ios-label-3)", marginTop: 1 }}>
                  {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => { setEditing(note.id); setEditContent(note.content); }}
                  aria-label="Edit note"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 17, color: "var(--ios-tint)" }}
                >
                  <Icons.ComposeIcon aria-hidden style={{ width: 19, height: 19 }} />
                </button>
                <button
                  onClick={() => deleteNote(note.id)}
                  aria-label="Delete note"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 17, color: "var(--ios-red)" }}
                >
                  <TrashGlyph />
                </button>
              </div>
            </div>

            {editing === note.id ? (
              <div style={{ marginTop: 12 }}>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{ width: "100%", minHeight: 88, padding: "10px 12px", background: "var(--ios-fill)", border: "none", borderRadius: 10, fontSize: 16, lineHeight: 1.5, color: "var(--ios-label)", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => saveEdit(note.id)}
                    disabled={saving}
                    style={{ padding: "8px 18px", borderRadius: 999, background: "var(--ios-tint)", color: "var(--ios-on-tint)", fontSize: 15, fontWeight: 600, opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    style={{ padding: "8px 16px", borderRadius: 999, background: "var(--ios-fill)", color: "var(--ios-label)", fontSize: 15, fontWeight: 500 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="ios-body" style={{ color: "var(--ios-label)", lineHeight: 1.5, whiteSpace: "pre-wrap", marginTop: 10 }}>
                {note.content}
              </div>
            )}

            {(note.tags ?? []).length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                {note.tags.map((tag) => (
                  <span key={tag} className="ios-chip ios-chip--sm">#{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ height: 12 }} />
    </>
  );
}
