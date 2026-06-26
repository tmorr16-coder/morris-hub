"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncAll } from "../actions";

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
        <span style={{ fontSize: 11, color: "var(--color-moss)" }}>{result}</span>
      )}
      <button
        onClick={handleSync}
        disabled={isPending}
        style={{
          fontSize: 11,
          color: isPending ? "var(--color-ink-4)" : "var(--color-ink-3)",
          textDecoration: "none",
          padding: "4px 10px",
          border: "1px solid var(--color-line)",
          borderRadius: 8,
          background: "transparent",
          cursor: isPending ? "wait" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {isPending ? "Syncing…" : "↻ Sync"}
      </button>
    </div>
  );
}
