"use client";

import { useState } from "react";
import { Cell, IconBadge } from "@/components/ios";

interface Props {
  configured: boolean;
  lastSyncAt: string | null;
  metricsCount: number;
  workoutsCount: number;
  webhookUrl: string;
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

export default function AppleHealthCard({ configured, lastSyncAt, metricsCount, workoutsCount, webhookUrl }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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

        {/* Webhook URL */}
        <div className="ios-cell">
          <span className="ios-cell-body">
            <span className="ios-cell-sub" style={{ marginTop: 0 }}>Personal webhook URL</span>
            <span className="ios-num ios-truncate" style={{ fontSize: 13, color: "var(--ios-label)" }}>{webhookUrl}</span>
          </span>
          <span className="ios-cell-trail">
            <button onClick={handleCopy} style={{ color: "var(--ios-tint)", fontSize: 15, fontWeight: copied ? 600 : 400 }}>
              {copied ? "Copied" : "Copy"}
            </button>
          </span>
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
          <li>Tap <b style={{ fontWeight: 600 }}>Export Now</b> to sync immediately.</li>
        </ol>
      )}
    </div>
  );
}
