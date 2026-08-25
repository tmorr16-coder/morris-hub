"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cell, IconBadge } from "@/components/ios";

const BankGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 10l9-5 9 5" />
    <path d="M5 10v8" />
    <path d="M19 10v8" />
    <path d="M9 10v8" />
    <path d="M15 10v8" />
    <path d="M3 21h18" />
  </svg>
);

export default function SimpleFinConnect({ label }: { label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [token, setToken] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function handleConnect() {
    if (!token.trim()) return;
    setErr(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/finance/simplefin/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setupToken: token.trim() }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          // Prefer the specific reason — a reused token, a bad paste, SimpleFIN
          // being down — over the generic headline, which told nobody anything.
          setErr(data.reason ?? data.error ?? "Failed to connect");
          return;
        }
        setToken("");
        if (data.redirectTo) router.push(data.redirectTo);
        router.refresh();
      } catch {
        setErr("Failed to connect. Please try again.");
      }
    });
  }

  const canConnect = token.trim() && !isPending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="ios-list" style={{ margin: 0 }}>
        <Cell
          chevron={false}
          lead={<IconBadge color="var(--ios-finance, var(--ios-green))"><BankGlyph /></IconBadge>}
          title="SimpleFIN"
          subtitle="Balances · transactions · automatic sync"
        />
        <div className="ios-cell">
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your SimpleFIN setup token"
            rows={2}
            spellCheck={false}
            autoComplete="off"
            style={{
              width: "100%", border: "none", background: "transparent",
              color: "var(--ios-label)", fontSize: 17, outline: "none", padding: 0,
              resize: "none", fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      <button
        className="ios-btn ios-btn--primary"
        onClick={handleConnect}
        disabled={!canConnect}
        style={{ margin: "0 16px", width: "calc(100% - 32px)", opacity: canConnect ? 1 : 0.5 }}
      >
        {isPending ? "Connecting…" : label ?? "Connect with SimpleFIN"}
      </button>
      {err && <p className="ios-footnote" style={{ color: "var(--ios-red)", padding: "2px 16px 0" }}>{err}</p>}
      <ol className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "2px 16px 0 34px", margin: 0, lineHeight: 1.7 }}>
        <li>Sign in at <b style={{ fontWeight: 600 }}>bridge.simplefin.org</b> and create a <b style={{ fontWeight: 600 }}>New App</b> to get a <b style={{ fontWeight: 600 }}>Setup Token</b>.</li>
        <li>Paste the setup token above.</li>
        <li>Tap Connect — your accounts and transactions will sync automatically.</li>
      </ol>

      {/* Adding more banks happens in the SimpleFIN Bridge; new accounts flow in on the next sync. */}
      <a
        href="https://bridge.simplefin.org"
        target="_blank"
        rel="noopener noreferrer"
        className="ios-btn"
        style={{ margin: "8px 16px 0", width: "calc(100% - 32px)", background: "var(--ios-fill)", color: "var(--ios-tint)", textAlign: "center", textDecoration: "none", fontWeight: 600 }}
      >
        Add / manage banks at SimpleFIN ↗
      </a>
      <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "6px 16px 0", lineHeight: 1.5 }}>
        Already connected? Add or remove banks in the SimpleFIN Bridge — new accounts appear here automatically the next time you tap <b style={{ fontWeight: 600 }}>Sync</b> (no new token needed).
      </p>
    </div>
  );
}
