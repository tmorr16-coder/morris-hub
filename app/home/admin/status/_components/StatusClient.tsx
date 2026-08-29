"use client";

import { useState } from "react";

export interface BrokenConnection {
  id: string;
  institution: string;
  userId: string | null;
  status: string;
  lastSyncedAt: string | null;
  lastErrorAt: string | null;
  rawError: string | null;
  headline: string;
  detail: string;
  canReconnect: boolean;
  /** failed = a recorded error · stale = stopped updating · never = not yet pulled */
  kind: "failed" | "stale" | "never";
}

export interface EventGroup {
  key: string;
  source: string;
  subject: string | null;
  severity: string;
  message: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "unknown";
  const mins = Math.floor(ms / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** How long this has been going on — the number that decides urgency. */
function span(firstSeen: string, lastSeen: string): string {
  const ms = new Date(lastSeen).getTime() - new Date(firstSeen).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `failing for ${days} day${days === 1 ? "" : "s"}`;
  const hrs = Math.floor(ms / 3_600_000);
  if (hrs >= 1) return `failing for ${hrs}h`;
  return "started recently";
}

const SOURCE_LABEL: Record<string, string> = {
  simplefin: "Bank sync",
  oura: "Oura",
  withings: "Withings",
  "apple-health": "Apple Health",
  cron: "Scheduled job",
  openrouter: "AI models",
};

const card: React.CSSProperties = {
  background: "var(--ios-cell)",
  borderRadius: "var(--ios-radius-card)",
  padding: 14,
  marginBottom: 10,
};

export default function StatusClient({
  connections,
  events,
  names,
  logMissing,
  totalConnections,
}: {
  connections: BrokenConnection[];
  events: EventGroup[];
  names: Record<string, string>;
  logMissing: boolean;
  totalConnections: number;
}) {
  const [showRaw, setShowRaw] = useState<Record<string, boolean>>({});
  const nothingWrong = connections.length === 0 && events.length === 0 && !logMissing;

  return (
    <div>
      {logMissing && (
        <div style={{ ...card, border: "1.5px solid var(--ios-orange, #D9772B)" }}>
          <div className="ios-subhead" style={{ fontWeight: 700, marginBottom: 4 }}>
            The failure log isn&rsquo;t there yet
          </div>
          <div className="ios-caption" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            <code>hub.system_events</code> could not be read, so only live connection state is shown
            below. Apply <code>20260829_system_events.sql</code> to start collecting Oura, Withings
            and scheduled-job failures — those currently exist only in the server console.
          </div>
        </div>
      )}

      {nothingWrong && (
        <div style={{ ...card, textAlign: "center", padding: 28 }}>
          <div style={{ fontSize: 34, marginBottom: 6, color: "var(--ios-green)" }}>✓</div>
          <div className="ios-headline" style={{ marginBottom: 3 }}>Nothing is failing</div>
          <div className="ios-caption" style={{ color: "var(--ios-label-2)" }}>
            {totalConnections} connection{totalConnections === 1 ? "" : "s"} syncing, no open failures.
          </div>
        </div>
      )}

      {/* ── Live state ─────────────────────────────────────────────────────── */}
      {connections.length > 0 && (
        <>
          <div className="ios-group-header" style={{ padding: "6px 0 7px" }}>
            NEEDS A LOOK · {connections.length} of {totalConnections}
          </div>
          {connections.map((c) => (
            <div key={c.id} style={{ ...card, border: `1.5px solid ${c.kind === "failed" ? "var(--ios-red)" : c.kind === "stale" ? "var(--ios-orange, #D9772B)" : "var(--ios-separator)"}` }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span className="ios-headline" style={{ fontSize: 15 }}>{c.institution}</span>
                <span className="ios-caption" style={{ color: "var(--ios-label-3)", flexShrink: 0 }}>
                  {c.kind === "never" ? "not pulled yet" : `last ok ${ago(c.lastSyncedAt)}`}
                </span>
              </div>
              {c.userId && names[c.userId] && (
                <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 1 }}>{names[c.userId]}</div>
              )}
              <div className="ios-subhead" style={{ color: c.kind === "failed" ? "var(--ios-red)" : c.kind === "stale" ? "var(--ios-orange, #D9772B)" : "var(--ios-label-2)", fontWeight: 600, marginTop: 6 }}>
                {c.headline}
              </div>
              <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 3, lineHeight: 1.5 }}>
                {c.detail}
              </div>
              {c.canReconnect && (
                <a
                  href="/finance/dashboard/settings"
                  className="ios-caption"
                  style={{ display: "inline-block", marginTop: 8, color: "var(--ios-tint)", fontWeight: 700, textDecoration: "none" }}
                >
                  Disconnect &amp; reconnect →
                </a>
              )}
              {c.rawError && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => setShowRaw((r) => ({ ...r, [c.id]: !r[c.id] }))}
                    className="ios-caption"
                    style={{ background: "none", border: "none", color: "var(--ios-label-3)", cursor: "pointer", padding: 0 }}
                  >
                    {showRaw[c.id] ? "Hide" : "Show"} technical detail
                  </button>
                  {showRaw[c.id] && (
                    <code style={{ display: "block", marginTop: 5, fontSize: 12, color: "var(--ios-label-2)", wordBreak: "break-word" }}>
                      {c.rawError}
                    </code>
                  )}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* ── The log ────────────────────────────────────────────────────────── */}
      {events.length > 0 && (
        <>
          <div className="ios-group-header" style={{ padding: "16px 0 7px" }}>
            OPEN FAILURES · {events.length}
          </div>
          {events.map((e) => (
            <div key={e.key} style={card}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span className="ios-headline" style={{ fontSize: 15 }}>
                  {SOURCE_LABEL[e.source] ?? e.source}
                </span>
                <span className="ios-caption" style={{ color: "var(--ios-label-3)", flexShrink: 0 }}>
                  {ago(e.lastSeen)}
                </span>
              </div>
              {e.subject && names[e.subject] && (
                <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 1 }}>{names[e.subject]}</div>
              )}
              <div className="ios-subhead" style={{ color: "var(--ios-label)", marginTop: 5, lineHeight: 1.45 }}>
                {e.message}
              </div>
              <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>
                {/* One problem, not N problems: a nightly cron failing for a
                    month is a single thing to fix, and the run length is what
                    tells you how long it has been ignored. */}
                {e.count} occurrence{e.count === 1 ? "" : "s"} · {span(e.firstSeen, e.lastSeen)}
              </div>
            </div>
          ))}
        </>
      )}

      <div className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "14px 4px 0", lineHeight: 1.5 }}>
        Failures are recorded when a sync fails and closed when it next succeeds, so anything listed
        here is still broken now rather than merely broken once. Messages come from the app&rsquo;s own
        error paths and never contain credentials.
      </div>
    </div>
  );
}
