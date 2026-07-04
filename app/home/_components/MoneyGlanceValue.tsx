"use client";

import { useState, useEffect } from "react";

// Same session key PinGate writes when the finance PIN is entered.
const SESSION_KEY = "finance_pin_unlocked_until";

function isUnlocked(): boolean {
  try {
    const val = sessionStorage.getItem(SESSION_KEY);
    return !!val && Date.now() < parseInt(val, 10);
  } catch {
    return false;
  }
}

/**
 * The Today money glance value. Shows the net-worth trend % when there's no
 * finance PIN, or when the PIN has been entered this session (unlock persists
 * ~15 min via sessionStorage). Otherwise shows a locked indicator.
 */
export default function MoneyGlanceValue({ pct, locked }: { pct: number | null; locked: boolean }) {
  // Start locked to match the server render (which can't see sessionStorage),
  // then reveal after mount if the session is unlocked — no hydration mismatch.
  const [revealed, setRevealed] = useState(!locked);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (locked) setRevealed(isUnlocked());
  }, [locked]);

  if (!revealed) return <>🔒 Locked</>;
  if (pct == null) return <>Tracking</>;
  return (
    <span style={{ color: pct >= 0 ? "var(--ios-green)" : "var(--ios-red)" }}>
      {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}
