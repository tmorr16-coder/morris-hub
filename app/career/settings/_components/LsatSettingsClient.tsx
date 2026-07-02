"use client";

import { useState } from "react";
import { saveLsatSettings } from "../actions";

interface Props {
  lsatEnabled: boolean;
  lsatTargetScore: number | null;
}

export default function LsatSettingsClient({
  lsatEnabled: initialLsatEnabled,
  lsatTargetScore: initialLsatTargetScore,
}: Props) {
  const [lsatEnabled, setLsatEnabled] = useState(initialLsatEnabled);
  const [lsatTargetScore, setLsatTargetScore] = useState(initialLsatTargetScore ?? 165);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const card: React.CSSProperties = { background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "20px 22px", marginBottom: 16 };
  const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 10, display: "block" };

  async function handleToggle() {
    const next = !lsatEnabled;
    setLsatEnabled(next);
    setIsSaving(true);
    setMessage(null);
    const result = await saveLsatSettings({ lsatEnabled: next, lsatTargetScore });
    setIsSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Settings saved!" });
    }
  }

  async function handleSaveScore() {
    setIsSaving(true);
    setMessage(null);
    const result = await saveLsatSettings({ lsatEnabled, lsatTargetScore });
    setIsSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Settings saved!" });
    }
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <span style={label}>LSAT Prep</span>
          <p style={{ fontSize: 12, color: "var(--color-ink-3)", margin: 0 }}>
            Error log, blind review, confidence calibration, and AI-powered explanations.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={isSaving}
          style={{
            width: 44, height: 24, borderRadius: 12, border: "none",
            background: lsatEnabled ? "var(--color-accent)" : "var(--color-rule)",
            cursor: isSaving ? "default" : "pointer", position: "relative", flexShrink: 0, marginLeft: 16, transition: "background 150ms",
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
              onMouseUp={handleSaveScore}
              onTouchEnd={handleSaveScore}
              style={{ flex: 1, cursor: "pointer", accentColor: "var(--color-accent)" }}
            />
            <span style={{ fontSize: 20, fontWeight: 700, color: "var(--color-accent)", minWidth: 36 }}>{lsatTargetScore}</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 4 }}>
            The AI study plan and drill prioritization will optimize toward this score.
          </p>
        </div>
      )}

      {message && (
        <div style={{
          marginTop: 14, padding: "10px 14px", borderRadius: 8, fontSize: 13,
          background: message.type === "success" ? "rgba(74,107,58,0.08)" : "rgba(154,59,42,0.08)",
          color: message.type === "success" ? "var(--color-green)" : "var(--color-red)",
          border: `1px solid ${message.type === "success" ? "var(--color-green)" : "var(--color-red)"}`,
        }}>
          {message.text}
        </div>
      )}
    </div>
  );
}
