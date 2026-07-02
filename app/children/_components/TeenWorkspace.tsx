"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChildWorkspaceData, ChildActivity, ChildHealthNote } from "../_lib/children";

const TABS = ["Today", "Assignments", "Activities", "Responsibilities", "Goals", "Wellness"] as const;
type Tab = (typeof TABS)[number];

export default function TeenWorkspace({ data }: { data: ChildWorkspaceData }) {
  const [activeTab, setActiveTab] = useState<Tab>("Today");
  const [activities, setActivities] = useState<ChildActivity[]>(data.activities);
  const [healthNotes] = useState<ChildHealthNote[]>(data.healthNotes);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any;

  async function toggle(id: string, completed: boolean) {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, completed: !completed } : a)));
    await db.schema("hub").from("child_activities").update({ completed: !completed }).eq("id", id);
  }

  const assignments = activities.filter((a) => a.category === "school");
  const otherActivities = activities.filter((a) => a.category !== "school");
  const dueToday = activities.filter((a) => !a.completed && a.dueAt && a.dueAt.slice(0, 10) === new Date().toISOString().slice(0, 10));

  function renderList(items: ChildActivity[]) {
    if (items.length === 0) {
      return <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>Nothing here yet.</div>;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((a) => (
          <div key={a.id} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 8,
            opacity: a.completed ? 0.55 : 1,
          }}>
            <button onClick={() => toggle(a.id, a.completed)} aria-label={a.completed ? "Mark incomplete" : "Mark complete"} style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: "pointer",
              border: `2px solid ${a.completed ? "var(--color-accent)" : "var(--color-rule)"}`,
              background: a.completed ? "var(--color-accent)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {a.completed && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
            </button>
            <span style={{ flex: 1, fontSize: 13, color: "var(--color-ink-2)", textDecoration: a.completed ? "line-through" : "none" }}>{a.title}</span>
            {a.dueAt && <span style={{ fontSize: 11, color: "var(--color-ink-4)" }}>{new Date(a.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 100px" }}>
      <h1 className="serif" style={{ fontSize: 32, marginBottom: 8 }}>{data.name}</h1>

      <div style={{
        background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 10, padding: 4,
        display: "flex", gap: 2, marginBottom: 24, flexWrap: "wrap",
      }}>
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "7px 12px", borderRadius: 7, border: "none", fontSize: 12, cursor: "pointer",
            background: activeTab === tab ? "var(--color-accent)" : "transparent",
            color: activeTab === tab ? "#FFFDF8" : "var(--color-ink-2)",
            fontWeight: activeTab === tab ? 600 : 400,
          }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Today" && renderList(dueToday)}
      {activeTab === "Assignments" && renderList(assignments)}
      {activeTab === "Activities" && renderList(otherActivities)}
      {activeTab === "Responsibilities" && <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>Household responsibilities appear on the Family calendar.</div>}
      {activeTab === "Goals" && <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>No goals set yet.</div>}
      {activeTab === "Wellness" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {healthNotes.filter((h) => !h.resolved).length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>No notes for your next visit.</div>
          ) : healthNotes.filter((h) => !h.resolved).map((h) => (
            <div key={h.id} style={{ fontSize: 13, color: "var(--color-ink-2)", padding: "10px 14px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 8 }}>
              {h.note}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
