"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LargeTitle, Segmented, Group, Cell } from "@/components/ios";
import type { ChildWorkspaceData, ChildHealthNote } from "../_lib/children";
import AddHealthNoteForm from "./AddHealthNoteForm";

const TABS = ["Academics", "Money", "Wellness", "Career", "Important dates"] as const;
type Tab = (typeof TABS)[number];

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="ios-footnote" style={{ padding: "4px var(--ios-gutter)", color: "var(--ios-label-2)" }}>{children}</p>;
}

export default function CollegeWorkspace({ data, viewerUserId }: { data: ChildWorkspaceData; viewerUserId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("Academics");
  const [healthNotes, setHealthNotes] = useState<ChildHealthNote[]>(data.healthNotes);
  const academics = data.academicsSummary;
  const unresolvedNotes = healthNotes.filter((h) => !h.resolved);
  const db = createClient() as any;

  async function resolveNote(id: string) {
    setHealthNotes((prev) => prev.map((h) => (h.id === id ? { ...h, resolved: true } : h)));
    await db.schema("hub").from("child_health_notes").update({ resolved: true }).eq("id", id);
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
        {activeTab === "Academics" && (
          academics && (academics.courses.length > 0 || academics.upcomingAssignments.length > 0) ? (
            <>
              {academics.courses.length > 0 && (
                <Group header="Shared courses">
                  {academics.courses.map((c) => (
                    <Cell key={c.id} chevron={false} title={c.name} subtitle={c.instructor ?? undefined} />
                  ))}
                </Group>
              )}
              {academics.upcomingAssignments.length > 0 && (
                <Group header="Upcoming">
                  {academics.upcomingAssignments.map((a) => (
                    <Cell
                      key={a.id}
                      chevron={false}
                      title={a.title}
                      trailing={<span className="ios-num" style={{ fontSize: 13 }}>{new Date(`${a.dueDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                    />
                  ))}
                </Group>
              )}
            </>
          ) : (
            <EmptyNote>Nothing shared yet. Course tracking lives on their own Me dashboard — they can share a course from there.</EmptyNote>
          )
        )}

        {activeTab === "Money" && <EmptyNote>Nothing shared yet.</EmptyNote>}

        {activeTab === "Wellness" && (
          <>
            {unresolvedNotes.length === 0 ? (
              <EmptyNote>No notes for their next visit.</EmptyNote>
            ) : (
              <Group>
                {unresolvedNotes.map((h) => (
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

        {activeTab === "Career" && <EmptyNote>Nothing shared yet.</EmptyNote>}
        {activeTab === "Important dates" && <EmptyNote>No important dates yet.</EmptyNote>}
      </div>
    </>
  );
}
