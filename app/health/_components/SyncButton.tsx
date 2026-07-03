"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncAll } from "../actions";

function RefreshIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 11a8 8 0 1 0-.9 4.7M20 4v5h-5" />
    </svg>
  );
}

export default function SyncButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleSync() {
    setResult(null);
    startTransition(async () => {
      const r = await syncAll();
      setResult(r.message ?? "Synced");
      router.refresh();
      // Clear message after 4 seconds
      setTimeout(() => setResult(null), 4000);
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {result && (
        <span className="ios-footnote" style={{ color: "var(--ios-green)" }}>{result}</span>
      )}
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        className="ios-chip ios-chip--sm"
        style={{ color: "var(--ios-tint)", opacity: isPending ? 0.5 : 1, cursor: isPending ? "wait" : "pointer" }}
      >
        <RefreshIcon />
        {isPending ? "Syncing…" : "Sync"}
      </button>
    </div>
  );
}
