"use client";

// 4-digit PIN gate for the finance dashboard.
// PIN is stored in the user's hub.preferences row (plain text — this is
// a UX barrier, not a security boundary; the data is already behind auth).
// Once entered correctly, the session is unlocked for 15 minutes via
// sessionStorage so reloads don't ask again mid-session.

import { useState, useRef, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

const SESSION_KEY = "finance_pin_unlocked_until";
const TIMEOUT_MS = 15 * 60 * 1000; // 15 min

const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

function makeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    COOKIE_DOMAIN
      ? { cookieOptions: { domain: COOKIE_DOMAIN, path: "/", sameSite: "lax" } }
      : undefined
  );
}

function isUnlocked(): boolean {
  try {
    const val = sessionStorage.getItem(SESSION_KEY);
    if (!val) return false;
    return Date.now() < parseInt(val, 10);
  } catch { return false; }
}

function setUnlocked() {
  try {
    sessionStorage.setItem(SESSION_KEY, String(Date.now() + TIMEOUT_MS));
  } catch { /* sessionStorage unavailable */ }
}

export default function PinGate({
  children,
  enabled,
  correctPin,
}: {
  children: React.ReactNode;
  enabled: boolean;
  correctPin: string;
}) {
  const [unlocked, setUnlockedState] = useState(() =>
    !enabled || isUnlocked()
  );
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (!unlocked && enabled) {
      inputRefs[0].current?.focus();
    }
  }, [unlocked, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDigit(idx: number, val: string) {
    const digit = val.replace(/\D/, "").slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    setError(false);

    if (digit && idx < 3) {
      inputRefs[idx + 1].current?.focus();
    }

    if (next.every((d) => d !== "")) {
      const entered = next.join("");
      if (entered === correctPin) {
        setUnlocked();
        setUnlockedState(true);
      } else {
        setShaking(true);
        setTimeout(() => {
          setShaking(false);
          setDigits(["", "", "", ""]);
          setError(true);
          inputRefs[0].current?.focus();
        }, 600);
      }
    }
  }

  function handleKey(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputRefs[idx - 1].current?.focus();
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-paper)",
        fontFamily: "var(--font-sans)",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <h1 className="serif" style={{ fontSize: 28, marginBottom: 4 }}>Finance</h1>
        <p style={{ fontSize: 13, color: "var(--color-ink-3)" }}>Enter your PIN to continue</p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          animation: shaking ? "shake 0.5s" : undefined,
        }}
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={inputRefs[i]}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleDigit(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            style={{
              width: 52,
              height: 64,
              textAlign: "center",
              fontSize: 28,
              fontFamily: "var(--font-mono)",
              border: `2px solid ${error ? "var(--color-red)" : "var(--color-rule)"}`,
              borderRadius: 12,
              background: "var(--color-paper-card)",
              color: "var(--color-ink)",
              outline: "none",
              transition: "border-color 150ms",
            }}
          />
        ))}
      </div>

      {error && (
        <p style={{ fontSize: 12, color: "var(--color-red)", marginTop: 16 }}>
          Incorrect PIN — try again
        </p>
      )}

      <p style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 32 }}>
        Session stays unlocked for 15 minutes
      </p>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
