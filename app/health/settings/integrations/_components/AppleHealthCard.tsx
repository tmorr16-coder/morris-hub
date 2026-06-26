"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  configured: boolean;
  lastSyncAt: string | null;
  metricsCount: number;
  workoutsCount: number;
  webhookUrl: string;
}

function relativeTime(isoTs: string): string {
  const mins = Math.floor((Date.now() - new Date(isoTs).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AppleHealthCard({ configured, lastSyncAt, metricsCount, workoutsCount, webhookUrl }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const hasData = metricsCount > 0 || workoutsCount > 0;

  return (
    <div style={{ background: "var(--color-bg-raised)", border: `1.5px solid ${hasData ? "var(--color-moss)" : "var(--color-line)"}`, borderRadius: 14, overflow: "hidden" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: hasData ? "var(--color-moss-soft)" : undefined, borderBottom: "1px solid var(--color-line)" }}>
        <div style={{ fontSize: 26, lineHeight: 1 }}>⌚</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)" }}>Apple Watch</div>
          <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 1 }}>Steps · workouts · heart rate · HRV · activity</div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          padding: "5px 12px", borderRadius: 999, whiteSpace: "nowrap",
          background: hasData ? "var(--color-moss)" : "var(--color-bg-sunk)",
          color: hasData ? "#fff" : "var(--color-ink-4)",
          border: `1px solid ${hasData ? "var(--color-moss)" : "var(--color-line)"}`,
        }}>
          {hasData ? "✓ Active" : "Not connected"}
        </div>
      </div>

      {/* Stats — prominent when data exists */}
      {hasData && (
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--color-line)", background: "var(--color-bg)" }}>
          {[
            { label: "Metrics synced",  value: metricsCount.toLocaleString(), mono: true },
            { label: "Workouts", value: workoutsCount.toLocaleString(), mono: true },
            { label: "Last sync", value: lastSyncAt ? relativeTime(lastSyncAt) : "Never", mono: false },
          ].map(({ label, value, mono }, i, arr) => (
            <div key={label} style={{ flex: 1, padding: "14px 14px", borderRight: i < arr.length - 1 ? "1px solid var(--color-line)" : undefined }}>
              <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 4 }}>
                {label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-moss)", fontFamily: mono ? "var(--font-mono)" : "inherit" }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View in dashboard link when active */}
      {hasData && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-line)", background: "var(--color-bg)" }}>
          <Link
            href="/health/progress"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 600, color: "var(--color-moss)",
              textDecoration: "none",
            }}
          >
            View health trends →
          </Link>
        </div>
      )}

      {/* Setup / webhook */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.6 }}>
          {hasData
            ? "Data syncs automatically via the Health Auto Export app. Your Apple Watch sends metrics as they arrive."
            : "Install Health Auto Export on your iPhone and point it at your personal URL below."}
        </div>

        {!hasData && (
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 2 }}>
            <li>Install <span style={{ color: "var(--color-ink-2)", fontWeight: 500 }}>Health Auto Export</span> from the App Store.</li>
            <li>Open the app → Automations → REST API → add a new endpoint.</li>
            <li>Paste your personal URL below as the endpoint URL.</li>
            <li>Set the <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>api-key</span> header to the shared secret (from your admin).</li>
          </ol>
        )}

        <div>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 5 }}>
            Your personal webhook URL
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <div style={{
              flex: 1, fontFamily: "var(--font-mono)", fontSize: 10,
              color: "var(--color-ink-2)", background: "var(--color-bg-sunk)",
              borderRadius: 8, padding: "10px 12px", wordBreak: "break-all", lineHeight: 1.5,
              border: "1px solid var(--color-line)",
            }}>
              {webhookUrl}
            </div>
            <button onClick={handleCopy} style={{
              padding: "0 14px", borderRadius: 8, border: "1px solid var(--color-line)",
              background: copied ? "var(--color-moss-soft)" : "var(--color-bg-sunk)",
              color: copied ? "var(--color-moss)" : "var(--color-ink-3)",
              fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              whiteSpace: "nowrap", flexShrink: 0, transition: "all 150ms",
            }}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
