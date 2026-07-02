"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCourseReminderSettings } from "../actions";

interface Settings {
  phone_number?: string | null;
  sms_notifications_enabled?: boolean;
  reminder_lead_days?: number;
}

export default function CourseReminderSettingsForm({ initialSettings }: { initialSettings: Settings }) {
  const router = useRouter();
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
      const result = await saveCourseReminderSettings({
        phoneNumber: phoneNumber || null,
        smsEnabled,
        reminderLeadDays,
      });
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Settings saved!" });
        router.refresh();
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save settings." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ padding: "20px 24px", border: "1px solid var(--color-rule)", borderRadius: 12, background: "var(--color-bg-card)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "var(--color-ink)" }}>📱 SMS Reminders</h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--color-ink-2)" }}>
            Phone Number
          </label>
          <input
            type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+12125552368"
            style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--color-rule)", borderRadius: 6, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <p style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 4 }}>E.164 format: +1 country code then number</p>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 16 }}>
          <input type="checkbox" checked={smsEnabled} onChange={(e) => setSmsEnabled(e.target.checked)} />
          <span style={{ fontSize: 14, color: "var(--color-ink)" }}>Enable SMS reminders</span>
        </label>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--color-ink-2)" }}>
            Remind me {reminderLeadDays} day{reminderLeadDays !== 1 ? "s" : ""} before due date
          </label>
          <input type="range" min="1" max="7" value={reminderLeadDays} onChange={(e) => setReminderLeadDays(parseInt(e.target.value))} style={{ width: "100%", cursor: "pointer" }} />
        </div>
      </div>

      {message && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, fontSize: 13,
          background: message.type === "success" ? "rgba(74,107,58,0.08)" : "rgba(154,59,42,0.08)",
          color: message.type === "success" ? "var(--color-green)" : "var(--color-red)",
          border: `1px solid ${message.type === "success" ? "var(--color-green)" : "var(--color-red)"}`,
        }}>
          {message.text}
        </div>
      )}

      <button type="submit" disabled={isSaving} style={{
        padding: "10px 24px", background: isSaving ? "var(--color-rule)" : "var(--color-accent)",
        color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
        cursor: isSaving ? "default" : "pointer", fontFamily: "inherit", alignSelf: "flex-start",
      }}>
        {isSaving ? "Saving…" : "Save Settings"}
      </button>
    </form>
  );
}
