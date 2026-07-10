"use client";

import { useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { Icons } from "@/components/ios";

interface Reminder {
  id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string;
  due_time?: string;
  is_completed: boolean;
  reminder_sent?: boolean;
  sent_at?: string | null;
}

interface RemindersTabProps {
  courseId: string;
  reminders: Reminder[];
  onReminderAdded: (reminder: Reminder) => void;
  onReminderDeleted: (id: string) => void;
}

const REMINDER_TYPES = [
  { id: "test", label: "Test", color: "var(--ios-red)" },
  { id: "assignment", label: "Assignment", color: "var(--ios-orange)" },
  { id: "quiz", label: "Quiz", color: "var(--ios-tint)" },
  { id: "practice", label: "Practice", color: "var(--ios-green)" },
  { id: "extra_credit", label: "Extra Credit", color: "#AF52DE" },
];

const TYPE_ICON: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  test: Icons.ComposeIcon,
  assignment: Icons.ChecklistIcon,
  quiz: Icons.BookIcon,
  practice: Icons.ChartIcon,
  extra_credit: Icons.SparkleIcon,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "var(--ios-hair) solid var(--ios-separator)",
  background: "var(--ios-cell)",
  color: "var(--ios-label)",
  fontSize: 16,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  colorScheme: "light dark",
};

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
  const [smsLoading, setSmsLoading] = useState<string | null>(null);
  const [smsMessage, setSmsMessage] = useState<string | null>(null);

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

  const handleSendSMS = async (reminderId: string) => {
    setSmsLoading(reminderId);
    setSmsMessage(null);

    try {
      const response = await fetch(`/api/student-support/reminders/${reminderId}/send-sms`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setSmsMessage(`Error: ${data.error}`);
      } else {
        setSmsMessage("SMS sent successfully");
        setTimeout(() => setSmsMessage(null), 3000);
      }
    } catch (err) {
      console.error("Error sending SMS:", err);
      setSmsMessage("Error: Failed to send SMS");
    } finally {
      setSmsLoading(null);
    }
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const submitDisabled = loading || !formData.title || !formData.due_date;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 className="ios-title-3" style={{ margin: 0 }}>Assignments & Tests</h2>
        <button type="button" className="ios-btn--plain" onClick={() => setShowAddForm(true)} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Icons.PlusIcon style={{ width: 17, height: 17 }} />
          Add
        </button>
      </div>

      {smsMessage && (
        <p className="ios-footnote" style={{
          padding: "8px 4px",
          color: smsMessage.startsWith("Error") ? "var(--ios-red)" : "var(--ios-green)",
        }}>
          {smsMessage}
        </p>
      )}

      {reminders.length === 0 ? (
        <div style={{
          background: "var(--ios-cell)",
          borderRadius: "var(--ios-radius-card)",
          padding: "32px 24px",
          textAlign: "center",
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: "var(--ios-label-3)" }}>
            <Icons.BellIcon style={{ width: 30, height: 30 }} />
          </div>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
            No reminders set. Add one to stay on top of your assignments.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reminders.map((reminder) => {
            const reminderType = REMINDER_TYPES.find((t) => t.id === reminder.type);
            const TypeIcon = TYPE_ICON[reminder.type] ?? Icons.BellIcon;
            const daysUntil = Math.ceil((new Date(reminder.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            const isUrgent = daysUntil <= 2;

            return (
              <div
                key={reminder.id}
                style={{
                  background: "var(--ios-cell)",
                  borderRadius: "var(--ios-radius-card)",
                  border: isUrgent ? "1px solid var(--ios-red)" : undefined,
                  padding: "14px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <TypeIcon style={{ width: 18, height: 18, color: reminderType?.color ?? "var(--ios-tint)" }} />
                    <h3 className="ios-headline" style={{ margin: 0 }}>{reminder.title}</h3>
                  </div>
                  {reminder.description && (
                    <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: "4px 0" }}>
                      {reminder.description}
                    </p>
                  )}
                  <p className="ios-footnote ios-num" style={{
                    color: isUrgent ? (reminderType?.color ?? "var(--ios-red)") : "var(--ios-label-2)",
                    margin: 0,
                    fontWeight: isUrgent ? 600 : 400,
                  }}>
                    {new Date(reminder.due_date).toLocaleDateString()}
                    {reminder.due_time && ` at ${reminder.due_time}`}
                    {" • "}
                    {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days away`}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleSendSMS(reminder.id)}
                    disabled={smsLoading === reminder.id}
                    className="ios-footnote"
                    style={{ color: "var(--ios-tint)", fontWeight: 600, opacity: smsLoading === reminder.id ? 0.5 : 1 }}
                  >
                    {smsLoading === reminder.id ? "Sending…" : "SMS"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteReminder(reminder.id)}
                    disabled={deleteLoading === reminder.id}
                    className="ios-footnote"
                    style={{ color: "var(--ios-red)", fontWeight: 600, opacity: deleteLoading === reminder.id ? 0.5 : 1 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddForm && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setShowAddForm(false)} aria-hidden="true" />
          <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Add reminder">
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button type="button" className="ios-btn--plain" onClick={() => setShowAddForm(false)}>Cancel</button>
              <span className="ios-headline">Add Reminder</span>
              <span style={{ width: 52 }} />
            </div>

            <form onSubmit={handleAddReminder}>
              <div className="ios-group-header" style={{ padding: "0 0 8px" }}>Type</div>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                style={inputStyle}
              >
                {REMINDER_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>
                Title <span style={{ color: "var(--ios-red)" }}>*</span>
              </div>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="e.g. Midterm Exam"
                style={inputStyle}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>
                    Due Date <span style={{ color: "var(--ios-red)" }}>*</span>
                  </div>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                    min={getTodayDate()}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Due Time</div>
                  <input
                    type="time"
                    value={formData.due_time}
                    onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Description</div>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g. Covers chapters 1-5, bring ID…"
                rows={2}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />

              <button
                type="submit"
                disabled={submitDisabled}
                className="ios-btn ios-btn--primary"
                style={{ marginTop: 22, opacity: submitDisabled ? 0.5 : 1 }}
              >
                {loading ? "Adding…" : "Add Reminder"}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
