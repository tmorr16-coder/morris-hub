"use client";

import { useState, useTransition } from "react";
import { syncAll } from "../actions";

export default function SyncNowButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function handleClick() {
    setMsg(null);
    startTransition(async () => {
      const r = await syncAll();
      if (r.ok) setMsg(r.synced ? `+${r.synced}` : "up to date");
      else setMsg(r.error ?? "failed");
      setTimeout(() => setMsg(null), 3000);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        border: "1px solid var(--color-rule)",
        background: "var(--color-paper-card)",
        color: "var(--color-ink-2)",
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: pending ? "wait" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ display: "inline-block", transform: pending ? "rotate(360deg)" : "none", transition: "transform 0.6s" }}>↻</span>
      {pending ? "Syncing…" : msg ?? "Sync now"}
    </button>
  );
}
