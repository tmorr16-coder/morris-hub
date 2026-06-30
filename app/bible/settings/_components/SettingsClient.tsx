"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BibleVersion } from "@/lib/bible-api";

const FONT_SIZES = [
  { key: "sm", label: "Small",   size: 14 },
  { key: "md", label: "Medium",  size: 16 },
  { key: "lg", label: "Large",   size: 19 },
  { key: "xl", label: "X-Large", size: 22 },
];

interface Props {
  versions: BibleVersion[];
  initialPrefs: { preferredBibleId: string; reminderTime: string; fontSize: string };
}

export default function SettingsClient({ versions, initialPrefs }: Props) {
  const [bibleId, setBibleId] = useState(initialPrefs.preferredBibleId);
  const [reminderTime, setReminderTime] = useState(initialPrefs.reminderTime);
  const [fontSize, setFontSize] = useState(initialPrefs.fontSize);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    const db = createClient() as any;
    const { data: { user } } = await db.auth.getUser();
    if (!user) { setSaving(false); return; }
    await db.schema("bible").from("user_preferences").upsert(
      { user_id: user.id, preferred_bible_id: bibleId, reminder_time: reminderTime || null, font_size: fontSize, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const label: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 8 };
  const card: React.CSSProperties = { background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "18px 20px", marginBottom: 14 };
  const select: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg)", color: "var(--color-ink)", fontSize: 14, fontFamily: "inherit", outline: "none" };

  return (
    <div>
      {/* Translation */}
      <div style={card}>
        <label style={label}>Preferred Translation</label>
        <select value={bibleId} onChange={(e) => setBibleId(e.target.value)} style={select}>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>{v.abbreviation} — {v.name}</option>
          ))}
        </select>
        <p style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 8 }}>
          Used as the default when you open a chapter. You can still switch translations while reading.
        </p>
      </div>

      {/* Font size */}
      <div style={card}>
        <label style={label}>Reading Font Size</label>
        <div style={{ display: "flex", gap: 8 }}>
          {FONT_SIZES.map((f) => (
            <button
              key={f.key}
              onClick={() => setFontSize(f.key)}
              style={{
                flex: 1, padding: "10px 6px", borderRadius: 8,
                border: `1.5px solid ${fontSize === f.key ? "var(--color-accent)" : "var(--color-rule)"}`,
                background: fontSize === f.key ? "var(--color-accent-soft)" : "transparent",
                color: fontSize === f.key ? "var(--color-accent)" : "var(--color-ink-3)",
                fontFamily: "var(--font-instrument-serif, serif)",
                fontSize: f.size, cursor: "pointer", textAlign: "center",
              }}
            >
              <div style={{ fontSize: 10, fontFamily: "inherit", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4, color: fontSize === f.key ? "var(--color-accent)" : "var(--color-ink-4)" }}>{f.label}</div>
              Aa
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 8 }}>
          Applied to chapter reading text. Headings and UI elements are unaffected.
        </p>
      </div>

      {/* Reading reminder */}
      <div style={card}>
        <label style={label}>Daily Reading Reminder</label>
        <input
          type="time"
          value={reminderTime}
          onChange={(e) => setReminderTime(e.target.value)}
          style={{ ...select, width: "auto", minWidth: 140 }}
        />
        <p style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 8 }}>
          Optional. Your preferred time for a daily reading reminder. Push notification support coming soon.
        </p>
      </div>

      <button
        onClick={save}
        disabled={saving}
        style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: saved ? "var(--color-green)" : "var(--color-accent)", color: "#FFFDF8", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1, transition: "background 0.2s" }}
      >
        {saving ? "Saving…" : saved ? "✓ Saved" : "Save settings"}
      </button>
    </div>
  );
}
