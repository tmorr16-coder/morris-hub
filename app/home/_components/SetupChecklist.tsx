"use client";

import { useState } from "react";

export interface SetupItem {
  key: string;
  label: string;
  href: string;
  done: boolean;
}

const DISMISS_KEY = "setup-checklist-dismissed";

export default function SetupChecklist({ items }: { items: SetupItem[] }) {
  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  const allDone = doneCount === total;

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  });

  // Hide once everything's done, or if the user dismissed it.
  if (allDone || dismissed) return null;

  const next = items.find((i) => !i.done);

  return (
    <section
      aria-label="Set up your account"
      style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: 16, margin: "4px 16px 0" }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div>
          <div className="ios-headline">Finish setting up</div>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 1 }}>{doneCount} of {total} done</div>
        </div>
        <button
          onClick={() => { window.localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); }}
          className="ios-caption"
          style={{ color: "var(--ios-label-3)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
          aria-label="Dismiss setup checklist"
        >
          Dismiss
        </button>
      </div>

      {/* progress bar */}
      <div style={{ height: 5, borderRadius: 3, background: "var(--ios-fill)", overflow: "hidden", marginBottom: 12 }}>
        <div style={{ width: `${(doneCount / total) * 100}%`, height: "100%", background: "var(--ios-green)", transition: "width .3s" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((i) => (
          <a
            key={i.key}
            href={i.href}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 0", textDecoration: "none",
              borderTop: "var(--ios-hair) solid var(--ios-separator)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: i.done ? "var(--ios-green)" : "transparent",
                border: i.done ? "none" : "2px solid var(--ios-label-3)",
                color: "#fff",
              }}
            >
              {i.done && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>
              )}
            </span>
            <span className="ios-subhead" style={{ flex: 1, color: i.done ? "var(--ios-label-2)" : "var(--ios-label)", textDecoration: i.done ? "line-through" : "none" }}>
              {i.label}
            </span>
            {!i.done && i.key === next?.key && (
              <span className="ios-caption" style={{ color: "var(--ios-tint)", fontWeight: 600 }}>Start →</span>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}
