"use client";

import { useState } from "react";
import { Group, Cell } from "@/components/ios";
import { createClient } from "@/lib/supabase/client";

export interface WellnessEntry {
  id: string;
  date: string;
  mood: number | null;
  notes: string | null;
  created_at: string;
}

const MOOD_MOUTH: Record<number, string> = {
  1: "M8 16.5 Q12 12 16 16.5",
  2: "M8 15.5 Q12 13 16 15.5",
  3: "M8 15 H16",
  4: "M8 14 Q12 17 16 14",
  5: "M8 13.5 Q12 18 16 13.5",
};
const MOOD_LABEL: Record<number, string> = { 1: "Rough", 2: "Low", 3: "Okay", 4: "Good", 5: "Great" };

function MoodFace({ level, size = 24, color = "currentColor" }: { level: number; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="9" cy="10" r="0.6" fill={color} stroke="none" />
      <circle cx="15" cy="10" r="0.6" fill={color} stroke="none" />
      <path d={MOOD_MOUTH[level] ?? MOOD_MOUTH[3]} />
    </svg>
  );
}

export default function WellnessClient({ initialEntries, userId }: { initialEntries: WellnessEntry[]; userId: string }) {
  const [entries, setEntries] = useState(initialEntries);
  const [mood, setMood] = useState<number>(3);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any;

  const today = new Date().toISOString().slice(0, 10);
  const loggedToday = entries.some((e) => e.date === today);

  async function logToday(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await db
      .from("wellness_entries")
      .upsert({ user_id: userId, date: today, mood, notes: notes.trim() || null }, { onConflict: "user_id,date" })
      .select("id, date, mood, notes, created_at")
      .single();
    setSaving(false);
    if (!error && data) {
      setEntries((prev) => [data, ...prev.filter((en) => en.date !== today)]);
      setNotes("");
    }
  }

  return (
    <div style={{ padding: "4px 0 100px" }}>
      <div style={{ margin: "0 var(--ios-gutter) 18px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 999, background: "var(--ios-fill)", color: "var(--ios-label-2)",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="ios-caption" style={{ fontWeight: 600 }}>Private to you</span>
        </span>
      </div>

      {!loggedToday && (
        <form onSubmit={logToday} style={{
          background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)",
          padding: "18px 18px", margin: "0 var(--ios-gutter) 22px",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div>
            <div className="ios-footnote" style={{ fontWeight: 600, color: "var(--ios-label)", marginBottom: 12 }}>
              How are you feeling today?
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              {[1, 2, 3, 4, 5].map((m) => {
                const selected = mood === m;
                return (
                  <button key={m} type="button" onClick={() => setMood(m)}
                    aria-pressed={selected}
                    aria-label={MOOD_LABEL[m]}
                    style={{
                      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                      padding: "10px 4px", borderRadius: 12, cursor: "pointer",
                      border: `1.5px solid ${selected ? "var(--ios-tint)" : "var(--ios-separator)"}`,
                      background: selected ? "var(--ios-fill)" : "transparent",
                      color: selected ? "var(--ios-tint)" : "var(--ios-label-2)",
                    }}>
                    <MoodFace level={m} size={28} />
                    <span className="ios-caption">{MOOD_LABEL[m]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything on your mind? (optional)"
            style={{
              minHeight: 72, padding: "11px 13px", borderRadius: 10,
              border: "1px solid var(--ios-separator)", background: "var(--ios-bg)",
              color: "var(--ios-label)", fontSize: 16, fontFamily: "inherit", resize: "vertical", outline: "none",
            }}
          />
          <button type="submit" disabled={saving} className="ios-btn ios-btn--primary">
            {saving ? "Saving…" : "Log today"}
          </button>
        </form>
      )}

      <Group header="Recent entries">
        {entries.length === 0 ? (
          <div className="ios-cell">
            <span className="ios-cell-body">
              <span className="ios-cell-title" style={{ color: "var(--ios-label-2)" }}>No entries yet.</span>
            </span>
          </div>
        ) : (
          entries.map((e) => (
            <Cell
              key={e.id}
              lead={
                <span style={{ color: "var(--ios-tint)", display: "flex" }}>
                  <MoodFace level={e.mood ?? 3} size={28} />
                </span>
              }
              title={new Date(`${e.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              subtitle={e.notes ?? undefined}
            />
          ))
        )}
      </Group>
    </div>
  );
}
