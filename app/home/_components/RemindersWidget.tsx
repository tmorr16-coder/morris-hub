"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import type { Reminder, Recurrence, Category } from "@/lib/reminders";
import { IconBadge, Icons } from "@/components/ios";
import { addReminder, completeReminder, completeCourseReminder, snoozeReminder, deleteReminder, updateReminder } from "../actions";

const CATEGORY_COLOR: Record<Category, string> = {
  bill: "#8B6A47",
  medication: "#7B5BA2",
  workout: "#4D6B3A",
  appointment: "#3B5C7F",
  personal: "#B88A2E",
  general: "#6B6258",
};

function categoryIcon(category: Category): ReactNode {
  switch (category) {
    case "bill": return <Icons.WalletIcon />;
    case "medication": return <Icons.PillIcon />;
    case "workout": return <Icons.DumbbellIcon />;
    case "appointment": return <Icons.CalendarIcon />;
    case "personal": return <Icons.SparkleIcon />;
    default: return <Icons.BellIcon />;
  }
}

function QuestionGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" aria-hidden>
      <path d="M9.2 9a2.8 2.8 0 1 1 4 2.5c-.8.5-1.2 1-1.2 2M12 17.5h.01" />
    </svg>
  );
}
function RepeatGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" aria-hidden>
      <path d="M4 9a5 5 0 0 1 5-5h7l-2.5-2.5M20 15a5 5 0 0 1-5 5H8l2.5 2.5" />
    </svg>
  );
}

function courseIcon(type: string | null | undefined): ReactNode {
  switch (type) {
    case "test": return <Icons.ComposeIcon />;
    case "assignment": return <Icons.ChecklistIcon />;
    case "quiz": return <QuestionGlyph />;
    case "practice": return <RepeatGlyph />;
    case "extra_credit": return <Icons.SparkleIcon />;
    default: return <Icons.BookIcon />;
  }
}

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
    if (absMin < 60) return { text: `${absMin}m overdue`, color: "var(--ios-red)" };
    const hrs = Math.round(absMin / 60);
    if (hrs < 24) return { text: `${hrs}h overdue`, color: "var(--ios-red)" };
    return { text: `${Math.round(hrs / 24)}d overdue`, color: "var(--ios-red)" };
  }
  if (diffMin < 60) return { text: `in ${diffMin}m`, color: "var(--ios-orange)" };
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) {
    return {
      text: due.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }),
      color: "var(--ios-label-2)",
    };
  }
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) {
    return {
      text: `tom ${due.toLocaleTimeString("en-US", { hour: "numeric", timeZone: tz })}`,
      color: "var(--ios-label-3)",
    };
  }
  if (diffDay < 7) {
    return {
      text:
        due.toLocaleDateString("en-US", { weekday: "short", timeZone: tz }) +
        " " +
        due.toLocaleTimeString("en-US", { hour: "numeric", timeZone: tz }),
      color: "var(--ios-label-3)",
    };
  }
  return {
    text: due.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz }),
    color: "var(--ios-label-3)",
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleComplete(id: string) {
    const reminder = reminders.find((r) => r.id === id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      if (reminder?.source_app === "student-success") {
        await completeCourseReminder(id);
      } else {
        await completeReminder(id);
      }
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

  function handleUpdateNextSteps(id: string, nextSteps: string[]) {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, next_steps: nextSteps } : r))
    );
    startTransition(async () => {
      await updateReminder(id, { next_steps: nextSteps });
    });
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 16px 8px" }}>
        <span className="ios-headline">Reminders</span>
        <button
          onClick={() => setShowAdd(!showAdd)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 12px",
            borderRadius: 999,
            border: "none",
            background: showAdd ? "var(--ios-tint)" : "var(--ios-fill)",
            color: showAdd ? "var(--ios-on-tint)" : "var(--ios-tint)",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {showAdd ? "Cancel" : (<><Icons.PlusIcon width={14} height={14} /> Add</>)}
        </button>
      </div>

      {showAdd && (
        <div style={{ padding: "0 16px 12px" }}>
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
        </div>
      )}

      {reminders.length === 0 ? (
        <p className="ios-footnote" style={{ color: "var(--ios-label-3)", padding: "16px", textAlign: "center" }}>
          Nothing upcoming.
        </p>
      ) : (
        <div style={{ maxHeight: 280, overflowY: "auto" }}>
          {reminders.map((r, idx) => {
            const due = formatDue(r.due_at, tz);
            const isExpanded = expandedId === r.id;
            const isCourse = r.source_app === "student-success";
            const color = isCourse ? "#6B5B95" : CATEGORY_COLOR[r.category];

            return (
              <div key={r.id}>
                <div
                  style={{
                    padding: "10px 16px",
                    borderTop: idx === 0 ? undefined : "var(--ios-hair) solid var(--ios-separator)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {/* Icon — course type or category badge */}
                  <IconBadge color={color}>
                    {isCourse ? courseIcon(r.reminder_type) : categoryIcon(r.category)}
                  </IconBadge>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <div className="ios-truncate" style={{ fontSize: 15, color: "var(--ios-label)", maxWidth: "100%" }}>
                        {r.title}
                      </div>
                      {/* Course badge */}
                      {isCourse && r.course_name && (
                        <a
                          href={`/home/me/courses/${r.course_id}`}
                          className="ios-caption"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            fontWeight: 600,
                            padding: "1px 7px",
                            borderRadius: 999,
                            background: "var(--ios-fill)",
                            color: "#6B5B95",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                          title={`Go to ${r.course_name}`}
                        >
                          <Icons.BookIcon width={11} height={11} /> {r.course_name}
                        </a>
                      )}
                    </div>
                    <div className="ios-caption" style={{ color: due.color, marginTop: 1 }}>
                      {due.text}
                      {r.recurrence !== "once" && (
                        <span style={{ color: "var(--ios-label-3)" }}> · {RECURRENCE_LABEL[r.recurrence]}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    {/* Expand — only for hub reminders (course reminders have no next_steps) */}
                    {!isCourse && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        disabled={pending}
                        title="Show details"
                        style={iconBtn}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16} aria-hidden style={{ transform: isExpanded ? "rotate(90deg)" : undefined, transition: "transform 120ms" }}>
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                    {/* Complete */}
                    <button
                      onClick={() => handleComplete(r.id)}
                      disabled={pending}
                      title="Mark done"
                      style={{ ...iconBtn, color: "var(--ios-green)" }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16} aria-hidden>
                        <path d="M5 12.5l4.5 4.5L19 6.5" />
                      </svg>
                    </button>
                    {/* Snooze — hub reminders only */}
                    {!isCourse && (
                      <button
                        onClick={() => handleSnooze(r.id, 24)}
                        disabled={pending}
                        title="Snooze 1 day"
                        style={iconBtn}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={16} height={16} aria-hidden>
                          <circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 2.5L5.5 5M15 2.5L18.5 5" />
                        </svg>
                      </button>
                    )}
                    {/* Delete — hub reminders only (course reminders are managed in Student Success) */}
                    {!isCourse && (
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={pending}
                        title="Delete"
                        style={{ ...iconBtn, color: "var(--ios-label-3)" }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16} aria-hidden>
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {isExpanded && !isCourse && (
                  <ReminderDetails
                    reminder={r}
                    onUpdateNextSteps={handleUpdateNextSteps}
                    pending={pending}
                  />
                )}
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
  const defaultWhen = new Date(new Date().getTime() + 86_400_000);
  const [when, setWhen] = useState(toLocalDatetimeInput(defaultWhen, tz));
  const [recurrence, setRecurrence] = useState<Recurrence>("once");
  const [category, setCategory] = useState<Category>("general");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // ── Household task fields ────────────────────────────────────────
  const [isHousehold, setIsHousehold] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [familyMembers, setFamilyMembers] = useState<{ id: string; name: string; email: string | null }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  async function toggleHousehold() {
    const next = !isHousehold;
    setIsHousehold(next);
    if (next && familyMembers.length === 0) {
      setLoadingMembers(true);
      try {
        const res = await fetch("/api/family/members");
        const data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setFamilyMembers((data.circle ?? []).map((m: any) => ({
          id: m.member_user_id,
          name: m.display_name ?? m.full_name ?? m.email ?? "Family member",
          email: m.email,
        })));
      } catch { /* family data unavailable */ }
      finally { setLoadingMembers(false); }
    }
    if (!next) setAssignedTo("");
  }

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
        is_household: isHousehold,
        assigned_to: assignedTo || null,
      });
      if (res.error) { setError(res.error); return; }
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
      setIsHousehold(false);
      setAssignedTo("");
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "var(--ios-bg)",
        borderRadius: 12,
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
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

      {/* ── Household task toggle ── */}
      <button
        type="button"
        onClick={toggleHousehold}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "6px 12px", borderRadius: 999, alignSelf: "flex-start",
          border: "none",
          background: isHousehold ? "var(--ios-tint)" : "var(--ios-fill)",
          color: isHousehold ? "var(--ios-on-tint)" : "var(--ios-label-2)",
          fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <Icons.HomeIcon width={14} height={14} /> {isHousehold ? "Household task" : "Make household"}
      </button>

      {/* ── Assign to family member ── */}
      {isHousehold && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>Assign to:</span>
          {loadingMembers ? (
            <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>Loading…</span>
          ) : familyMembers.length === 0 ? (
            <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>
              No family members —{" "}
              <a href="/home/settings/family" style={{ color: "var(--ios-tint)" }}>invite someone</a>
            </span>
          ) : (
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              style={{ ...miniInput, maxWidth: 180 }}
            >
              <option value="">Anyone in circle</option>
              {familyMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {error && <span className="ios-caption" style={{ color: "var(--ios-red)" }}>{error}</span>}
      <button
        type="submit"
        disabled={pending || !title.trim()}
        style={{
          padding: "8px 14px", borderRadius: 10,
          border: "none",
          background: "var(--ios-tint)", color: "var(--ios-on-tint)",
          fontSize: 14, fontWeight: 600, fontFamily: "inherit",
          cursor: pending || !title.trim() ? "not-allowed" : "pointer",
          opacity: pending || !title.trim() ? 0.5 : 1,
          alignSelf: "flex-start",
        }}
      >
        {pending ? "Adding…" : isHousehold ? "Add household task" : "Add reminder"}
      </button>
    </form>
  );
}

const card: React.CSSProperties = {
  background: "var(--ios-cell)",
  borderRadius: "var(--ios-radius-card)",
  overflow: "hidden",
  minHeight: 320,
};

const miniInput: React.CSSProperties = {
  padding: "8px 10px",
  border: "var(--ios-hair) solid var(--ios-separator)",
  borderRadius: 8,
  background: "var(--ios-cell)",
  color: "var(--ios-label)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--ios-label-2)",
  cursor: "pointer",
  padding: "3px",
  borderRadius: 6,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

function ReminderDetails({
  reminder,
  onUpdateNextSteps,
  pending,
}: {
  reminder: Reminder;
  onUpdateNextSteps: (id: string, steps: string[]) => void;
  pending: boolean;
}) {
  const [nextSteps, setNextSteps] = useState<string[]>(reminder.next_steps ?? []);
  const [newStep, setNewStep] = useState("");

  function handleAddStep() {
    const step = newStep.trim();
    if (step) {
      const updated = [...nextSteps, step];
      setNextSteps(updated);
      onUpdateNextSteps(reminder.id, updated);
      setNewStep("");
    }
  }

  function handleRemoveStep(idx: number) {
    const updated = nextSteps.filter((_, i) => i !== idx);
    setNextSteps(updated);
    onUpdateNextSteps(reminder.id, updated);
  }

  return (
    <div
      style={{
        padding: "6px 16px 12px 56px",
        color: "var(--ios-label-2)",
      }}
    >
      {reminder.notes && (
        <div style={{ marginBottom: 8 }}>
          <div className="ios-caption" style={{ fontWeight: 600, color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
            Notes
          </div>
          <div className="ios-footnote" style={{ whiteSpace: "pre-wrap", color: "var(--ios-label)" }}>{reminder.notes}</div>
        </div>
      )}
      <div>
        <div className="ios-caption" style={{ fontWeight: 600, color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
          Research next steps
        </div>
        {nextSteps.length > 0 && (
          <ul style={{ margin: "0 0 6px", padding: 0, listStyle: "none" }}>
            {nextSteps.map((step, idx) => (
              <li
                key={idx}
                className="ios-footnote"
                style={{
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                  color: "var(--ios-label)",
                }}
              >
                <span style={{ flexShrink: 0 }}>{step}</span>
                <button
                  onClick={() => handleRemoveStep(idx)}
                  disabled={pending}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--ios-label-3)",
                    cursor: "pointer",
                    padding: 0,
                    marginLeft: "auto",
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                  title="Remove"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={13} height={13} aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddStep();
              }
            }}
            placeholder="Add a next step…"
            disabled={pending}
            style={{
              ...miniInput,
              flex: 1,
              fontSize: 13,
              padding: "6px 10px",
            }}
          />
          <button
            onClick={handleAddStep}
            disabled={pending || !newStep.trim()}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "none",
              background: newStep.trim() ? "var(--ios-tint)" : "var(--ios-fill)",
              color: newStep.trim() ? "var(--ios-on-tint)" : "var(--ios-label-3)",
              fontSize: 13,
              fontWeight: 500,
              cursor: newStep.trim() ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
