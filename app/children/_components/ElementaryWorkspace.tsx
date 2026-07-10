"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";
import type { ChildWorkspaceData, ChildActivity, ChildHealthNote } from "../_lib/children";
import AddActivityForm from "./AddActivityForm";
import AddHealthNoteForm from "./AddHealthNoteForm";

const CATEGORY_META: Record<string, { color: string; icon: React.ReactNode }> = {
  school: { color: "var(--ios-tint)", icon: <Icons.BookIcon /> },
  sports: { color: "var(--ios-green)", icon: <Icons.DumbbellIcon /> },
  church: { color: "#B565A7", icon: <Icons.HeartIcon /> },
  other: { color: "var(--ios-orange)", icon: <Icons.SparkleIcon /> },
};

function catMeta(category: string) {
  return CATEGORY_META[category] ?? CATEGORY_META.other;
}

export default function ElementaryWorkspace({ data, viewerUserId }: { data: ChildWorkspaceData; viewerUserId: string }) {
  const [activities, setActivities] = useState<ChildActivity[]>(data.activities);
  const [healthNotes, setHealthNotes] = useState<ChildHealthNote[]>(data.healthNotes);
  const db = createClient() as any;

  async function complete(id: string) {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, completed: true } : a)));
    await db.schema("hub").from("child_activities").update({ completed: true }).eq("id", id);
  }

  async function resolveNote(id: string) {
    setHealthNotes((prev) => prev.map((h) => (h.id === id ? { ...h, resolved: true } : h)));
    await db.schema("hub").from("child_health_notes").update({ resolved: true }).eq("id", id);
  }

  const today = activities.filter((a) => !a.completed);
  const done = activities.filter((a) => a.completed);
  const openNotes = healthNotes.filter((h) => !h.resolved);

  return (
    <>
      <LargeTitle title={`Hi, ${data.name}!`} subtitle="Here's what's happening today." />

      <Group header="My routine" footer={today.length === 0 ? "Nothing on your list right now — great job!" : undefined}>
        {today.map((a) => {
          const meta = catMeta(a.category);
          return (
            <Cell
              key={a.id}
              onClick={() => complete(a.id)}
              chevron={false}
              lead={<IconBadge color={meta.color}>{meta.icon}</IconBadge>}
              title={a.title}
              trailing={
                <span
                  aria-hidden
                  style={{
                    width: 26, height: 26, borderRadius: "50%",
                    border: "2px solid var(--ios-separator)", flexShrink: 0,
                  }}
                />
              }
            />
          );
        })}
      </Group>

      <div style={{ margin: "12px var(--ios-gutter) 0" }}>
        <AddActivityForm
          childId={data.childId}
          viewerUserId={viewerUserId}
          onAdded={(a) => setActivities((prev) => [...prev, a])}
        />
      </div>

      {done.length > 0 && (
        <Group header="Achievements">
          {done.map((a) => (
            <Cell
              key={a.id}
              chevron={false}
              lead={<IconBadge color="var(--ios-green)"><Icons.ChecklistIcon /></IconBadge>}
              title={<span style={{ textDecoration: "line-through", color: "var(--ios-label-2)" }}>{a.title}</span>}
            />
          ))}
        </Group>
      )}

      <Group header="Health notes for next visit">
        {openNotes.length === 0 ? (
          <Cell chevron={false} title={<span style={{ color: "var(--ios-label-2)" }}>No notes for your next visit.</span>} />
        ) : (
          openNotes.map((h) => (
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
          ))
        )}
      </Group>

      <div style={{ margin: "12px var(--ios-gutter) 0" }}>
        <AddHealthNoteForm childId={data.childId} viewerUserId={viewerUserId} onAdded={(h) => setHealthNotes((prev) => [...prev, h])} />
      </div>
    </>
  );
}
