"use client";

import { useState } from "react";

export default function StartFamilyPlanButton({
  planId,
  planTitle,
}: {
  planId: string;
  planTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${planTitle} — Family`);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/bible/family-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, name }),
    });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => window.location.reload(), 800);
    }
  }

  if (done) {
    return (
      <span style={{ fontSize: 11, color: "var(--color-green)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
        ✓ Family plan created
      </span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); setOpen(true); }}
        style={{
          fontSize: 11, padding: "4px 10px", borderRadius: 7,
          border: "1px solid var(--color-rule)", background: "transparent",
          color: "var(--color-ink-3)", cursor: "pointer",
          fontFamily: "var(--font-geist, system-ui), sans-serif",
        }}
      >
        👨‍👩‍👧 Start family plan
      </button>
    );
  }

  return (
    <form
      onSubmit={handleCreate}
      onClick={(e) => e.preventDefault()}
      style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          fontSize: 12, padding: "5px 10px", borderRadius: 7,
          border: "1.5px solid var(--color-accent)", outline: "none",
          fontFamily: "var(--font-geist, system-ui), sans-serif",
          width: 180,
        }}
      />
      <button
        type="submit"
        disabled={loading || !name.trim()}
        style={{
          fontSize: 11, padding: "5px 12px", borderRadius: 7, border: "none",
          background: "var(--color-accent)", color: "#FFFDF8",
          cursor: loading ? "wait" : "pointer",
          fontFamily: "var(--font-geist, system-ui), sans-serif",
        }}
      >
        {loading ? "Creating…" : "Create"}
      </button>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen(false); }}
        style={{
          fontSize: 11, padding: "5px 10px", borderRadius: 7,
          border: "1px solid var(--color-rule)", background: "transparent",
          color: "var(--color-ink-4)", cursor: "pointer",
          fontFamily: "var(--font-geist, system-ui), sans-serif",
        }}
      >
        Cancel
      </button>
    </form>
  );
}
