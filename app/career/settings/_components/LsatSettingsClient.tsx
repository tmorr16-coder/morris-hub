"use client";

import { useState } from "react";
import { List } from "@/components/ios";
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

  const subFieldLabel: React.CSSProperties = {
    fontSize: 13, fontWeight: 400, color: "var(--ios-label-2)",
    textTransform: "uppercase", letterSpacing: "0.02em",
  };

  return (
    <section className="ios-group">
      <List>
        <div className="ios-cell">
          <span className="ios-cell-body">
            <span className="ios-cell-title">LSAT Prep</span>
            <span className="ios-cell-sub">
              Error log, blind review, confidence calibration, and AI-powered explanations.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={lsatEnabled}
            onClick={handleToggle}
            disabled={isSaving}
            style={{
              width: 51, height: 31, borderRadius: 16, border: "none",
              background: lsatEnabled ? "var(--ios-green)" : "var(--ios-fill-2)",
              cursor: isSaving ? "default" : "pointer", position: "relative", flexShrink: 0, transition: "background 150ms",
            }}
          >
            <span style={{
              position: "absolute", top: 2, left: lsatEnabled ? 22 : 2,
              width: 27, height: 27, borderRadius: "50%", background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 150ms",
            }} />
          </button>
        </div>

        {lsatEnabled && (
          <div className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={subFieldLabel}>Target Score (120–180)</span>
              <span className="ios-num" style={{ fontSize: 22, fontWeight: 700, color: "var(--ios-tint)" }}>{lsatTargetScore}</span>
            </div>
            <input
              type="range" min="140" max="180" step="1"
              value={lsatTargetScore}
              onChange={(e) => setLsatTargetScore(parseInt(e.target.value))}
              onMouseUp={handleSaveScore}
              onTouchEnd={handleSaveScore}
              style={{ width: "100%", cursor: "pointer", accentColor: "var(--ios-tint)" }}
            />
            <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
              The AI study plan and drill prioritization will optimize toward this score.
            </span>
          </div>
        )}
      </List>

      {message && (
        <p
          className="ios-group-footer ios-footnote"
          style={{ color: message.type === "success" ? "var(--ios-green)" : "var(--ios-red)" }}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
