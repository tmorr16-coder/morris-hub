"use client";

import { useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { Group, Cell, IconBadge, Icons } from "@/components/ios";

interface Reminder {
  id: string;
  type: string;
  title: string;
  due_date: string;
  is_completed: boolean;
  courses: { name: string; color_tag: string };
}

const TYPE_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  test: Icons.ComposeIcon,
  assignment: Icons.ChecklistIcon,
  quiz: Icons.BookIcon,
  practice: Icons.ChartIcon,
  extra_credit: Icons.SparkleIcon,
  reading: Icons.BookIcon,
  exam: Icons.ChecklistIcon,
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
    const diff = new Date(dueDate).getTime() - new Date().getTime();
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

  const urgencyColor = (u: ReturnType<typeof urgency>) => {
    switch (u) {
      case "overdue": return "var(--ios-red)";
      case "urgent":  return "var(--ios-orange)";
      case "soon":    return "var(--ios-label-2)";
      default:        return "var(--ios-label-3)";
    }
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 6px" }}>
        <h2 className="ios-title-3" style={{ margin: 0 }}>Upcoming</h2>
        {reminders.length > 0 && (
          <span className="ios-footnote ios-num" style={{
            fontWeight: 600, color: "var(--ios-tint)",
            background: "var(--ios-fill)", padding: "2px 9px", borderRadius: 999,
          }}>
            {reminders.length}
          </span>
        )}
      </div>

      {reminders.length === 0 ? (
        <div style={{
          background: "var(--ios-cell)",
          borderRadius: "var(--ios-radius-card)",
          padding: "28px 20px",
          textAlign: "center",
        }}>
          <div className="ios-headline" style={{ marginBottom: 2 }}>All caught up</div>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>No upcoming reminders.</div>
        </div>
      ) : (
        <Group style={{ margin: 0 }}>
          {reminders.map((r) => {
            const days = getDaysUntil(r.due_date);
            const u = urgency(days);
            const isCompleting = completing === r.id;
            const TypeIcon = TYPE_ICONS[r.type] ?? Icons.BellIcon;

            return (
              <Cell
                key={r.id}
                lead={
                  <IconBadge color={r.courses?.color_tag ?? "var(--ios-tint)"}>
                    <TypeIcon style={{ color: "#fff" }} />
                  </IconBadge>
                }
                title={r.title}
                subtitle={r.courses?.name}
                trailing={
                  <span style={{ display: "flex", alignItems: "center", gap: 10, opacity: isCompleting ? 0.5 : 1 }}>
                    <span className="ios-footnote ios-num" style={{ fontWeight: 600, color: urgencyColor(u) }}>
                      {dueDateLabel(days)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMarkComplete(r.id)}
                      disabled={isCompleting}
                      aria-label="Mark complete"
                      style={{
                        width: 26, height: 26, borderRadius: "50%",
                        border: "1.5px solid var(--ios-separator)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--ios-green)",
                      }}
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 12l5 5 9-11" />
                      </svg>
                    </button>
                  </span>
                }
              />
            );
          })}
        </Group>
      )}
    </section>
  );
}
