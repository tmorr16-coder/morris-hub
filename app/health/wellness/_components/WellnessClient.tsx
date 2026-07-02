"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface WellnessEntry {
  id: string;
  date: string;
  mood: number | null;
  notes: string | null;
  created_at: string;
}

const MOOD_EMOJI: Record<number, string> = { 1: "😞", 2: "🙁", 3: "😐", 4: "🙂", 5: "😄" };

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
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px 100px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <h1 className="serif" style={{ fontSize: 28, margin: 0 }}>Mental Wellness</h1>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
          padding: "2px 8px", borderRadius: 8, background: "rgba(59,92,127,0.1)", color: "var(--color-accent)",
        }}>
          🔒 Private to you
        </span>
      </div>
      <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 24 }}>
        A quick daily mood check-in. Never shared with your family circle.
      </p>

      {!loggedToday && (
        <form onSubmit={logToday} style={{
          background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12,
          padding: "18px 20px", marginBottom: 24, display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-3)", display: "block", marginBottom: 8 }}>
              How are you feeling today?
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((m) => (
                <button key={m} type="button" onClick={() => setMood(m)}
                  style={{
                    fontSize: 24, padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                    border: `2px solid ${mood === m ? "var(--color-accent)" : "var(--color-rule)"}`,
                    background: mood === m ? "var(--color-accent-soft)" : "transparent",
                  }}>
                  {MOOD_EMOJI[m]}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything on your mind? (optional)"
            style={{ minHeight: 70, padding: "10px 12px", border: "1px solid var(--color-rule)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
          />
          <button type="submit" disabled={saving}
            style={{ alignSelf: "flex-start", padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {saving ? "Saving…" : "Log today"}
          </button>
        </form>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 12 }}>
        Recent entries
      </div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>No entries yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.map((e) => (
            <div key={e.id} style={{
              display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px",
              background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 10,
            }}>
              <span style={{ fontSize: 22 }}>{e.mood ? MOOD_EMOJI[e.mood] : "—"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink)" }}>
                  {new Date(`${e.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </div>
                {e.notes && <div style={{ fontSize: 13, color: "var(--color-ink-3)", marginTop: 2 }}>{e.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
