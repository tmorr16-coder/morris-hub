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
        // Connected, but the first fetch was refused — say so instead of
        // dropping the user on a dashboard with an empty institution.
        if (data.warning) {
          setErr(`Connected, but couldn't fetch accounts yet. ${data.warning}`);
          router.refresh();
          return;
        }
        if (data.redirectTo) router.push(data.redirectTo);
        router.refresh();
      } catch {
        setErr("Failed to connect. Please try again.");
      }
    });
  }

  async function pasteToken() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setToken(text.trim());
    } catch {
      // Clipboard permission denied or unsupported — the textarea still works.
      setErr("Couldn't read the clipboard. Paste into the box instead.");
    }
  }

  /**
   * Does this even look like a setup token?
   *
   * A token is base64 that decodes to an https claim URL. Checking the shape
   * here catches a half-selected paste before it is spent — tokens are
   * single-use, so a bad attempt costs a trip back to SimpleFIN for a new one.
   */
  const tokenLooksValid = (() => {
    const t = token.trim();
    if (t.length < 20 || /\s/.test(t)) return false;
    try {
      return /^https:\/\//i.test(atob(t).trim());
    } catch {
      return false;
    }
  })();

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
          {/* A setup token is a long base64 string, and selecting a textarea
              precisely on a phone is the fiddliest part of the whole flow.
              One tap instead. */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={pasteToken}
              className="ios-caption"
              style={{ background: "var(--ios-fill)", border: "none", borderRadius: 8, color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "6px 12px" }}
            >
              Paste
            </button>
            {token.trim() && (
              <>
                <button
                  type="button"
                  onClick={() => setToken("")}
                  className="ios-caption"
                  style={{ background: "none", border: "none", color: "var(--ios-label-3)", cursor: "pointer", padding: "6px 2px" }}
                >
                  Clear
                </button>
                <span className="ios-caption" style={{ color: tokenLooksValid ? "var(--ios-green)" : "var(--ios-orange, #D9772B)", marginLeft: "auto" }}>
                  {tokenLooksValid ? "✓ Looks like a token" : "Doesn't look like a token yet"}
                </span>
              </>
            )}
          </div>
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
      {/* Step one is a trip to another site, so it gets a button rather than a
          domain name to memorise and retype. */}
      <a
        href="https://bridge.simplefin.org"
        target="_blank"
        rel="noopener noreferrer"
        className="ios-btn"
        style={{ margin: "8px 16px 0", width: "calc(100% - 32px)", background: "var(--ios-fill)", color: "var(--ios-tint)", textAlign: "center", textDecoration: "none", fontWeight: 600 }}
      >
        1 · Get a setup token at SimpleFIN ↗
      </a>
      <ol className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "8px 16px 0 34px", margin: 0, lineHeight: 1.7 }}>
        <li>Sign in and create a <b style={{ fontWeight: 600 }}>New App</b> — that gives you a <b style={{ fontWeight: 600 }}>Setup Token</b>. Copy it.</li>
        <li>Come back here and tap <b style={{ fontWeight: 600 }}>Paste</b>.</li>
        <li>Tap Connect. Balances and transactions sync from then on.</li>
      </ol>
      <p className="ios-footnote" style={{ color: "var(--ios-label-3)", padding: "6px 16px 0", lineHeight: 1.5 }}>
        A setup token can only be used once. If a connection fails, go back for a fresh one rather
        than retrying the same token.
      </p>
      <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "6px 16px 0", lineHeight: 1.5 }}>
        Already connected? Add or remove banks in the SimpleFIN Bridge — new accounts appear here automatically the next time you tap <b style={{ fontWeight: 600 }}>Sync</b> (no new token needed).
      </p>
    </div>
  );
}
