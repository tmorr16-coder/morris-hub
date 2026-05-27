"use client";

import { useState } from "react";
import { saveStudentSettings } from "../actions";

interface StudentSettings {
  phone_number?: string | null;
  sms_notifications_enabled?: boolean;
  reminder_lead_days?: number;
}

interface StudentSettingsFormProps {
  initialSettings: StudentSettings;
}

export default function StudentSettingsForm({ initialSettings }: StudentSettingsFormProps) {
  const [phoneNumber, setPhoneNumber] = useState(initialSettings.phone_number ?? "");
  const [smsEnabled, setSmsEnabled] = useState(initialSettings.sms_notifications_enabled ?? true);
  const [reminderLeadDays, setReminderLeadDays] = useState(initialSettings.reminder_lead_days ?? 3);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const result = await saveStudentSettings({
        phoneNumber: phoneNumber || null,
        smsEnabled,
        reminderLeadDays,
      });

      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Settings saved successfully!" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to save settings. Please try again." });
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ marginBottom: 32, padding: 20, border: "1px solid var(--color-rule)", borderRadius: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>📱 SMS Reminders</h2>

        {/* Phone Number */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--color-ink-2)" }}>
            Phone Number (E.164 format: +12125552368)
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (212) 555-2368"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid var(--color-rule)",
              borderRadius: 6,
              fontSize: 14,
              fontFamily: "inherit",
            }}
          />
          <p style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 4 }}>
            Required for SMS reminders. Must be in E.164 format (e.g., +1-country code-area code-number)
          </p>
        </div>

        {/* SMS Enabled Toggle */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={smsEnabled}
              onChange={(e) => setSmsEnabled(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <span style={{ fontSize: 14 }}>Enable SMS notifications for reminders</span>
          </label>
          <p style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 4 }}>
            You can send SMS reminders manually from the course or let them send automatically
          </p>
        </div>

        {/* Reminder Lead Time */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--color-ink-2)" }}>
            Automatic Reminder Lead Time: {reminderLeadDays} day{reminderLeadDays !== 1 ? "s" : ""} before due date
          </label>
          <input
            type="range"
            min="1"
            max="7"
            value={reminderLeadDays}
            onChange={(e) => setReminderLeadDays(parseInt(e.target.value))}
            style={{ width: "100%", cursor: "pointer" }}
          />
          <p style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 4 }}>
            Reminders scheduled via cron job will send this many days before the due date
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            borderRadius: 6,
            backgroundColor: message.type === "success" ? "rgba(76, 175, 80, 0.1)" : "rgba(244, 67, 54, 0.1)",
            color: message.type === "success" ? "#2e7d32" : "#c62828",
            fontSize: 14,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Save Button */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={isSaving}
          style={{
            padding: "8px 16px",
            backgroundColor: "var(--color-accent)",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: isSaving ? "not-allowed" : "pointer",
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </form>
  );
}
