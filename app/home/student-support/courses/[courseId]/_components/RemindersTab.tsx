"use client";

import { useState } from "react";

interface Reminder {
  id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string;
  due_time?: string;
  is_completed: boolean;
}

interface RemindersTabProps {
  courseId: string;
  reminders: Reminder[];
  onReminderAdded: (reminder: Reminder) => void;
  onReminderDeleted: (id: string) => void;
}

const REMINDER_TYPES = [
  { id: "test", label: "📝 Test", color: "#ef4444" },
  { id: "assignment", label: "📄 Assignment", color: "#f59e0b" },
  { id: "quiz", label: "❓ Quiz", color: "#3b82f6" },
  { id: "practice", label: "🎯 Practice", color: "#10b981" },
  { id: "extra_credit", label: "⭐ Extra Credit", color: "#8b5cf6" },
];

export default function RemindersTab({
  courseId,
  reminders,
  onReminderAdded,
  onReminderDeleted,
}: RemindersTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    type: "assignment",
    title: "",
    description: "",
    due_date: "",
    due_time: "",
  });
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/student-support/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          ...formData,
        }),
      });

      if (!response.ok) throw new Error("Failed to add reminder");

      const newReminder = await response.json();
      onReminderAdded(newReminder);
      setFormData({
        type: "assignment",
        title: "",
        description: "",
        due_date: "",
        due_time: "",
      });
      setShowAddForm(false);
    } catch (err) {
      console.error("Error adding reminder:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    setDeleteLoading(reminderId);

    try {
      const response = await fetch(`/api/student-support/reminders/${reminderId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onReminderDeleted(reminderId);
      }
    } catch (err) {
      console.error("Error deleting reminder:", err);
    } finally {
      setDeleteLoading(null);
    }
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Assignment & Test Tracker</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            background: "var(--color-accent-dark)",
            color: "white",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          + Add Reminder
        </button>
      </div>

      {showAddForm && (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 8,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <form onSubmit={handleAddReminder}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                {REMINDER_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="e.g., Midterm Exam"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                  Due Date *
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                  min={getTodayDate()}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--color-rule)",
                    borderRadius: 6,
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                  Due Time (optional)
                </label>
                <input
                  type="time"
                  value={formData.due_time}
                  onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--color-rule)",
                    borderRadius: 6,
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Covers chapters 1-5, bring ID..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 13,
                  boxSizing: "border-box",
                  minHeight: 60,
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--color-rule)",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.title || !formData.due_date}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: loading || !formData.title || !formData.due_date ? "var(--color-paper-deep)" : "var(--color-accent-dark)",
                  color: "white",
                  cursor: loading || !formData.title || !formData.due_date ? "default" : "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  opacity: loading || !formData.title || !formData.due_date ? 0.6 : 1,
                }}
              >
                {loading ? "Adding..." : "Add Reminder"}
              </button>
            </div>
          </form>
        </div>
      )}

      {reminders.length === 0 ? (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 8,
            padding: "32px 24px",
            textAlign: "center",
            color: "var(--color-ink-3)",
          }}
        >
          <p>No reminders set. Add one to stay on top of your assignments!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {reminders.map((reminder) => {
            const reminderType = REMINDER_TYPES.find((t) => t.id === reminder.type);
            const daysUntil = Math.ceil((new Date(reminder.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            const isUrgent = daysUntil <= 2;

            return (
              <div
                key={reminder.id}
                style={{
                  background: isUrgent ? "rgba(239, 68, 68, 0.05)" : "var(--color-bg-card)",
                  border: isUrgent ? "1px solid #fecaca" : "1px solid var(--color-rule)",
                  borderRadius: 8,
                  padding: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{reminderType?.label.charAt(0)}</span>
                    <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--color-ink)" }}>
                      {reminder.title}
                    </h3>
                  </div>
                  {reminder.description && (
                    <p style={{ fontSize: 12, color: "var(--color-ink-3)", margin: "6px 0" }}>
                      {reminder.description}
                    </p>
                  )}
                  <p style={{ fontSize: 12, color: isUrgent ? reminderType?.color : "var(--color-ink-3)", margin: 0, fontWeight: isUrgent ? 600 : 400 }}>
                    📅 {new Date(reminder.due_date).toLocaleDateString()}
                    {reminder.due_time && ` at ${reminder.due_time}`}
                    {" • "}
                    {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days away`}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteReminder(reminder.id)}
                  disabled={deleteLoading === reminder.id}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "1px solid #fecaca",
                    background: "#fee2e2",
                    color: "#991b1b",
                    fontSize: 11,
                    cursor: deleteLoading === reminder.id ? "default" : "pointer",
                    fontWeight: 500,
                    opacity: deleteLoading === reminder.id ? 0.6 : 1,
                  }}
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
