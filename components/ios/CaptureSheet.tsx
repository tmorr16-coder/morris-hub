"use client";

// Quick Capture — the modernized, iOS-sheet replacement for QuickAddReminder.
// One surface captures a Reminder, a To-do, a Note, or a question to Ask Morris.
// Reminder/To-do write directly via the user's Supabase session (RLS scopes the
// insert to auth.uid()); Note and Ask Morris route to their pages with a draft.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Segmented } from "./Segmented";
import { Chip } from "./misc";

export type CaptureType = "reminder" | "todo" | "note" | "ask";
type Category = "bill" | "medication" | "workout" | "appointment" | "personal" | "general";
type Priority = "high" | "medium" | "low";

const CATEGORIES: Category[] = ["bill", "medication", "workout", "appointment", "personal", "general"];
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

function makeClient() {
  return createBrowserClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key"),
    COOKIE_DOMAIN ? { cookieOptions: { domain: COOKIE_DOMAIN, path: "/", sameSite: "lax" } } : undefined
  );
}
const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

export interface FamilyMember {
  id: string;
  label: string;
}

const PRIMARY_LABEL: Record<CaptureType, string> = {
  reminder: "Add reminder",
  todo: "Add to-do",
  note: "Save note",
  ask: "Ask Morris",
};

export function CaptureSheet({
  open,
  onClose,
  sourceApp = "hub",
  members = [],
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  sourceApp?: string;
  /** For the "Assign to" row (reminders/to-dos). */
  members?: FamilyMember[];
  currentUserId?: string;
}) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [type, setType] = useState<CaptureType>("reminder");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(iso(0));
  const [time, setTime] = useState("09:00");
  const [noTime, setNoTime] = useState(false);
  const [category, setCategory] = useState<Category>("general");
  const [priority, setPriority] = useState<Priority>("medium");
  const [assignee, setAssignee] = useState<string>("me");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
    else {
      setError(null);
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const uid = currentUserId ?? user?.id;
  const assignedTo = assignee === "me" ? null : assignee;

  async function save() {
    if (!title.trim()) return setError("Add a title first");
    if (type === "note") {
      router.push(`/home/journal?draft=${encodeURIComponent(title.trim())}`);
      return onClose();
    }
    if (type === "ask") {
      router.push(`/home/ask?q=${encodeURIComponent(title.trim())}`);
      return onClose();
    }
    if (!uid) return setError("Not signed in");

    setSaving(true);
    setError(null);
    try {
      const supabase = makeClient();
      if (type === "reminder") {
        const dueAt = new Date(`${date}T${noTime ? "09:00" : time}:00`).toISOString();
        const { error: e } = await supabase.schema("hub").from("reminders").insert({
          user_id: uid,
          title: title.trim(),
          due_at: dueAt,
          category,
          source_app: sourceApp,
          ...(assignedTo ? { assigned_to: assignedTo } : {}),
        });
        if (e) throw e;
      } else {
        const { error: e } = await supabase.schema("hub").from("todos").insert({
          user_id: uid,
          title: title.trim(),
          completed: false,
          priority,
          due_date: noTime && type === "todo" ? null : date,
          ...(assignedTo ? { assigned_to: assignedTo } : {}),
        });
        if (e) throw e;
      }
      setTitle("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  }

  const showSchedule = type === "reminder" || type === "todo";
  const assignRow: FamilyMember[] = [{ id: "me", label: "You" }, ...members];

  return (
    <>
      <div className="ios-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Quick capture">
        <div className="ios-grabber" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <button className="ios-btn--plain" onClick={onClose}>Cancel</button>
          <span className="ios-headline">New</span>
          <span style={{ width: 52 }} />
        </div>

        <textarea
          ref={inputRef}
          className="ios-field"
          rows={1}
          placeholder="What do you need to remember?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || !e.shiftKey)) {
              e.preventDefault();
              save();
            }
          }}
        />

        <Segmented
          ariaLabel="Capture type"
          value={type}
          onChange={(v: CaptureType) => setType(v)}
          options={[
            { value: "reminder", label: "Reminder" },
            { value: "todo", label: "To-do" },
            { value: "note", label: "Note" },
            { value: "ask", label: "Ask Morris" },
          ]}
          style={{ margin: "6px 0 0" }}
        />

        {showSchedule && (
          <>
            <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>When</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Chip small selected={date === iso(0) && !noTime} onClick={() => { setDate(iso(0)); setNoTime(false); }}>Today</Chip>
              <Chip small selected={date === iso(1) && !noTime} onClick={() => { setDate(iso(1)); setNoTime(false); }}>Tomorrow</Chip>
              <Chip small selected={date === iso(7) && !noTime} onClick={() => { setDate(iso(7)); setNoTime(false); }}>Next week</Chip>
              <input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setNoTime(false); }}
                className="ios-chip ios-chip--sm"
                style={{ colorScheme: "light dark" }}
                aria-label="Pick a date"
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {type === "reminder" && (
                <input type="time" value={time} onChange={(e) => { setTime(e.target.value); setNoTime(false); }} className="ios-chip ios-chip--sm" aria-label="Time" />
              )}
              <Chip small selected={noTime} onClick={() => setNoTime((v) => !v)}>No time</Chip>
            </div>
          </>
        )}

        {type === "reminder" && (
          <>
            <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Category</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CATEGORIES.map((c) => (
                <Chip key={c} small selected={category === c} onClick={() => setCategory(c)}>
                  {c[0].toUpperCase() + c.slice(1)}
                </Chip>
              ))}
            </div>
          </>
        )}

        {type === "todo" && (
          <>
            <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Priority</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["high", "medium", "low"] as Priority[]).map((p) => (
                <Chip key={p} small selected={priority === p} onClick={() => setPriority(p)}>
                  {p[0].toUpperCase() + p.slice(1)}
                </Chip>
              ))}
            </div>
          </>
        )}

        {showSchedule && members.length > 0 && (
          <>
            <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Assign to</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {assignRow.map((m) => (
                <Chip key={m.id} small selected={assignee === m.id} onClick={() => setAssignee(m.id)}>
                  {m.label}
                </Chip>
              ))}
            </div>
          </>
        )}

        {type === "ask" && (
          <p className="ios-footnote" style={{ padding: "16px 0 0", color: "var(--ios-label-2)" }}>
            Sends your question to Ask Morris.
          </p>
        )}
        {type === "note" && (
          <p className="ios-footnote" style={{ padding: "16px 0 0", color: "var(--ios-label-2)" }}>
            Opens your journal with this text as a draft.
          </p>
        )}

        {error && (
          <p className="ios-footnote" style={{ padding: "12px 0 0", color: "var(--ios-red)" }}>{error}</p>
        )}

        <button
          className="ios-btn ios-btn--primary"
          style={{ marginTop: 22, opacity: title.trim() && !saving ? 1 : 0.5 }}
          disabled={!title.trim() || saving}
          onClick={save}
        >
          {saving ? "Saving…" : PRIMARY_LABEL[type]}
        </button>
      </div>
    </>
  );
}
