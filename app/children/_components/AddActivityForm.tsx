"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Chip, Icons } from "@/components/ios";
import type { ChildActivity } from "../_lib/children";

const CATEGORIES: { value: ChildActivity["category"]; label: string }[] = [
  { value: "school", label: "School" },
  { value: "sports", label: "Sports" },
  { value: "church", label: "Church" },
  { value: "other", label: "Other" },
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

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 12px", borderRadius: 10,
    border: "var(--ios-hair) solid var(--ios-separator)", background: "var(--ios-fill-2)",
    color: "var(--ios-label)", fontSize: 16, fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "12px 14px",
          background: "var(--ios-fill)", border: "none", borderRadius: 12, cursor: "pointer",
          color: "var(--ios-tint)", fontSize: 15, fontWeight: 600, fontFamily: "inherit", textAlign: "left",
        }}
      >
        <Icons.PlusIcon style={{ width: 15, height: 15 }} />
        Add activity
      </button>

      {open && (
        <div className="ios-sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="ios-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button type="button" className="ios-btn--plain" onClick={() => setOpen(false)}>Cancel</button>
              <span className="ios-headline">New activity</span>
              <span style={{ width: 52 }} />
            </div>

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's the activity?"
                style={inputStyle}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CATEGORIES.map((c) => (
                  <Chip key={c.value} small selected={category === c.value} onClick={() => setCategory(c.value)}>
                    {c.label}
                  </Chip>
                ))}
              </div>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                style={{ ...inputStyle, maxWidth: 180, colorScheme: "light dark" }}
              />
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="ios-btn ios-btn--primary"
                style={{ opacity: saving || !title.trim() ? 0.5 : 1, marginTop: 4 }}
              >
                {saving ? "Adding…" : "Add activity"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
