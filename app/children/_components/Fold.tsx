"use client";

// A section that stays shut until it is asked for.
//
// The workspace has two kinds of section. Some are the week's work and belong
// open. The rest — the graded papers, the documents, the dates, the tutor
// transcript — are a record, and a record only grows. After a month of
// newsletters those sections were most of the screen's height and none of its
// purpose, so the week's work had scrolled off the top.
//
// Shut, a fold costs one row and states what is inside it, so nothing is
// hidden, only quiet. Whether it is open is remembered per child per section,
// because a parent who opens Progress every evening should not have to open
// it every evening.

import { useSyncExternalStore } from "react";

// ── The remembered state ────────────────────────────────────────────────────
// localStorage is read through an external store rather than an effect. The
// server has no localStorage, so the alternative was to render the default and
// correct it in an effect on mount, which is a second render on every fold on
// every visit. useSyncExternalStore is built for exactly this: the server (and
// the first client paint, so hydration matches) sees the default, and the real
// value arrives without a cascade. The Map keeps it to one localStorage read
// per key per page.

const cache = new Map<string, boolean>();
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function read(key: string, fallback: boolean): boolean {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let v = fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) v = raw === "1";
  } catch { /* private mode: the default stands */ }
  cache.set(key, v);
  return v;
}

function write(key: string, value: boolean) {
  cache.set(key, value);
  try { localStorage.setItem(key, value ? "1" : "0"); } catch { /* private mode */ }
  for (const l of listeners) l();
}

export function Fold({
  id,
  storageKey,
  title,
  count,
  summary,
  defaultOpen = false,
  children,
}: {
  /** Anchor target, so a tile above can link straight to this section. */
  id?: string;
  /** Stable key for remembering the open state, per child per section. */
  storageKey: string;
  title: string;
  /** Shown as a pill on the right — how much is inside. */
  count?: number | string;
  /** One line of what is inside, read when the fold is shut. */
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const open = useSyncExternalStore(
    subscribe,
    () => read(storageKey, defaultOpen),
    () => defaultOpen,
  );

  return (
    <section className="ios-group" id={id}>
      <button
        type="button"
        onClick={() => write(storageKey, !open)}
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          padding: "10px var(--ios-gutter) 6px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left", color: "inherit",
        }}
      >
        <span
          aria-hidden
          style={{
            fontSize: 11, lineHeight: 1, color: "var(--ios-label-3)",
            transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s ease",
          }}
        >
          ▶
        </span>
        <span className="ios-group-header" style={{ padding: 0, margin: 0, flex: 1 }}>{title}</span>
        {count != null && count !== 0 && (
          <span
            className="ios-caption"
            style={{
              color: "var(--ios-label-2)", background: "var(--ios-fill)",
              borderRadius: 999, padding: "2px 9px", fontWeight: 600,
            }}
          >
            {count}
          </span>
        )}
      </button>
      {!open && summary && (
        <p className="ios-group-footer ios-footnote" style={{ marginTop: 0 }}>{summary}</p>
      )}
      {open && children}
    </section>
  );
}
