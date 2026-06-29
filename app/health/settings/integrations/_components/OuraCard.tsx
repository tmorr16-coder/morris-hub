"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { triggerOuraSync, saveOuraToken, disconnectOura } from "../actions";

interface Props {
  tokenConfigured: boolean;
  lastSyncAt: string | null;
}

function relativeTime(isoTs: string): string {
  const mins = Math.floor((Date.now() - new Date(isoTs).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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
    const staleMs = Date.now() - new Date(lastSyncAt).getTime();
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
    <div style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 14, overflow: "hidden" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--color-line)" }}>
        <div style={{ fontSize: 24, lineHeight: 1 }}>💍</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-ink)" }}>Oura Ring</div>
          <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 1 }}>Sleep · readiness · activity · HRV</div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
          padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap",
          background: tokenConfigured ? "var(--color-moss-soft)" : "var(--color-bg-sunk)",
          color: tokenConfigured ? "var(--color-moss)" : "var(--color-ink-4)",
          border: `1px solid ${tokenConfigured ? "var(--color-moss)" : "var(--color-line)"}`,
        }}>
          {tokenConfigured ? "Connected" : "Not connected"}
        </div>
      </div>

      {/* Stats — only when connected */}
      {tokenConfigured && lastSyncAt && (
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--color-line)" }}>
          <div style={{ flex: 1, padding: "12px 14px" }}>
            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 3 }}>
              Last sync
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)" }}>
              {relativeTime(lastSyncAt)}
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.6 }}>
          {tokenConfigured
            ? "Data syncs automatically each day. Tap Sync Now to pull the latest."
            : "Connect your Oura Ring using a Personal Access Token to sync sleep, readiness, and HRV data."}
        </div>

        {/* Setup steps */}
        {!tokenConfigured && (
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 2 }}>
            <li>Sign in at <span style={{ color: "var(--color-ink-2)", fontWeight: 500 }}>cloud.ouraring.com</span>.</li>
            <li>Go to <span style={{ color: "var(--color-ink-2)", fontWeight: 500 }}>Account → Personal Access Tokens</span> → Create new token.</li>
            <li>Copy the token and paste it below.</li>
          </ol>
        )}

        {/* Token input — not connected */}
        {!tokenConfigured && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 5 }}>
              Personal access token
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste token here…"
                style={{
                  flex: 1, padding: "10px 12px", borderRadius: 10,
                  border: "1px solid var(--color-line)", background: "var(--color-bg-sunk)",
                  color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit", outline: "none",
                }}
              />
              <button onClick={handleSave} disabled={isPending || !tokenInput.trim()} style={{
                padding: "10px 16px", borderRadius: 10, border: "none",
                background: tokenInput.trim() ? "var(--color-ink)" : "var(--color-bg-sunk)",
                color: tokenInput.trim() ? "var(--color-bg)" : "var(--color-ink-4)",
                fontSize: 13, fontWeight: 600, cursor: tokenInput.trim() ? "pointer" : "default", fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}>
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
            {saveErr && (
              <div style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-accent)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--color-accent)", marginTop: 8 }}>
                {saveErr}
              </div>
            )}
          </div>
        )}

        {/* Connected actions */}
        {tokenConfigured && (
          <>
            {syncMsg && (
              <div style={{ background: "var(--color-moss-soft)", border: "1px solid var(--color-moss)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--color-moss)" }}>
                ✓ {syncMsg}
              </div>
            )}
            {syncErr && (
              <div style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-accent)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--color-accent)" }}>
                {syncErr}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSync} disabled={isPending} style={{
                padding: "10px 18px", borderRadius: 10, border: "none",
                background: isPending ? "var(--color-bg-sunk)" : "var(--color-ink)",
                color: isPending ? "var(--color-ink-4)" : "var(--color-bg)",
                fontSize: 13, fontWeight: 600, cursor: isPending ? "wait" : "pointer", fontFamily: "inherit",
              }}>
                {isPending ? "Syncing…" : "Sync Now"}
              </button>
              <button onClick={handleDisconnect} disabled={isPending} style={{
                padding: "10px 14px", borderRadius: 10, border: "1px solid var(--color-line)",
                background: "transparent", color: "var(--color-ink-3)",
                fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}>
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
