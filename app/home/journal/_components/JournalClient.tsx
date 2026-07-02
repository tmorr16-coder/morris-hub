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

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 100px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <h1 className="serif" style={{ fontSize: 30, margin: 0 }}>Journal</h1>
        <button onClick={() => setFormOpen((o) => !o)}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {formOpen ? "Cancel" : "+ New entry"}
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
          padding: "2px 8px", borderRadius: 8, background: "rgba(59,92,127,0.1)", color: "var(--color-accent)",
        }}>
          🔒 Private to you
        </span>
        <span style={{ fontSize: 12, color: "var(--color-ink-4)" }}>Never shared, no matter what — that&apos;s the point.</span>
      </div>

      {formOpen && (
        <form onSubmit={addEntry} style={{
          background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12,
          padding: "18px 20px", marginBottom: 24, display: "flex", flexDirection: "column", gap: 10,
        }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            style={{ padding: "9px 12px", border: "1px solid var(--color-rule)", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }}
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            required
            style={{ minHeight: 160, padding: "10px 12px", border: "1px solid var(--color-rule)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
          />
          <button type="submit" disabled={saving || !content.trim()}
            style={{ alignSelf: "flex-start", padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {saving ? "Saving…" : "Save entry"}
          </button>
        </form>
      )}

      {entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-ink-4)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📓</div>
          <div style={{ fontWeight: 600 }}>No entries yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Start writing — nobody but you will ever see this.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {entries.map((e) => (
            <div key={e.id} style={{
              background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12,
              padding: "16px 20px", boxShadow: "var(--shadow-card)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                <div>
                  {e.title && <div style={{ fontWeight: 600, fontSize: 15, color: "var(--color-ink)" }}>{e.title}</div>}
                  <div style={{ fontSize: 11, color: "var(--color-ink-4)" }}>
                    {new Date(e.created_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                  </div>
                </div>
                <button onClick={() => remove(e.id)}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-4)", cursor: "pointer", flexShrink: 0 }}>
                  Delete
                </button>
              </div>
              <p style={{ fontSize: 14, color: "var(--color-ink-2)", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{e.content}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
