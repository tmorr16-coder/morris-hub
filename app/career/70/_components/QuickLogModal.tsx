"use client";

import { useState } from "react";
import { IconBadge, Icons } from "@/components/ios";

interface Props {
  onClose: () => void;
  onSaved: () => void;
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
    <>
      <div className="ios-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Log an experience">
        <div className="ios-grabber" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <button type="button" className="ios-btn--plain" onClick={onClose}>Cancel</button>
          <span className="ios-headline">Quick Log</span>
          <span style={{ width: 52 }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0 18px" }}>
          <IconBadge color="var(--ios-tint)"><Icons.SparkleIcon /></IconBadge>
          <div>
            <div className="ios-headline">Log an experience</div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>Capture it now, add detail later</div>
          </div>
        </div>

        <form onSubmit={save}>
          <div className="ios-group-header" style={{ padding: "0 0 8px" }}>
            What did you do? <span style={{ color: "var(--ios-red)" }}>*</span>
          </div>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Led the Q3 planning retrospective"
            style={{ ...inputStyle, borderColor: error ? "var(--ios-red)" : "var(--ios-separator)" }}
          />

          <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Date</div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />

          <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>
            Details <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--ios-label-3)" }}>(optional)</span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any context, reflection, or what you learned…"
            rows={3}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />

          {error && <p className="ios-footnote" style={{ padding: "12px 0 0", color: "var(--ios-red)" }}>{error}</p>}

          <button
            type="submit"
            className="ios-btn ios-btn--primary"
            style={{ marginTop: 22, opacity: saving || !title.trim() ? 0.5 : 1 }}
            disabled={saving || !title.trim()}
          >
            {saving ? "Saving…" : "Log it"}
          </button>

          <p className="ios-footnote" style={{ textAlign: "center", padding: "12px 0 0", color: "var(--ios-label-3)" }}>
            You can add reflection, skills, and goals from the full form later.
          </p>
        </form>
      </div>
    </>
  );
}
