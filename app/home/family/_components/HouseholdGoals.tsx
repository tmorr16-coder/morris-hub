"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: "active" | "completed";
  created_by: string;
  created_at: string;
}

export default function HouseholdGoals({
  initialGoals, userId, nameMap,
}: {
  initialGoals: Goal[];
  userId: string;
  nameMap: Record<string, string>;
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [title, setTitle] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any;

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const { data, error } = await db.schema("hub").from("household_goals")
      .insert({ title: title.trim(), circle_owner_id: userId, created_by: userId })
      .select("id, title, description, target_date, status, created_by, created_at")
      .single();
    setSaving(false);
    if (!error && data) {
      setGoals((prev) => [data, ...prev]);
      setTitle("");
      setFormOpen(false);
    }
  }

  async function toggleComplete(id: string, status: "active" | "completed") {
    const next = status === "active" ? "completed" : "active";
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, status: next } : g)));
    await db.schema("hub").from("household_goals")
      .update({ status: next, completed_at: next === "completed" ? new Date().toISOString() : null })
      .eq("id", id);
  }

  async function remove(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    await db.schema("hub").from("household_goals").delete().eq("id", id);
  }

  const active = goals.filter((g) => g.status === "active");
  const completed = goals.filter((g) => g.status === "completed");

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", margin: 0, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          🎯 Household goals
        </h2>
        <button onClick={() => setFormOpen((o) => !o)}
          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", cursor: "pointer" }}>
          {formOpen ? "Cancel" : "+ Add goal"}
        </button>
      </div>
      {formOpen && (
        <form onSubmit={addGoal} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Save $5,000 for the trip"
            style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--color-rule)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}
          />
          <button type="submit" disabled={saving || !title.trim()}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Save
          </button>
        </form>
      )}
      {goals.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>No household goals yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...active, ...completed].map((g) => (
            <div key={g.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
              background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 8,
              opacity: g.status === "completed" ? 0.55 : 1,
            }}>
              <button onClick={() => toggleComplete(g.id, g.status)} aria-label="Toggle complete"
                style={{
                  width: 18, height: 18, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                  border: `2px solid ${g.status === "completed" ? "var(--color-accent)" : "var(--color-rule)"}`,
                  background: g.status === "completed" ? "var(--color-accent)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                {g.status === "completed" && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, color: "var(--color-ink-2)", fontFamily: "var(--font-geist, system-ui), sans-serif",
                  textDecoration: g.status === "completed" ? "line-through" : "none",
                }}>
                  {g.title}
                </div>
                <div style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
                  Started by {nameMap[g.created_by] ?? "Family"}{g.target_date ? ` · target ${new Date(`${g.target_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                </div>
              </div>
              <button onClick={() => remove(g.id)} aria-label="Remove"
                style={{ background: "none", border: "none", color: "var(--color-ink-4)", cursor: "pointer", fontSize: 13, flexShrink: 0 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
