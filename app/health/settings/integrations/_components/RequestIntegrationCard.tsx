"use client";

import { useState, useTransition } from "react";
import { Cell, IconBadge, Icons } from "@/components/ios";
import { requestIntegration } from "../actions";

const cellInput: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  color: "var(--ios-label)",
  fontSize: 17,
  outline: "none",
  padding: 0,
  fontFamily: "inherit",
};

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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="ios-list" style={{ margin: 0 }}>
        <Cell
          chevron={false}
          lead={<IconBadge color="#8E8E93"><Icons.ComposeIcon /></IconBadge>}
          title="Request an integration"
          subtitle="Don't see your device or service?"
        />

        {sent ? (
          <div className="ios-cell">
            <span className="ios-cell-body">
              <span className="ios-cell-title" style={{ color: "var(--ios-green)" }}>Request sent</span>
              <span className="ios-cell-sub">The admin team has been notified and will follow up.</span>
            </span>
          </div>
        ) : (
          <>
            <div className="ios-cell">
              <input
                value={integration}
                onChange={(e) => { setIntegration(e.target.value); setSent(false); setError(null); }}
                placeholder="Device or service — e.g. Fitbit, Garmin…"
                style={cellInput}
              />
            </div>
            <div className="ios-cell" style={{ alignItems: "flex-start" }}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Why would it help? (optional)"
                rows={2}
                style={{ ...cellInput, resize: "none", lineHeight: 1.4, paddingTop: 2 }}
              />
            </div>
          </>
        )}
      </div>

      {sent ? (
        <button
          className="ios-btn ios-btn--plain"
          onClick={() => setSent(false)}
          style={{ alignSelf: "flex-start", margin: "0 16px" }}
        >
          Submit another
        </button>
      ) : (
        <>
          <button
            className="ios-btn ios-btn--primary"
            onClick={handleSubmit}
            disabled={isPending || !integration.trim()}
            style={{ margin: "0 16px", width: "calc(100% - 32px)", opacity: integration.trim() && !isPending ? 1 : 0.5 }}
          >
            {isPending ? "Sending…" : "Send request"}
          </button>
          {error && <p className="ios-footnote" style={{ color: "var(--ios-red)", padding: "2px 16px 0" }}>{error}</p>}
        </>
      )}
    </div>
  );
}
