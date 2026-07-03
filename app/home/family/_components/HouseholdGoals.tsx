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
  assigned_to?: string | null;
}

const memberSelectStyle: React.CSSProperties = {
  padding: "10px 12px", border: "var(--ios-hair) solid var(--ios-separator)",
  borderRadius: 10, background: "var(--ios-cell)", color: "var(--ios-label)", fontSize: 15,
};

export default function HouseholdGoals({
  initialGoals, userId, nameMap, members,
}: {
  initialGoals: Goal[];
  userId: string;
  nameMap: Record<string, string>;
  members: { id: string; name: string }[];
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [title, setTitle] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any;

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const fields = { title: title.trim(), circle_owner_id: userId, created_by: userId };
    let res = await db.schema("hub").from("household_goals")
      .insert({ ...fields, assigned_to: assignTo || null }).select("*").single();
    if (res.error && /assigned_to/.test(res.error.message)) {
      res = await db.schema("hub").from("household_goals")
        .insert({ ...fields }).select("*").single();
    }
    setSaving(false);
    if (!res.error && res.data) {
      setGoals((prev) => [res.data, ...prev]);
      setTitle("");
      setAssignTo("");
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
    <section className="ios-group">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--ios-gutter) 7px" }}>
        <h2 className="ios-group-header" style={{ padding: 0 }}>Household goals</h2>
        <button onClick={() => setFormOpen((o) => !o)} className="ios-subhead" style={{ color: "var(--ios-tint)", fontWeight: 500 }}>
          {formOpen ? "Cancel" : "Add goal"}
        </button>
      </div>
      {formOpen && (
        <form onSubmit={addGoal} style={{ display: "flex", gap: 8, margin: "0 var(--ios-gutter) 10px", flexWrap: "wrap" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Save $5,000 for the trip"
            style={{ flex: 1, minWidth: 140, padding: "10px 14px", border: "var(--ios-hair) solid var(--ios-separator)", borderRadius: 10, background: "var(--ios-cell)", color: "var(--ios-label)", fontSize: 16 }}
          />
          <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} aria-label="Assign to" style={memberSelectStyle}>
            <option value="">Everyone</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button type="submit" disabled={saving || !title.trim()} className="ios-btn ios-btn--primary" style={{ width: "auto", minHeight: 0, padding: "10px 18px", fontSize: 15, opacity: saving || !title.trim() ? 0.5 : 1 }}>
            Save
          </button>
        </form>
      )}
      {goals.length === 0 ? (
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "0 var(--ios-gutter)" }}>No household goals yet.</p>
      ) : (
        <div className="ios-list">
          {[...active, ...completed].map((g) => {
            const done = g.status === "completed";
            return (
              <div key={g.id} className="ios-cell">
                <span className="ios-cell-lead">
                  <button onClick={() => toggleComplete(g.id, g.status)} aria-label="Toggle complete"
                    style={{
                      width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${done ? "var(--ios-green)" : "var(--ios-label-3)"}`,
                      background: done ? "var(--ios-green)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                    {done && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>}
                  </button>
                </span>
                <span className="ios-cell-body">
                  <span className="ios-cell-title ios-subhead" style={{ textDecoration: done ? "line-through" : "none", color: done ? "var(--ios-label-2)" : "var(--ios-label)" }}>
                    {g.title}
                  </span>
                  <span className="ios-cell-sub">
                    Started by {nameMap[g.created_by] ?? "Family"}{g.target_date ? ` · target ${new Date(`${g.target_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                  </span>
                  {g.assigned_to && (
                    <span className="ios-chip ios-chip--sm ios-caption" style={{ marginTop: 4, alignSelf: "flex-start", color: "var(--ios-tint)" }}>
                      for {nameMap[g.assigned_to] ?? "Member"}
                    </span>
                  )}
                </span>
                <button onClick={() => remove(g.id)} aria-label="Remove" className="ios-cell-trail" style={{ color: "var(--ios-label-3)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
