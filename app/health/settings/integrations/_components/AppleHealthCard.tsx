"use client";

import { useState, useRef } from "react";
import { Cell, IconBadge } from "@/components/ios";

interface Props {
  configured: boolean;
  lastSyncAt: string | null;
  /** How many separate exports arrived in the last seven days. */
  syncsLast7d?: number;
  metricsCount: number;
  workoutsCount: number;
  webhookUrl: string;
  /** The api-key header value the export app must send. Empty = hidden (non-admin). */
  apiKey?: string;
}

/** Hours since a timestamp; Infinity when there is none. Module scope: clock reads stay out of render. */
function hoursSince(isoTs: string | null): number {
  return isoTs ? (Date.now() - new Date(isoTs).getTime()) / 3_600_000 : Infinity;
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

function StatusPill({ state }: { state: "fresh" | "stale" | "off" }) {
  const color = state === "fresh" ? "var(--ios-green)" : state === "stale" ? "var(--ios-orange)" : "var(--ios-label-2)";
  const dot = state === "fresh" ? "var(--ios-green)" : state === "stale" ? "var(--ios-orange)" : "var(--ios-label-3)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, color }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />
      {state === "fresh" ? "Active" : state === "stale" ? "Not syncing" : "Not connected"}
    </span>
  );
}

export default function AppleHealthCard({ configured, lastSyncAt, syncsLast7d = 0, metricsCount, workoutsCount, webhookUrl, apiKey }: Props) {
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
  // "Active" used to mean "has ever received anything". A watch that last
  // reported three days ago is not active; say so, and say why below.
  const state: "fresh" | "stale" | "off" = !hasData ? "off" : hoursSince(lastSyncAt) <= 24 ? "fresh" : "stale";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="ios-list" style={{ margin: 0 }}>
        <Cell
          chevron={false}
          lead={<IconBadge color="#1C1C1E"><WatchGlyph /></IconBadge>}
          title="Apple Watch"
          subtitle="Steps · workouts · heart rate · HRV"
          trailing={<StatusPill state={state} />}
        />

        {hasData && (
          <>
            <Cell chevron={false} title="Metrics synced" trailing={<span className="ios-num">{metricsCount.toLocaleString()}</span>} />
            <Cell chevron={false} title="Workouts" trailing={<span className="ios-num">{workoutsCount.toLocaleString()}</span>} />
            <Cell chevron={false} title="Last sync" trailing={<span className="ios-num" style={{ color: state === "stale" ? "var(--ios-orange)" : undefined }}>{lastSyncAt ? relativeTime(lastSyncAt) : "Never"}</span>} />
            <Cell chevron={false} title="Exports in the last 7 days" subtitle={syncsLast7d <= 7 ? "A working automation sends several a day" : undefined} trailing={<span className="ios-num" style={{ color: syncsLast7d <= 7 ? "var(--ios-orange)" : undefined }}>{syncsLast7d}</span>} />
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

      <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "2px 16px 0", lineHeight: 1.5 }}>
        {hasData
          ? "Data arrives when the Health Auto Export app runs its automation. Apple lets it run only while the phone is unlocked and only when iOS grants it background time, so on its own it is irregular; the schedule below makes it predictable."
          : "Install Health Auto Export on your iPhone and point it at your personal URL above."}
      </p>

      {hasData && (
        <div className="ios-list" style={{ margin: "8px 0 0", padding: "12px 16px" }}>
          <div className="ios-subhead" style={{ fontWeight: 600, marginBottom: 6 }}>Make it run on a schedule</div>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: "0 0 8px", lineHeight: 1.5 }}>
            iOS will not run an app at a set time, but it will run a Shortcut at one. Once, on the iPhone:
          </p>
          <ol className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "0 0 0 18px", margin: 0, lineHeight: 1.7 }}>
            <li>In Health Auto Export: Settings → Automation → open your REST automation. Set <b style={{ fontWeight: 600 }}>Date Range: Since Last Sync</b>, <b style={{ fontWeight: 600 }}>Batch Requests: ON</b>. Under Sync Cadence, pick the shortest interval offered.</li>
            <li>Shortcuts app → Shortcuts tab → <b style={{ fontWeight: 600 }}>+</b> → search &ldquo;Auto Export&rdquo; → add <b style={{ fontWeight: 600 }}>Run Automation</b> → choose that automation → name it <i>Sync Watch</i>.</li>
            <li>Shortcuts → Automation tab → <b style={{ fontWeight: 600 }}>+</b> → <b style={{ fontWeight: 600 }}>Time of Day</b> → a time the phone is normally unlocked (say 7:30 am) → Daily → <b style={{ fontWeight: 600 }}>Run Immediately</b> → add the action <b style={{ fontWeight: 600 }}>Run Shortcut</b> → <i>Sync Watch</i>.</li>
            <li>Repeat step 3 for noon, 5 pm and 9 pm. Four scheduled runs a day is what &ldquo;near real time&rdquo; can mean without a native app.</li>
            <li>iPhone Settings → General → Background App Refresh: on for Health Auto Export. Don&rsquo;t swipe the app closed. Add its Automations widget to a Home Screen page; the app says this helps its own background runs.</li>
          </ol>
          <p className="ios-footnote" style={{ color: "var(--ios-label-3)", margin: "8px 0 0", lineHeight: 1.5 }}>
            A run at a scheduled time while the phone is locked fails, because Apple blocks Health access on a locked phone. That is the one limit no setting removes. True real time — the watch pushing each workout as it ends — needs a small native app using HealthKit background delivery, which is a separate build.
          </p>
        </div>
      )}

      {!hasData && (
        <ol className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "0 16px 0 34px", margin: 0, lineHeight: 1.7 }}>
          <li>Install <b style={{ fontWeight: 600 }}>Health Auto Export</b> from the App Store.</li>
          <li>Open the app → <b style={{ fontWeight: 600 }}>Settings → Automation</b>.</li>
          <li>Set <b style={{ fontWeight: 600 }}>Export Format: JSON</b>, <b style={{ fontWeight: 600 }}>Export Type: Apple Health</b>.</li>
          <li>Add the webhook URL above as the endpoint.</li>
          <li>Add a request <b style={{ fontWeight: 600 }}>Header</b>: name <code>api-key</code>, value = your export secret{apiKey ? " (shown above)" : ""}. Without it the server returns <b style={{ fontWeight: 600 }}>401</b>.</li>
          <li>Turn <b style={{ fontWeight: 600 }}>Batch Requests ON</b> and set <b style={{ fontWeight: 600 }}>Time Grouping</b> to <b style={{ fontWeight: 600 }}>1 hour</b> — otherwise a single day of Apple Watch data can exceed the server limit (<b style={{ fontWeight: 600 }}>413</b>).</li>
          <li>Tap <b style={{ fontWeight: 600 }}>Export Now</b> to sync immediately.</li>
        </ol>
      )}

      <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "8px 16px 0" }}>
        Seeing a <b style={{ fontWeight: 600 }}>413 (payload too large)</b>? In Health Auto Export turn <b style={{ fontWeight: 600 }}>Batch Requests ON</b> (splits the export into smaller requests) and set <b style={{ fontWeight: 600 }}>Time Grouping</b> to <b style={{ fontWeight: 600 }}>1 hour</b> or coarser (raw heart-rate samples are what blow past the limit). Keep <b style={{ fontWeight: 600 }}>Summarize Data</b> on and Date Range at <b style={{ fontWeight: 600 }}>Since Last Sync</b>, so each run sends only what is new.
      </p>
    </div>
  );
}
