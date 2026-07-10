"use client";

import { useState } from "react";
import { Icons } from "@/components/ios";

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4 4L19 6.5" />
    </svg>
  );
}

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
      <span className="ios-footnote" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-green)" }}>
        <CheckMark /> Family plan created
      </span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); setOpen(true); }}
        className="ios-btn ios-btn--plain"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 0 }}
      >
        <Icons.PeopleIcon style={{ width: 17, height: 17 }} aria-hidden />
        Start family plan
      </button>
    );
  }

  return (
    <form
      onSubmit={handleCreate}
      onClick={(e) => e.preventDefault()}
      style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          fontSize: 15, padding: "8px 12px", borderRadius: "var(--ios-radius-card)",
          background: "var(--ios-cell)", color: "var(--ios-label)",
          border: "1.5px solid var(--ios-tint)", outline: "none",
          fontFamily: "inherit", width: 200,
        }}
      />
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="ios-btn ios-btn--plain"
        style={{ padding: "6px 4px", fontWeight: 600 }}
      >
        {loading ? "Creating…" : "Create"}
      </button>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen(false); }}
        className="ios-btn ios-btn--plain"
        style={{ padding: "6px 4px", color: "var(--ios-label-2)" }}
      >
        Cancel
      </button>
    </form>
  );
}
