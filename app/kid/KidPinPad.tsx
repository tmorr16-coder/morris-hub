"use client";

// The keypad a six-year-old types a secret number into.
//
// Big round keys, four dots that fill as he types, no "submit" button: the
// fourth digit tries it. A wrong number shakes the dots and clears them. After
// a few wrong tries the keypad rests for a minute, then longer, and says to
// find a grown-up, because by then it probably is not him guessing.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlockKidScreen } from "./actions";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

function wait(seconds: number): string {
  if (seconds >= 120) return `${Math.ceil(seconds / 60)} minutes`;
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

export default function KidPinPad({ first, lockedSeconds }: { first: string; lockedSeconds: number }) {
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [restUntil, setRestUntil] = useState<number | null>(() => (lockedSeconds > 0 ? Date.now() + lockedSeconds * 1000 : null));
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();

  const resting = restUntil !== null && restUntil > now;
  const left = resting ? Math.ceil((restUntil! - now) / 1000) : 0;

  useEffect(() => {
    if (restUntil === null) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= restUntil) { setRestUntil(null); setMessage(null); }
    }, 1000);
    return () => clearInterval(t);
  }, [restUntil]);

  function press(key: string) {
    if (pending || resting) return;
    if (key === "⌫") { setDigits((d) => d.slice(0, -1)); return; }
    if (!key || digits.length >= 4) return;
    const next = digits + key;
    setDigits(next);
    setMessage(null);
    if (next.length < 4) return;
    start(async () => {
      const r = await unlockKidScreen(next);
      if (r.ok) { router.refresh(); return; }
      setDigits("");
      if (r.error) { setMessage(r.error); return; }
      setShake(true);
      setTimeout(() => setShake(false), 450);
      if (r.lockedSeconds) {
        setRestUntil(Date.now() + r.lockedSeconds * 1000);
        setNow(Date.now());
        setMessage("Let's take a little break. If you forgot your number, ask a grown-up.");
      } else {
        setMessage("Not quite. Try again!");
      }
    });
  }

  // A real keyboard works too, for a grown-up testing it on a laptop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("⌫");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, padding: "32px max(16px, env(safe-area-inset-left, 0px))", background: "var(--ios-bg)", color: "var(--ios-label)" }}>
      <style>{`@keyframes kidShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-14px)}40%{transform:translateX(14px)}60%{transform:translateX(-9px)}80%{transform:translateX(9px)}}
        .kid-key:active{transform:scale(.94)} @media (prefers-reduced-motion: reduce){.kid-shake{animation:none!important}}`}</style>
      <div style={{ fontSize: 72, lineHeight: 1 }} aria-hidden>🦉</div>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>Hi {first}!</h1>
        <p style={{ fontSize: 22, margin: "8px 0 0", color: "var(--ios-label-2)" }}>Type your secret number</p>
      </div>

      <div className={shake ? "kid-shake" : undefined} aria-label={`${digits.length} of 4 digits entered`} role="status"
        style={{ display: "flex", gap: 20, animation: shake ? "kidShake .45s ease" : undefined }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ width: 26, height: 26, borderRadius: "50%", border: "3px solid var(--ios-tint)", background: i < digits.length ? "var(--ios-tint)" : "transparent", transition: "background .12s" }} />
        ))}
      </div>

      <p aria-live="polite" style={{ minHeight: 56, margin: 0, fontSize: 19, textAlign: "center", maxWidth: 360, color: resting ? "var(--ios-orange)" : "var(--ios-label-2)" }}>
        {message}{resting ? ` Try again in ${wait(left)}.` : ""}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 88px)", gap: 18, opacity: resting ? 0.35 : 1 }}>
        {KEYS.map((k, i) => k === "" ? <span key={i} /> : (
          <button key={i} type="button" className="kid-key" onClick={() => press(k)} disabled={resting || pending}
            aria-label={k === "⌫" ? "Delete" : k}
            style={{ width: 88, height: 88, borderRadius: "50%", border: "none", fontSize: k === "⌫" ? 30 : 38, fontWeight: 700,
              background: k === "⌫" ? "transparent" : "var(--ios-fill)", color: "var(--ios-label)", cursor: "pointer", transition: "transform .08s",
              touchAction: "manipulation" }}>
            {k}
          </button>
        ))}
      </div>
    </main>
  );
}
