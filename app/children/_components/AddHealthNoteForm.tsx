"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChildHealthNote } from "../_lib/children";

interface Props {
  childId: string;
  viewerUserId: string;
  onAdded: (note: ChildHealthNote) => void;
}

export default function AddHealthNoteForm({ childId, viewerUserId, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [targetVisitDate, setTargetVisitDate] = useState("");
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    const { data, error } = await db.schema("hub").from("child_health_notes")
      .insert({
        child_id: childId,
        note: note.trim(),
        target_visit_date: targetVisitDate || null,
        created_by: viewerUserId,
      })
      .select("id, note, target_visit_date, resolved")
      .single();
    setSaving(false);
    if (!error && data) {
      onAdded({ id: data.id, note: data.note, targetVisitDate: data.target_visit_date, resolved: data.resolved });
      setNote("");
      setTargetVisitDate("");
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
        + Add note for next visit
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{
      display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px",
      background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 10,
    }}>
      <textarea
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Ask about the recurring headaches, follow up on allergy meds…"
        rows={3}
        style={{ padding: "8px 10px", border: "1px solid var(--color-rule)", borderRadius: 7, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
      />
      <div>
        <label style={{ fontSize: 11, color: "var(--color-ink-4)", display: "block", marginBottom: 4 }}>Target visit date (optional)</label>
        <input
          type="date"
          value={targetVisitDate}
          onChange={(e) => setTargetVisitDate(e.target.value)}
          style={{ padding: "8px 10px", border: "1px solid var(--color-rule)", borderRadius: 7, fontSize: 13, fontFamily: "inherit", maxWidth: 160 }}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={saving || !note.trim()} style={{
          padding: "7px 16px", borderRadius: 8, border: "none", background: "var(--color-accent)",
          color: "#FFFDF8", fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>
          {saving ? "Adding…" : "Add note"}
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
