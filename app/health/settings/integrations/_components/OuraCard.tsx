"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Cell, IconBadge } from "@/components/ios";
import { triggerOuraSync, saveOuraToken, disconnectOura } from "../actions";

interface Props {
  tokenConfigured: boolean;
  lastSyncAt: string | null;
}

function relativeTime(isoTs: string): string {
  const mins = Math.floor((new Date().getTime() - new Date(isoTs).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const RingGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="13.5" r="6" />
    <path d="M9.5 7l.7-3h3.6l.7 3" />
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

export default function OuraCard({ tokenConfigured, lastSyncAt }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Auto-sync if data is stale (>24h since last sync)
  useEffect(() => {
    if (!tokenConfigured || !lastSyncAt) return;
    const staleMs = new Date().getTime() - new Date(lastSyncAt).getTime();
    if (staleMs > 24 * 60 * 60 * 1000) {
      handleSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenConfigured, lastSyncAt]);

  function handleSync() {
    setSyncMsg(null);
    setSyncErr(null);
    startTransition(async () => {
      const result = await triggerOuraSync();
      if (result.error) {
        setSyncErr(result.error);
      } else {
        setSyncMsg(`Synced — ${result.inserted} metric${result.inserted === 1 ? "" : "s"} added`);
        router.refresh();
      }
    });
  }

  function handleSave() {
    if (!tokenInput.trim()) return;
    setSaveErr(null);
    startTransition(async () => {
      const result = await saveOuraToken(tokenInput);
      if (result.error) setSaveErr(result.error);
      else { setTokenInput(""); router.refresh(); }
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectOura();
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="ios-list" style={{ margin: 0 }}>
        <Cell
          chevron={false}
          lead={<IconBadge color="#5E5CE6"><RingGlyph /></IconBadge>}
          title="Oura Ring"
          subtitle="Sleep · readiness · activity · HRV"
          trailing={<StatusPill on={tokenConfigured} />}
        />

        {tokenConfigured ? (
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
        ) : (
          <div className="ios-cell">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Personal access token"
              style={{ width: "100%", border: "none", background: "transparent", color: "var(--ios-label)", fontSize: 17, outline: "none", padding: 0 }}
            />
          </div>
        )}
      </div>

      {tokenConfigured ? (
        <>
          {syncMsg && <p className="ios-footnote" style={{ color: "var(--ios-green)", padding: "2px 16px 0" }}>{syncMsg}</p>}
          {syncErr && <p className="ios-footnote" style={{ color: "var(--ios-red)", padding: "2px 16px 0" }}>{syncErr}</p>}
          {!syncMsg && !syncErr && (
            <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "2px 16px 0" }}>
              Data syncs automatically each day. Tap Sync now to pull the latest.
            </p>
          )}
        </>
      ) : (
        <>
          <button
            className="ios-btn ios-btn--primary"
            onClick={handleSave}
            disabled={isPending || !tokenInput.trim()}
            style={{ margin: "0 16px", width: "calc(100% - 32px)", opacity: tokenInput.trim() && !isPending ? 1 : 0.5 }}
          >
            {isPending ? "Connecting…" : "Connect Oura Ring"}
          </button>
          {saveErr && <p className="ios-footnote" style={{ color: "var(--ios-red)", padding: "2px 16px 0" }}>{saveErr}</p>}
          <ol className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "2px 16px 0 34px", margin: 0, lineHeight: 1.7 }}>
            <li>Sign in at <b style={{ fontWeight: 600 }}>cloud.ouraring.com</b>.</li>
            <li>Go to <b style={{ fontWeight: 600 }}>Account → Personal Access Tokens</b> → Create new token.</li>
            <li>Copy the token and paste it above.</li>
          </ol>
        </>
      )}
    </div>
  );
}
