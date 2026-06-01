"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveStudentSettings } from "../actions";

interface StudentSettings {
  phone_number?: string | null;
  sms_notifications_enabled?: boolean;
  reminder_lead_days?: number;
  lsat_enabled?: boolean;
  lsat_target_score?: number | null;
}

export default function StudentSettingsForm({ initialSettings }: { initialSettings: StudentSettings }) {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState(initialSettings.phone_number ?? "");
  const [smsEnabled, setSmsEnabled] = useState(initialSettings.sms_notifications_enabled ?? true);
  const [reminderLeadDays, setReminderLeadDays] = useState(initialSettings.reminder_lead_days ?? 3);
  const [lsatEnabled, setLsatEnabled] = useState(initialSettings.lsat_enabled ?? false);
  const [lsatTargetScore, setLsatTargetScore] = useState(initialSettings.lsat_target_score ?? 165);
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
        lsatEnabled,
        lsatTargetScore: lsatEnabled ? lsatTargetScore : null,
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
    <form onSubmit={handleSave} style={{ maxWidth: 600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* SMS Reminders */}
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

      {/* LSAT Prep */}
      <div style={{ padding: "20px 24px", border: `1px solid ${lsatEnabled ? "var(--color-accent)" : "var(--color-rule)"}`, borderRadius: 12, background: lsatEnabled ? "var(--color-accent-soft)" : "var(--color-bg-card)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>⚖️ LSAT Prep</h2>
            <p style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 4, marginBottom: 0 }}>
              Error log, blind review, confidence calibration, and AI-powered explanations.
            </p>
          </div>
          {/* Toggle */}
          <button
            type="button"
            onClick={() => setLsatEnabled(!lsatEnabled)}
            style={{
              width: 44, height: 24, borderRadius: 12, border: "none",
              background: lsatEnabled ? "var(--color-accent)" : "var(--color-rule)",
              cursor: "pointer", position: "relative", flexShrink: 0, marginLeft: 16, transition: "background 150ms",
            }}
          >
            <span style={{
              position: "absolute", top: 2, left: lsatEnabled ? 22 : 2,
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 150ms",
            }} />
          </button>
        </div>

        {lsatEnabled && (
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--color-ink-2)" }}>
              Target Score (120–180)
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="range" min="140" max="180" step="1"
                value={lsatTargetScore}
                onChange={(e) => setLsatTargetScore(parseInt(e.target.value))}
                style={{ flex: 1, cursor: "pointer", accentColor: "var(--color-accent)" }}
              />
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--color-accent)", minWidth: 36 }}>{lsatTargetScore}</span>
            </div>
            <p style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 4 }}>
              The AI study plan and drill prioritization will optimize toward this score.
            </p>
          </div>
        )}
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
