"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChildWorkspaceData, ChildActivity } from "../_lib/children";

const CATEGORY_EMOJI: Record<string, string> = { school: "📚", sports: "⚽", church: "🕊️", other: "⭐" };

export default function ElementaryWorkspace({ data }: { data: ChildWorkspaceData }) {
  const [activities, setActivities] = useState<ChildActivity[]>(data.activities);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any;

  async function complete(id: string) {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, completed: true } : a)));
    await db.schema("hub").from("child_activities").update({ completed: true }).eq("id", id);
  }

  const today = activities.filter((a) => !a.completed);
  const done = activities.filter((a) => a.completed);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px 100px" }}>
      <h1 className="serif" style={{ fontSize: 34, marginBottom: 4 }}>Hi, {data.name}! 👋</h1>
      <p style={{ fontSize: 15, color: "var(--color-ink-3)", marginBottom: 28 }}>Here&apos;s what&apos;s happening today.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-ink)", marginBottom: 14 }}>My Routine</h2>
      {today.length === 0 ? (
        <div style={{ fontSize: 15, color: "var(--color-ink-4)", marginBottom: 28 }}>Nothing on your list right now — great job!</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
          {today.map((a) => (
            <button key={a.id} onClick={() => complete(a.id)} style={{
              display: "flex", alignItems: "center", gap: 16, padding: "18px 22px", textAlign: "left",
              background: "var(--color-bg-card)", border: "2px solid var(--color-rule)", borderRadius: 18,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              <span style={{ fontSize: 28 }}>{CATEGORY_EMOJI[a.category]}</span>
              <span style={{ flex: 1, fontSize: 18, fontWeight: 600, color: "var(--color-ink)" }}>{a.title}</span>
              <span style={{
                width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--color-rule)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>✓</span>
            </button>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-ink)", marginBottom: 14 }}>Achievements 🌟</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {done.map((a) => (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                background: "rgba(77,107,58,0.08)", borderRadius: 16,
              }}>
                <span style={{ fontSize: 22 }}>🏆</span>
                <span style={{ fontSize: 15, color: "var(--color-ink-2)", textDecoration: "line-through" }}>{a.title}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
