"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { List, Segmented } from "@/components/ios";
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const header: React.CSSProperties = { padding: "0 4px 7px" };
  const footnote: React.CSSProperties = { color: "var(--ios-label-2)", padding: "7px 4px 0" };
  const control: React.CSSProperties = {
    width: "100%", padding: "12px 16px", background: "transparent", border: "none",
    color: "var(--ios-label)", fontSize: 17, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const activeSize = FONT_SIZES.find((f) => f.key === fontSize)?.size ?? 16;

  return (
    <>
      {/* Translation */}
      <section style={{ marginTop: 16 }}>
        <h2 className="ios-group-header" style={header}>Preferred translation</h2>
        <List style={{ margin: 0 }}>
          <select value={bibleId} onChange={(e) => setBibleId(e.target.value)} style={{ ...control, appearance: "none", WebkitAppearance: "none" }}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>{v.abbreviation} — {v.name}</option>
            ))}
          </select>
        </List>
        <p className="ios-footnote" style={footnote}>
          Used as the default when you open a chapter. You can still switch translations while reading.
        </p>
      </section>

      {/* Font size */}
      <section style={{ marginTop: 22 }}>
        <h2 className="ios-group-header" style={header}>Reading font size</h2>
        <Segmented
          ariaLabel="Reading font size"
          value={fontSize}
          onChange={(v) => setFontSize(v)}
          options={FONT_SIZES.map((f) => ({ value: f.key, label: f.label }))}
          style={{ margin: 0 }}
        />
        <List style={{ margin: "12px 0 0" }}>
          <div style={{ padding: "16px", color: "var(--ios-label)", fontSize: activeSize, lineHeight: 1.5 }}>
            “The Lord is my shepherd; I shall not want.”
          </div>
        </List>
        <p className="ios-footnote" style={footnote}>
          Applied to chapter reading text. Headings and UI elements are unaffected.
        </p>
      </section>

      {/* Reading reminder */}
      <section style={{ marginTop: 22 }}>
        <h2 className="ios-group-header" style={header}>Daily reading reminder</h2>
        <List style={{ margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
            <span className="ios-body">Reminder time</span>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="ios-num"
              style={{ background: "var(--ios-fill)", border: "none", borderRadius: 8, padding: "6px 10px", color: "var(--ios-label)", fontSize: 16, outline: "none", colorScheme: "light dark" }}
            />
          </div>
        </List>
        <p className="ios-footnote" style={footnote}>
          Optional. Your preferred time for a daily reading reminder. Push notification support coming soon.
        </p>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="ios-btn ios-btn--primary"
        style={{ marginTop: 26, background: saved ? "var(--ios-green)" : "var(--ios-tint)", opacity: saving ? 0.7 : 1 }}
      >
        {saving ? "Saving…" : saved ? "Saved" : "Save settings"}
      </button>
    </>
  );
}
