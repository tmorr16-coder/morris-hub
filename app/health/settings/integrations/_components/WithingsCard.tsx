"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Cell, IconBadge } from "@/components/ios";
import { disconnectWithings, triggerSync } from "../actions";

interface Props {
  connected: boolean;
  connectedAt: string | null;
  lastSyncAt: string | null;
  successMessage: string | null;
}

function relativeTime(isoTs: string): string {
  const mins = Math.floor((new Date().getTime() - new Date(isoTs).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ScaleGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="4.5" />
    <path d="M12 8.5v3.5M12 8.5a2 2 0 0 1 1.8 1.1" />
  </svg>
);

function StatusPill({ on }: { on: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, color: on ? "var(--ios-green)" : "var(--ios-label-2)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "var(--ios-green)" : "var(--ios-label-3)" }} />
      {on ? "Connected" : "Not connected"}
    </span>
  );
}

export default function WithingsCard({ connected, connectedAt, lastSyncAt, successMessage }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);

  function handleSync() {
    setSyncMsg(null);
    setSyncErr(null);
    startTransition(async () => {
      const result = await triggerSync();
      if (result.error) {
        setSyncErr(result.error);
      } else {
        setSyncMsg(`Synced — ${result.inserted} measurement${result.inserted === 1 ? "" : "s"} added`);
        router.refresh();
      }
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectWithings();
      if (result.error) setSyncErr(result.error);
      else router.refresh();
    });
  }

  // suppress unused warning — connectedAt available if needed for future display
  void connectedAt;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="ios-list" style={{ margin: 0 }}>
        <Cell
          chevron={false}
          lead={<IconBadge color="#0A84C7"><ScaleGlyph /></IconBadge>}
          title="Withings"
          subtitle="Weight · body composition · blood pressure"
          trailing={<StatusPill on={connected} />}
        />

        {connected && (
          <>
            {lastSyncAt && (
              <Cell chevron={false} title="Last synced" trailing={<span className="ios-num">{relativeTime(lastSyncAt)}</span>} />
            )}
            <Cell
              chevron={false}
              onClick={handleSync}
              title={<span style={{ color: "var(--ios-tint)" }}>{isPending ? "Syncing…" : "Sync now"}</span>}
            />
            <Cell
              chevron={false}
              onClick={handleDisconnect}
              title={<span style={{ color: "var(--ios-red)" }}>Disconnect</span>}
            />
          </>
        )}
      </div>

      {connected ? (
        <>
          {(successMessage || syncMsg) && <p className="ios-footnote" style={{ color: "var(--ios-green)", padding: "2px 16px 0" }}>{successMessage ?? syncMsg}</p>}
          {syncErr && <p className="ios-footnote" style={{ color: "var(--ios-red)", padding: "2px 16px 0" }}>{syncErr}</p>}
          {!successMessage && !syncMsg && !syncErr && (
            <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "2px 16px 0" }}>
              Data syncs automatically. Tap Sync now to pull the latest measurements.
            </p>
          )}
        </>
      ) : (
        <>
          <a
            href="/api/health/withings/connect"
            className="ios-btn ios-btn--primary"
            style={{ margin: "0 16px", width: "calc(100% - 32px)", opacity: isPending ? 0.5 : 1 }}
          >
            Connect Withings
          </a>
          <ol className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "2px 16px 0 34px", margin: 0, lineHeight: 1.7 }}>
            <li>Download <b style={{ fontWeight: 600 }}>Health Mate</b> from the App Store and create a Withings account.</li>
            <li>Follow the in-app instructions to pair your Withings device.</li>
            <li>Tap <b style={{ fontWeight: 600 }}>Connect Withings</b> above to authorize access.</li>
          </ol>
        </>
      )}
    </div>
  );
}
