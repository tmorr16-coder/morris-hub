"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCourseReminderSettings } from "../actions";

interface Settings {
  phone_number?: string | null;
  sms_notifications_enabled?: boolean;
  reminder_lead_days?: number;
}

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
    <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div className="ios-group-header">SMS Reminders</div>
        <div style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: "16px" }}>
          <div style={{ marginBottom: 16 }}>
            <label className="ios-footnote" style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "var(--ios-label-2)" }}>
              Phone Number
            </label>
            <input
              type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+12125552368"
              style={inputStyle}
            />
            <p className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>
              E.164 format: +1 country code then number
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "var(--ios-hair) solid var(--ios-separator)" }}>
            <span className="ios-body">Enable SMS reminders</span>
            <button
              type="button"
              role="switch"
              aria-checked={smsEnabled}
              aria-label="Enable SMS reminders"
              onClick={() => setSmsEnabled(!smsEnabled)}
              style={{
                width: 51, height: 31, borderRadius: 999, flexShrink: 0,
                background: smsEnabled ? "var(--ios-green)" : "var(--ios-fill)",
                display: "flex", alignItems: "center", padding: 2,
                transition: "background 0.2s ease",
              }}
            >
              <span style={{
                width: 27, height: 27, borderRadius: "50%", background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                transform: smsEnabled ? "translateX(20px)" : "translateX(0)",
                transition: "transform 0.2s ease",
              }} />
            </button>
          </div>

          <div style={{ paddingTop: 12, borderTop: "var(--ios-hair) solid var(--ios-separator)" }}>
            <label className="ios-footnote" style={{ display: "block", fontWeight: 600, marginBottom: 8, color: "var(--ios-label-2)" }}>
              Remind me <span className="ios-num">{reminderLeadDays}</span> day{reminderLeadDays !== 1 ? "s" : ""} before due date
            </label>
            <input
              type="range" min="1" max="7" value={reminderLeadDays}
              onChange={(e) => setReminderLeadDays(parseInt(e.target.value))}
              style={{ width: "100%", cursor: "pointer", accentColor: "var(--ios-tint)" }}
            />
          </div>
        </div>
      </div>

      {message && (
        <p className="ios-footnote" style={{
          padding: "0 4px",
          color: message.type === "success" ? "var(--ios-green)" : "var(--ios-red)",
        }}>
          {message.text}
        </p>
      )}

      <button type="submit" className="ios-btn ios-btn--primary" disabled={isSaving} style={{ opacity: isSaving ? 0.5 : 1 }}>
        {isSaving ? "Saving…" : "Save Settings"}
      </button>
    </form>
  );
}
