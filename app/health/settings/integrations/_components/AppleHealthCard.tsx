"use client";

import { useState, useRef } from "react";
import { Cell, IconBadge } from "@/components/ios";

interface Props {
  configured: boolean;
  lastSyncAt: string | null;
  metricsCount: number;
  workoutsCount: number;
  webhookUrl: string;
  /** The api-key header value the export app must send. Empty = hidden (non-admin). */
  apiKey?: string;
}

function relativeTime(isoTs: string): string {
  const mins = Math.floor((new Date().getTime() - new Date(isoTs).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const WatchGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="6.5" y="7" width="11" height="10" rx="3" />
    <path d="M9 7l.6-3h4.8l.6 3M9 17l.6 3h4.8l.6-3" />
  </svg>
);

function StatusPill({ on }: { on: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, color: on ? "var(--ios-green)" : "var(--ios-label-2)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "var(--ios-green)" : "var(--ios-label-3)" }} />
      {on ? "Active" : "Not connected"}
    </span>
  );
}

export default function AppleHealthCard({ configured, lastSyncAt, metricsCount, workoutsCount, webhookUrl, apiKey }: Props) {
  const [copied, setCopied] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyShown, setKeyShown] = useState(false);
  const urlRef = useRef<HTMLElement>(null);

  // Select the whole URL so the user can copy manually if the clipboard API
  // is unavailable (older iOS Safari, insecure context, or permission denied).
  function selectUrl() {
    const el = urlRef.current;
    if (!el || typeof window === "undefined") return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
      throw new Error("clipboard unavailable");
    } catch {
      // Fallback — select the text so a long-press → Copy works.
      selectUrl();
    }
  }

  void configured; // available for future gating; connection state derives from hasData
  const hasData = metricsCount > 0 || workoutsCount > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="ios-list" style={{ margin: 0 }}>
        <Cell
          chevron={false}
          lead={<IconBadge color="#1C1C1E"><WatchGlyph /></IconBadge>}
          title="Apple Watch"
          subtitle="Steps · workouts · heart rate · HRV"
          trailing={<StatusPill on={hasData} />}
        />

        {hasData && (
          <>
            <Cell chevron={false} title="Metrics synced" trailing={<span className="ios-num">{metricsCount.toLocaleString()}</span>} />
            <Cell chevron={false} title="Workouts" trailing={<span className="ios-num">{workoutsCount.toLocaleString()}</span>} />
            <Cell chevron={false} title="Last sync" trailing={<span className="ios-num">{lastSyncAt ? relativeTime(lastSyncAt) : "Never"}</span>} />
            <Cell href="/health" title={<span style={{ color: "var(--ios-tint)" }}>View health dashboard</span>} />
          </>
        )}

        {/* Webhook URL — full, wrapping, and selectable */}
        <div style={{ padding: "10px 16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span className="ios-cell-sub" style={{ marginTop: 0 }}>Personal webhook URL</span>
            <button onClick={handleCopy} style={{ color: "var(--ios-tint)", fontSize: 15, fontWeight: copied ? 600 : 400, flexShrink: 0 }}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <code
            ref={urlRef}
            onClick={selectUrl}
            className="ios-num"
            style={{
              display: "block",
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--ios-label)",
              background: "var(--ios-fill)",
              borderRadius: 8,
              padding: "10px 12px",
              wordBreak: "break-all",
              WebkitUserSelect: "all",
              userSelect: "all",
              cursor: "text",
            }}
          >
            {webhookUrl}
          </code>

          {apiKey ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
                <span className="ios-cell-sub" style={{ marginTop: 0 }}>Request header — <code>api-key</code></span>
                <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
                  <button onClick={() => setKeyShown((s) => !s)} style={{ color: "var(--ios-tint)", fontSize: 15 }}>
                    {keyShown ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(apiKey).then(() => {
                        setKeyCopied(true);
                        setTimeout(() => setKeyCopied(false), 2000);
                      }).catch(() => setKeyShown(true));
                    }}
                    style={{ color: "var(--ios-tint)", fontSize: 15, fontWeight: keyCopied ? 600 : 400 }}
                  >
                    {keyCopied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
              </div>
              <code
                className="ios-num"
                style={{
                  display: "block", fontSize: 12, lineHeight: 1.5, color: "var(--ios-label)",
                  background: "var(--ios-fill)", borderRadius: 8, padding: "10px 12px",
                  wordBreak: "break-all", WebkitUserSelect: "all", userSelect: "all",
                }}
              >
                {keyShown ? apiKey : "•".repeat(Math.min(apiKey.length, 40))}
              </code>
            </>
          ) : null}
        </div>
      </div>

      <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "2px 16px 0" }}>
        {hasData
          ? "Data syncs automatically via the Health Auto Export app — your Apple Watch sends metrics as they arrive."
          : "Install Health Auto Export on your iPhone and point it at your personal URL above."}
      </p>

      {!hasData && (
        <ol className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "0 16px 0 34px", margin: 0, lineHeight: 1.7 }}>
          <li>Install <b style={{ fontWeight: 600 }}>Health Auto Export</b> from the App Store.</li>
          <li>Open the app → <b style={{ fontWeight: 600 }}>Settings → Automation</b>.</li>
          <li>Set <b style={{ fontWeight: 600 }}>Export Format: JSON</b>, <b style={{ fontWeight: 600 }}>Export Type: Apple Health</b>.</li>
          <li>Add the webhook URL above as the endpoint.</li>
          <li>Add a request <b style={{ fontWeight: 600 }}>Header</b>: name <code>api-key</code>, value = your export secret{apiKey ? " (shown above)" : ""}. Without it the server returns <b style={{ fontWeight: 600 }}>401</b>.</li>
          <li>For the first backfill, export a <b style={{ fontWeight: 600 }}>short range (1 day at a time)</b> — a full week of all metrics can exceed the server limit (<b style={{ fontWeight: 600 }}>413</b>). Then set the automation to run hourly; ongoing syncs are small.</li>
          <li>Tap <b style={{ fontWeight: 600 }}>Export Now</b> to sync immediately.</li>
        </ol>
      )}

      <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "8px 16px 0" }}>
        Seeing a <b style={{ fontWeight: 600 }}>413 (payload too large)</b>? The export batch is too big — narrow the date range (a day or two) or reduce the number of metrics, then export again. Hourly automations stay well under the limit.
      </p>
    </div>
  );
}
