"use client";

import { useState } from "react";

interface Reminder {
  id: string;
  type: string;
  title: string;
  due_date: string;
  is_completed: boolean;
  courses: { name: string; color_tag: string };
}

const TYPE_ICONS: Record<string, string> = {
  test: "📝",
  assignment: "📄",
  quiz: "❓",
  practice: "🎯",
  extra_credit: "⭐",
  reading: "📖",
  exam: "📋",
};

export default function UpcomingRemindersSection({ reminders: initialReminders }: { reminders: Reminder[] }) {
  const [reminders, setReminders] = useState(initialReminders);
  const [completing, setCompleting] = useState<string | null>(null);

  const handleMarkComplete = async (id: string) => {
    setCompleting(id);
    try {
      const res = await fetch(`/api/student-support/reminders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: true }),
      });
      if (res.ok) setReminders(reminders.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Failed to mark complete:", err);
    } finally {
      setCompleting(null);
    }
  };

  const getDaysUntil = (dueDate: string) => {
    const diff = new Date(dueDate).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  const dueDateLabel = (days: number) => {
    if (days < 0) return "Overdue";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `${days}d`;
  };

  const urgency = (days: number): "overdue" | "urgent" | "soon" | "normal" => {
    if (days < 0)  return "overdue";
    if (days <= 1) return "urgent";
    if (days <= 4) return "soon";
    return "normal";
  };

  const urgencyStyle = (u: ReturnType<typeof urgency>) => {
    switch (u) {
      case "overdue": return { bg: "rgba(154,59,42,0.06)", border: "var(--color-red)", label: "var(--color-red)" };
      case "urgent":  return { bg: "rgba(184,138,46,0.08)", border: "var(--color-amber)", label: "var(--color-amber)" };
      case "soon":    return { bg: "var(--color-bg-card)", border: "var(--color-rule)", label: "var(--color-ink-3)" };
      default:        return { bg: "var(--color-bg-card)", border: "var(--color-rule)", label: "var(--color-ink-4)" };
    }
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 400, margin: 0, letterSpacing: "-0.01em" }}>
          Upcoming
        </h2>
        {reminders.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: "var(--color-accent)",
            background: "var(--color-accent-soft)", padding: "2px 8px", borderRadius: 10,
          }}>
            {reminders.length}
          </span>
        )}
      </div>

      {reminders.length === 0 ? (
        <div style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "28px 20px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 600, color: "var(--color-ink)", marginBottom: 2 }}>All caught up!</div>
          <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>No upcoming reminders.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {reminders.map((r) => {
            const days = getDaysUntil(r.due_date);
            const u = urgency(days);
            const s = urgencyStyle(u);
            const isCompleting = completing === r.id;

            return (
              <div key={r.id} style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                borderRadius: 10,
                padding: "11px 14px",
                display: "flex", alignItems: "flex-start", gap: 10,
                transition: "opacity 200ms",
                opacity: isCompleting ? 0.5 : 1,
              }}>
                {/* Type icon */}
                <div style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>
                  {TYPE_ICONS[r.type] ?? "📌"}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", marginBottom: 3, lineHeight: 1.3 }}>
                    {r.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--color-ink-3)" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: r.courses?.color_tag, display: "inline-block", flexShrink: 0 }} />
                      {r.courses?.name}
                    </span>
                  </div>
                </div>

                {/* Due date + complete button */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: s.label,
                    background: u === "overdue" ? "rgba(154,59,42,0.1)" : u === "urgent" ? "rgba(184,138,46,0.12)" : "transparent",
                    padding: "2px 6px", borderRadius: 6,
                  }}>
                    {dueDateLabel(days)}
                  </span>
                  <button
                    onClick={() => handleMarkComplete(r.id)}
                    disabled={isCompleting}
                    title="Mark complete"
                    style={{
                      width: 24, height: 24, borderRadius: "50%",
                      border: "1.5px solid var(--color-rule)",
                      background: "transparent",
                      cursor: "pointer", fontSize: 11,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--color-ink-3)",
                      transition: "border-color 100ms, color 100ms",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--color-green)";
                      (e.currentTarget as HTMLElement).style.color = "var(--color-green)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--color-rule)";
                      (e.currentTarget as HTMLElement).style.color = "var(--color-ink-3)";
                    }}
                  >
                    ✓
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
