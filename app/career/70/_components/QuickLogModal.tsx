"use client";

import { useState } from "react";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function QuickLogModal({ onClose, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/career/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          experience_date: date,
          description: description.trim() || null,
          experience_type: "other",
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.12)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--color-rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-accent)", marginBottom: 2 }}>⚡ Quick Log</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-ink)" }}>Log an experience</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--color-ink-3)" }}>✕</button>
        </div>

        <form onSubmit={save} style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Title */}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>
              What did you do? <span style={{ color: "var(--color-red)" }}>*</span>
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Led the Q3 planning retrospective"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${error ? "var(--color-red)" : "var(--color-rule)"}`, background: "var(--color-bg)", color: "var(--color-ink)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Date */}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg)", color: "var(--color-ink)", fontSize: 14, fontFamily: "inherit", outline: "none" }}
            />
          </div>

          {/* Optional details */}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>
              Details <span style={{ fontWeight: 400, color: "var(--color-ink-4)" }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any context, reflection, or what you learned…"
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg)", color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          {error && <div style={{ fontSize: 12, color: "var(--color-red)" }}>{error}</div>}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-2)", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !title.trim()} style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: saving || !title.trim() ? "not-allowed" : "pointer", opacity: saving || !title.trim() ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Log it"}
            </button>
          </div>

          <div style={{ textAlign: "center", fontSize: 11, color: "var(--color-ink-4)" }}>
            You can add reflection, skills, and goals from the full form later.
          </div>
        </form>
      </div>
    </div>
  );
}
