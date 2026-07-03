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
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="ios-btn ios-btn--plain"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: pending ? "wait" : "pointer",
      }}
    >
      <svg
        width={15}
        height={15}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{
          transformOrigin: "center",
          transform: pending ? "rotate(360deg)" : "none",
          transition: "transform 0.6s ease",
        }}
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
      {pending ? "Syncing…" : msg ?? "Sync now"}
    </button>
  );
}
