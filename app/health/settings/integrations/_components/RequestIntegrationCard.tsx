"use client";

import { useState, useTransition } from "react";
import { requestIntegration } from "../actions";

export default function RequestIntegrationCard() {
  const [isPending, startTransition] = useTransition();
  const [integration, setIntegration] = useState("");
  const [description, setDescription] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!integration.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await requestIntegration({ integration, description });
      if (result.error) {
        setError(result.error);
      } else {
        setSent(true);
        setIntegration("");
        setDescription("");
      }
    });
  }

  return (
    <div style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 14, overflow: "hidden" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--color-line)" }}>
        <div style={{ fontSize: 24, lineHeight: 1 }}>📬</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-ink)" }}>Request an integration</div>
          <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 1 }}>Don't see your device or service? Let us know.</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {sent ? (
          <div style={{ background: "var(--color-moss-soft)", border: "1px solid var(--color-moss)", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "var(--color-moss)", lineHeight: 1.5 }}>
            ✓ Request sent — the admin team has been notified and will follow up.
            <button
              onClick={() => setSent(false)}
              style={{ display: "block", marginTop: 8, background: "none", border: "none", color: "var(--color-moss)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit", textDecoration: "underline" }}
            >
              Submit another
            </button>
          </div>
        ) : (
          <>
            <div>
              <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 5 }}>
                Device or service
              </div>
              <input
                value={integration}
                onChange={(e) => { setIntegration(e.target.value); setSent(false); setError(null); }}
                placeholder="e.g. Fitbit, Garmin, WHOOP…"
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1px solid var(--color-line)", background: "var(--color-bg-sunk)",
                  color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 5 }}>
                Why would it help? (optional)
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What data would you sync? How do you use it?"
                rows={3}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1px solid var(--color-line)", background: "var(--color-bg-sunk)",
                  color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit",
                  outline: "none", resize: "none", lineHeight: 1.5, boxSizing: "border-box",
                }}
              />
            </div>

            {error && (
              <div style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-accent)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--color-accent)" }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isPending || !integration.trim()}
              style={{
                padding: "11px", borderRadius: 10, border: "none",
                background: integration.trim() ? "var(--color-ink)" : "var(--color-bg-sunk)",
                color: integration.trim() ? "var(--color-bg)" : "var(--color-ink-4)",
                fontSize: 13, fontWeight: 600,
                cursor: integration.trim() ? "pointer" : "default",
                fontFamily: "inherit", transition: "background 150ms",
              }}
            >
              {isPending ? "Sending…" : "Send request"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
