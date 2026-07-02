"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChildActivity } from "../_lib/children";

const CATEGORIES: { value: ChildActivity["category"]; label: string; emoji: string }[] = [
  { value: "school", label: "School", emoji: "📚" },
  { value: "sports", label: "Sports", emoji: "⚽" },
  { value: "church", label: "Church", emoji: "🕊️" },
  { value: "other", label: "Other", emoji: "⭐" },
];

interface Props {
  childId: string;
  viewerUserId: string;
  defaultCategory?: ChildActivity["category"];
  onAdded: (activity: ChildActivity) => void;
}

export default function AddActivityForm({ childId, viewerUserId, defaultCategory, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ChildActivity["category"]>(defaultCategory ?? "school");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const { data, error } = await db.schema("hub").from("child_activities")
      .insert({
        child_id: childId,
        category,
        title: title.trim(),
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        created_by: viewerUserId,
      })
      .select("id, category, title, notes, due_at, completed")
      .single();
    setSaving(false);
    if (!error && data) {
      onAdded({
        id: data.id,
        category: data.category,
        title: data.title,
        notes: data.notes,
        dueAt: data.due_at,
        completed: data.completed,
      });
      setTitle("");
      setDueAt("");
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        fontSize: 12, fontWeight: 600, color: "var(--color-accent)", background: "none",
        border: "1px dashed var(--color-rule)", borderRadius: 8, padding: "8px 14px",
        cursor: "pointer", fontFamily: "var(--font-geist, system-ui), sans-serif", width: "100%", textAlign: "left",
      }}>
        + Add activity
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{
      display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px",
      background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 10,
    }}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What's the activity?"
        style={{ padding: "8px 10px", border: "1px solid var(--color-rule)", borderRadius: 7, fontSize: 13, fontFamily: "inherit" }}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            style={{
              padding: "5px 11px", borderRadius: 7, fontSize: 12, cursor: "pointer",
              border: category === c.value ? "1.5px solid var(--color-accent)" : "1px solid var(--color-rule)",
              background: category === c.value ? "var(--color-accent-soft)" : "transparent",
              color: category === c.value ? "var(--color-accent)" : "var(--color-ink-3)",
            }}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>
      <input
        type="date"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
        style={{ padding: "8px 10px", border: "1px solid var(--color-rule)", borderRadius: 7, fontSize: 13, fontFamily: "inherit", maxWidth: 160 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={saving || !title.trim()} style={{
          padding: "7px 16px", borderRadius: 8, border: "none", background: "var(--color-accent)",
          color: "#FFFDF8", fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>
          {saving ? "Adding…" : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{
          padding: "7px 16px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent",
          color: "var(--color-ink-3)", fontSize: 12, cursor: "pointer",
        }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
