"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LargeTitle, Segmented, Group, Cell } from "@/components/ios";
import type { ChildWorkspaceData, ChildActivity, ChildHealthNote } from "../_lib/children";
import AddActivityForm from "./AddActivityForm";
import AddHealthNoteForm from "./AddHealthNoteForm";

const TABS = ["Today", "Assignments", "Activities", "Responsibilities", "Goals", "Wellness"] as const;
type Tab = (typeof TABS)[number];

function Checkbox({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        border: `2px solid ${checked ? "var(--ios-tint)" : "var(--ios-separator)"}`,
        background: checked ? "var(--ios-tint)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
      }}
    >
      {checked && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </button>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="ios-footnote" style={{ padding: "4px var(--ios-gutter)", color: "var(--ios-label-2)" }}>{children}</p>;
}

export default function TeenWorkspace({ data, viewerUserId }: { data: ChildWorkspaceData; viewerUserId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("Today");
  const [activities, setActivities] = useState<ChildActivity[]>(data.activities);
  const [healthNotes, setHealthNotes] = useState<ChildHealthNote[]>(data.healthNotes);
  const db = createClient() as any;

  async function toggle(id: string, completed: boolean) {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, completed: !completed } : a)));
    await db.schema("hub").from("child_activities").update({ completed: !completed }).eq("id", id);
  }

  async function resolveNote(id: string) {
    setHealthNotes((prev) => prev.map((h) => (h.id === id ? { ...h, resolved: true } : h)));
    await db.schema("hub").from("child_health_notes").update({ resolved: true }).eq("id", id);
  }

  const assignments = activities.filter((a) => a.category === "school");
  const otherActivities = activities.filter((a) => a.category !== "school");
  const dueToday = activities.filter((a) => !a.completed && a.dueAt && a.dueAt.slice(0, 10) === new Date().toISOString().slice(0, 10));

  function renderList(items: ChildActivity[]) {
    if (items.length === 0) {
      return <EmptyNote>Nothing here yet.</EmptyNote>;
    }
    return (
      <Group>
        {items.map((a) => (
          <Cell
            key={a.id}
            chevron={false}
            lead={<Checkbox checked={a.completed} onClick={() => toggle(a.id, a.completed)} label={a.completed ? "Mark incomplete" : "Mark complete"} />}
            title={<span style={{ textDecoration: a.completed ? "line-through" : "none", opacity: a.completed ? 0.55 : 1 }}>{a.title}</span>}
            trailing={a.dueAt ? <span className="ios-num" style={{ fontSize: 13 }}>{new Date(a.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span> : undefined}
          />
        ))}
      </Group>
    );
  }

  return (
    <>
      <LargeTitle title={data.name} />

      <div style={{ padding: "0 var(--ios-gutter)" }}>
        <Segmented
          ariaLabel="Section"
          value={activeTab}
          onChange={(v: Tab) => setActiveTab(v)}
          options={TABS.map((t) => ({ value: t, label: t }))}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        {activeTab === "Today" && renderList(dueToday)}
        {activeTab === "Assignments" && (
          <>
            {renderList(assignments)}
            <div style={{ margin: "12px var(--ios-gutter) 0" }}>
              <AddActivityForm childId={data.childId} viewerUserId={viewerUserId} defaultCategory="school" onAdded={(a) => setActivities((prev) => [...prev, a])} />
            </div>
          </>
        )}
        {activeTab === "Activities" && (
          <>
            {renderList(otherActivities)}
            <div style={{ margin: "12px var(--ios-gutter) 0" }}>
              <AddActivityForm childId={data.childId} viewerUserId={viewerUserId} defaultCategory="sports" onAdded={(a) => setActivities((prev) => [...prev, a])} />
            </div>
          </>
        )}
        {activeTab === "Responsibilities" && <EmptyNote>Household responsibilities appear on the Family calendar.</EmptyNote>}
        {activeTab === "Goals" && <EmptyNote>No goals set yet.</EmptyNote>}
        {activeTab === "Wellness" && (
          <>
            {healthNotes.filter((h) => !h.resolved).length === 0 ? (
              <EmptyNote>No notes for your next visit.</EmptyNote>
            ) : (
              <Group>
                {healthNotes.filter((h) => !h.resolved).map((h) => (
                  <Cell
                    key={h.id}
                    chevron={false}
                    title={h.note}
                    subtitle={h.targetVisitDate ? new Date(`${h.targetVisitDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : undefined}
                    trailing={
                      <button type="button" className="ios-btn--plain" onClick={() => resolveNote(h.id)} style={{ fontSize: 15 }}>
                        Resolve
                      </button>
                    }
                  />
                ))}
              </Group>
            )}
            <div style={{ margin: "12px var(--ios-gutter) 0" }}>
              <AddHealthNoteForm childId={data.childId} viewerUserId={viewerUserId} onAdded={(h) => setHealthNotes((prev) => [...prev, h])} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
