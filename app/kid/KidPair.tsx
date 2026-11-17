"use client";

// Setting up the child's iPad. This screen is for the grown-up, once.
//
// The code comes from the child's page on a parent's phone (Children → the
// child → iPad → "Set up an iPad"). Entering it here gives this iPad its own
// key; the child's PIN does the rest from then on.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pairThisDevice } from "./actions";

export default function KidPair({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // The button is never greyed out: a disabled button with no reason read
    // as broken. Tapping it without a code says where the code comes from.
    if (code.replace(/[^A-Za-z0-9]/g, "").length < 8) {
      setError("First make a code on your phone: open your child's page, tap their iPad section, then “Set up an iPad”. Type the 8-character code here.");
      return;
    }
    start(async () => {
      const r = await pairThisDevice(code);
      if (r.ok) { router.replace("/kid"); router.refresh(); return; }
      setError(r.error ?? "That didn't work. Try again.");
    });
  }

  return (
    <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px max(16px, env(safe-area-inset-left, 0px))", background: "var(--ios-bg)", color: "var(--ios-label)" }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 420, display: "grid", gap: 16 }}>
        <div style={{ fontSize: 56, lineHeight: 1 }} aria-hidden>🦉</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Set up this iPad</h1>
        <p style={{ margin: 0, fontSize: 16, color: "var(--ios-label-2)", lineHeight: 1.45 }}>
          For a grown-up. On your phone, open your child&rsquo;s page in Morris, tap <strong>iPad</strong>, then <strong>Set up an iPad</strong>. Type the code it shows here.
        </p>
        <label htmlFor="pair-code" style={{ fontSize: 14, fontWeight: 600, color: "var(--ios-label-2)" }}>Setup code</label>
        <input
          id="pair-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD-2345"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          maxLength={9}
          style={{ fontSize: 30, letterSpacing: "0.12em", textAlign: "center", padding: "14px 12px", borderRadius: 14, border: "1px solid var(--ios-separator)", background: "var(--ios-cell)", color: "var(--ios-label)", fontFamily: "ui-monospace, Menlo, monospace" }}
        />
        {error && <p role="alert" style={{ margin: 0, color: "var(--ios-red)", fontSize: 15 }}>{error}</p>}
        <button type="submit" className="ios-btn ios-btn--primary" disabled={pending}>
          {pending ? "Setting up…" : "Set up this iPad"}
        </button>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ios-label-3)", lineHeight: 1.45 }}>
          After this, add this page to the Home Screen: tap Share, then <strong>Add to Home Screen</strong>. Your child opens it and types their 4-digit number. No account sign-in happens on this iPad.
        </p>
      </form>
    </main>
  );
}
