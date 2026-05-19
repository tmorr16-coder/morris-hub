"use client";

import { useState, useTransition } from "react";
import type { Reminder, Recurrence, Category } from "@/lib/reminders";
import { addReminder, completeReminder, snoozeReminder, deleteReminder } from "../actions";

const CATEGORY_ICON: Record<Category, string> = {
  bill: "💸",
  medication: "💊",
  workout: "🏋️",
  appointment: "📅",
  personal: "✦",
  general: "•",
};

const CATEGORY_COLOR: Record<Category, string> = {
  bill: "#8B6A47",
  medication: "#7B5BA2",
  workout: "#4D6B3A",
  appointment: "#3B5C7F",
  personal: "#B88A2E",
  general: "#6B6258",
};

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  once: "once",
  daily: "daily",
  weekly: "weekly",
  biweekly: "every 2wk",
  monthly: "monthly",
  quarterly: "quarterly",
  yearly: "yearly",
};

function formatDue(iso: string, tz: string): { text: string; color: string } {
  const due = new Date(iso);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin < 0) {
    const absMin = Math.abs(diffMin);
    if (absMin < 60) return { text: `${absMin}m overdue`, color: "#9A3B2A" };
    const hrs = Math.round(absMin / 60);
    if (hrs < 24) return { text: `${hrs}h overdue`, color: "#9A3B2A" };
    return { text: `${Math.round(hrs / 24)}d overdue`, color: "#9A3B2A" };
  }
  if (diffMin < 60) return { text: `in ${diffMin}m`, color: "#B88A2E" };
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) {
    return {
      text: due.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }),
      color: "#6B6258",
    };
  }
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) {
    return {
      text: `tom ${due.toLocaleTimeString("en-US", { hour: "numeric", timeZone: tz })}`,
      color: "#8A8278",
    };
  }
  if (diffDay < 7) {
    return {
      text:
        due.toLocaleDateString("en-US", { weekday: "short", timeZone: tz }) +
        " " +
        due.toLocaleTimeString("en-US", { hour: "numeric", timeZone: tz }),
      color: "#8A8278",
    };
  }
  return {
    text: due.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz }),
    color: "#8A8278",
  };
}

function toLocalDatetimeInput(d: Date, tz: string): string {
  // YYYY-MM-DDTHH:MM in the user's timezone for <input type=datetime-local>
  const parts = d.toLocaleString("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // en-US "MM/DD/YYYY, HH:MM" → reformat
  const m = parts.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+)/);
  if (!m) return "";
  return `${m[3]}-${m[1]}-${m[2]}T${m[4]}:${m[5]}`;
}

function fromLocalDatetimeInput(value: string, tz: string): string {
  // Interpret "YYYY-MM-DDTHH:MM" as in the user's tz, return ISO UTC string
  // Approach: compute the offset for that timezone at that time, then build a Date
  const [datePart, timePart] = value.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  // Quick approach: use a fake date and let toLocaleString roundtrip approximate
  // Build a Date assuming UTC, then correct for the tz offset
  const utc = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const tzOffsetStr = utc.toLocaleString("en-US", { timeZone: tz, timeZoneName: "longOffset" });
  const offMatch = tzOffsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!offMatch) return utc.toISOString();
  const sign = offMatch[1] === "-" ? -1 : 1;
  const offMin = parseInt(offMatch[2]) * 60 + parseInt(offMatch[3] ?? "0");
  // tzOffsetStr says "GMT-5" meaning tz = UTC-5, so local 8am = UTC 1pm → add 5h to local time to get UTC
  return new Date(utc.getTime() - sign * offMin * 60_000).toISOString();
}

export default function RemindersWidget({
  initialReminders,
  tz,
  categories,
}: {
  initialReminders: Reminder[];
  tz: string;
  categories?: string[];
}) {
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  const [showAdd, setShowAdd] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleComplete(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      await completeReminder(id);
    });
  }

  function handleSnooze(id: string, hours: number) {
    const until = new Date(Date.now() + hours * 3_600_000).toISOString();
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, due_at: until } : r)).sort((a, b) => (a.due_at < b.due_at ? -1 : 1))
    );
    startTransition(async () => {
      await snoozeReminder(id, until);
    });
  }

  function handleDelete(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      await deleteReminder(id);
    });
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 className="serif" style={{ fontSize: 20 }}>Reminders</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          style={{
            padding: "3px 10px",
            borderRadius: 14,
            border: "1px solid var(--color-rule)",
            background: showAdd ? "var(--color-accent)" : "transparent",
            color: showAdd ? "#FFFDF8" : "var(--color-ink-2)",
            fontSize: 11,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {showAdd ? "Cancel" : "+ Add"}
        </button>
      </div>

      {showAdd && (
        <AddReminderForm
          tz={tz}
          categories={categories}
          onAdded={(r) => {
            setReminders((prev) =>
              [...prev, r].sort((a, b) => (a.due_at < b.due_at ? -1 : 1))
            );
            setShowAdd(false);
          }}
        />
      )}

      {reminders.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--color-ink-4)", padding: "20px 0", textAlign: "center" }}>
          Nothing upcoming.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", maxHeight: 280, overflowY: "auto" }}>
          {reminders.map((r, idx) => {
            const due = formatDue(r.due_at, tz);
            return (
              <div
                key={r.id}
                style={{
                  padding: "9px 0",
                  borderTop: idx === 0 ? undefined : "1px solid var(--color-rule-soft)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 14, color: CATEGORY_COLOR[r.category], flexShrink: 0, width: 18, textAlign: "center" }}>
                  {CATEGORY_ICON[r.category]}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--color-ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.title}
                  </div>
                  <div style={{ fontSize: 10, color: due.color, marginTop: 1 }}>
                    {due.text}
                    {r.recurrence !== "once" && (
                      <span style={{ color: "var(--color-ink-4)" }}> · {RECURRENCE_LABEL[r.recurrence]}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => handleComplete(r.id)}
                    disabled={pending}
                    title="Done"
                    style={iconBtn}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => handleSnooze(r.id, 24)}
                    disabled={pending}
                    title="Snooze 1 day"
                    style={iconBtn}
                  >
                    ⏰
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={pending}
                    title="Delete"
                    style={{ ...iconBtn, color: "var(--color-ink-4)" }}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const DEFAULT_CATS = ["bill","medication","workout","appointment","personal","general"];

function AddReminderForm({
  tz,
  categories,
  onAdded,
}: {
  tz: string;
  categories?: string[];
  onAdded: (r: Reminder) => void;
}) {
  const [title, setTitle] = useState("");
  const defaultWhen = new Date(Date.now() + 86_400_000); // tomorrow same time
  const [when, setWhen] = useState(toLocalDatetimeInput(defaultWhen, tz));
  const [recurrence, setRecurrence] = useState<Recurrence>("once");
  const [category, setCategory] = useState<Category>("general");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !when) return;
    setError(null);
    const dueIso = fromLocalDatetimeInput(when, tz);
    const tempId = `temp-${Date.now()}`;
    startTransition(async () => {
      const res = await addReminder({
        title,
        due_at: dueIso,
        recurrence,
        category,
        source_app: "hub",
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onAdded({
        id: tempId,
        user_id: "",
        title,
        notes: null,
        due_at: dueIso,
        recurrence,
        category,
        source_app: "hub",
        completed_at: null,
        snooze_until: null,
      });
      setTitle("");
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "var(--color-bg)",
        border: "1px solid var(--color-rule)",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Reminder title…"
        autoFocus
        style={miniInput}
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          style={{ ...miniInput, width: 180 }}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)} style={miniInput}>
          {(categories ?? DEFAULT_CATS).map((c) => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)} style={miniInput}>
          <option value="once">Once</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Every 2 weeks</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>
      {error && <span style={{ fontSize: 11, color: "var(--color-red)" }}>{error}</span>}
      <button
        type="submit"
        disabled={pending || !title.trim()}
        style={{
          padding: "6px 12px",
          borderRadius: 6,
          border: "1px solid var(--color-accent-dark)",
          background: "var(--color-accent)",
          color: "#FFFDF8",
          fontSize: 12,
          fontWeight: 500,
          fontFamily: "inherit",
          cursor: pending || !title.trim() ? "not-allowed" : "pointer",
          alignSelf: "flex-start",
        }}
      >
        {pending ? "Adding…" : "Add reminder"}
      </button>
    </form>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: 12,
  padding: "18px 20px",
  boxShadow: "var(--shadow-card)",
  minHeight: 200,
};

const miniInput: React.CSSProperties = {
  padding: "6px 9px",
  border: "1px solid var(--color-rule)",
  borderRadius: 6,
  background: "var(--color-bg-card)",
  color: "var(--color-ink)",
  fontSize: 12,
  fontFamily: "inherit",
  outline: "none",
};

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--color-ink-3)",
  fontSize: 12,
  cursor: "pointer",
  padding: "2px 5px",
  borderRadius: 4,
};
