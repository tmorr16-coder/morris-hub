"use client";

import { useState, type ReactNode } from "react";

interface Props {
  id: string;
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function CollapsibleSection({ id, label, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section aria-labelledby={id} style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: open ? 12 : 0 }}>
        <h2
          id={id}
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-ink-4)",
            margin: 0,
            fontFamily: "var(--font-geist, system-ui), sans-serif",
            flex: 1,
          }}
        >
          {label}
        </h2>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={`${id}-content`}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 500,
            color: "var(--color-ink-4)",
            fontFamily: "var(--font-geist, system-ui), sans-serif",
            padding: "2px 6px",
            borderRadius: 5,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            style={{ transition: "transform 150ms", transform: open ? "rotate(180deg)" : "none" }}
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open && <div id={`${id}-content`}>{children}</div>}
    </section>
  );
}
