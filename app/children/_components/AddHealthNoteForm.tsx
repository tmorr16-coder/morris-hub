"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icons } from "@/components/ios";
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
        Add note for next visit
      </button>

      {open && (
        <div className="ios-sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="ios-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button type="button" className="ios-btn--plain" onClick={() => setOpen(false)}>Cancel</button>
              <span className="ios-headline">Note for next visit</span>
              <span style={{ width: 52 }} />
            </div>

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Ask about the recurring headaches, follow up on allergy meds…"
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
              <div>
                <label className="ios-footnote" style={{ display: "block", marginBottom: 6, color: "var(--ios-label-2)" }}>
                  Target visit date (optional)
                </label>
                <input
                  type="date"
                  value={targetVisitDate}
                  onChange={(e) => setTargetVisitDate(e.target.value)}
                  style={{ ...inputStyle, maxWidth: 180, colorScheme: "light dark" }}
                />
              </div>
              <button
                type="submit"
                disabled={saving || !note.trim()}
                className="ios-btn ios-btn--primary"
                style={{ opacity: saving || !note.trim() ? 0.5 : 1, marginTop: 4 }}
              >
                {saving ? "Adding…" : "Add note"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
