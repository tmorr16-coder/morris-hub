"use client";

import { useState } from "react";
import type { ChildWorkspaceData } from "../_lib/children";

const TABS = ["Academics", "Money", "Wellness", "Career", "Important dates"] as const;
type Tab = (typeof TABS)[number];

export default function CollegeWorkspace({ data }: { data: ChildWorkspaceData }) {
  const [activeTab, setActiveTab] = useState<Tab>("Academics");
  const academics = data.academicsSummary;
  const unresolvedNotes = data.healthNotes.filter((h) => !h.resolved);

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

      {activeTab === "Academics" && (
        academics && (academics.courses.length > 0 || academics.upcomingAssignments.length > 0) ? (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 10 }}>Shared courses</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
              {academics.courses.map((c) => (
                <div key={c.id} style={{ fontSize: 13, color: "var(--color-ink-2)", padding: "10px 14px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 8 }}>
                  {c.name}{c.instructor ? ` · ${c.instructor}` : ""}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 10 }}>Upcoming</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {academics.upcomingAssignments.map((a) => (
                <div key={a.id} style={{ fontSize: 13, color: "var(--color-ink-2)", padding: "10px 14px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 8 }}>
                  {a.title} · due {new Date(`${a.dueDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>
            Nothing shared yet. Course tracking lives on their own Me dashboard — they can share a course from there.
          </div>
        )
      )}

      {activeTab === "Money" && <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>Nothing shared yet.</div>}

      {activeTab === "Wellness" && (
        unresolvedNotes.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>No notes for their next visit.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {unresolvedNotes.map((h) => (
              <div key={h.id} style={{ fontSize: 13, color: "var(--color-ink-2)", padding: "10px 14px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 8 }}>
                {h.note}
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === "Career" && <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>Nothing shared yet.</div>}
      {activeTab === "Important dates" && <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>No important dates yet.</div>}
    </main>
  );
}
