"use client";

import { useState } from "react";

interface Reminder {
  id: string;
  type: string;
  title: string;
  due_date: string;
  is_completed: boolean;
  courses: {
    name: string;
    color_tag: string;
  };
}

export default function UpcomingRemindersSection({ reminders: initialReminders }: { reminders: Reminder[] }) {
  const [reminders, setReminders] = useState(initialReminders);

  const handleMarkComplete = async (reminderId: string) => {
    try {
      const response = await fetch(`/api/student-support/reminders/${reminderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: true }),
      });

      if (response.ok) {
        setReminders(reminders.filter((r) => r.id !== reminderId));
      }
    } catch (err) {
      console.error("Failed to mark reminder complete:", err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "test":
        return "📝";
      case "assignment":
        return "📄";
      case "quiz":
        return "❓";
      case "practice":
        return "🎯";
      case "extra_credit":
        return "⭐";
      default:
        return "📌";
    }
  };

  const getDaysUntil = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diff = due.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <section>
      <h2 className="serif" style={{ fontSize: 24, marginBottom: 16 }}>
        Upcoming Reminders
      </h2>

      {reminders.length === 0 ? (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 12,
            padding: "24px",
            textAlign: "center",
            color: "var(--color-ink-3)",
            fontSize: 13,
          }}
        >
          <p>No upcoming reminders. You're all caught up! 🎉</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reminders.map((reminder) => {
            const daysUntil = getDaysUntil(reminder.due_date);
            const isUrgent = daysUntil <= 2;

            return (
              <div
                key={reminder.id}
                style={{
                  background: isUrgent ? "rgba(239, 68, 68, 0.05)" : "var(--color-bg-card)",
                  border: isUrgent ? "1px solid #fecaca" : "1px solid var(--color-rule)",
                  borderRadius: 8,
                  padding: "12px",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "start" }}>
                  <div style={{ fontSize: 16 }}>{getTypeIcon(reminder.type)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                      <h3
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--color-ink)",
                          margin: 0,
                          wordBreak: "break-word",
                        }}
                      >
                        {reminder.title}
                      </h3>
                      <button
                        onClick={() => handleMarkComplete(reminder.id)}
                        style={{
                          padding: "2px 8px",
                          fontSize: 11,
                          border: "1px solid var(--color-rule)",
                          borderRadius: 4,
                          background: "transparent",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          color: "var(--color-ink-3)",
                        }}
                      >
                        ✓
                      </button>
                    </div>
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--color-ink-3)",
                        margin: "4px 0 0 0",
                      }}
                    >
                      <span style={{ display: "inline-block", marginRight: 12 }}>
                        📚 {reminder.courses.name}
                      </span>
                      <span
                        style={{
                          color: isUrgent ? "var(--color-accent-dark)" : "var(--color-ink-3)",
                          fontWeight: isUrgent ? 600 : 400,
                        }}
                      >
                        {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
