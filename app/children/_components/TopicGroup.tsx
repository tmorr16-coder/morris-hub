"use client";

// A topic inside a section: a heading, a tally, and everything under it.
//
// Grouping the week and the practice plan by topic put headings on the rows
// but did nothing about the length — fifteen rows with five headings is still
// fifteen rows, and the complaint was the scrolling. A heading that folds is
// the navigation: the topics you are done with cost one line each, and what is
// left sits in view without a thumb.
//
// A topic that is finished starts shut. That is the whole trick. On a Thursday
// evening the words are done, the verse is done, and the only thing still open
// is the one thing still to do — which is what the card was always for.

import { useLocalValue, writeLocal } from "../_lib/ui-state";

export function TopicGroup({
  storageKey,
  title,
  done,
  total,
  first = false,
  children,
}: {
  /** Per child, per topic. A topic deliberately reopened stays open. */
  storageKey: string;
  title: string;
  done: number;
  total: number;
  /** The first topic in a section carries no rule above it. */
  first?: boolean;
  children: React.ReactNode;
}) {
  const allDone = total > 0 && done === total;
  // The default is recomputed each visit, so a topic finished today is shut
  // tomorrow without anyone being asked. An explicit tap outranks it.
  const open = useLocalValue<boolean>(storageKey, !allDone);

  return (
    <div>
      <button
        type="button"
        onClick={() => writeLocal(storageKey, !open)}
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "10px 16px", background: "var(--ios-fill-2)", border: "none",
          borderTop: first ? "none" : "1px solid var(--ios-separator)",
          cursor: "pointer", textAlign: "left", color: "inherit",
        }}
      >
        <span
          aria-hidden
          style={{
            fontSize: 9, lineHeight: 1, color: "var(--ios-label-3)", flexShrink: 0,
            transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s ease",
          }}
        >
          ▶
        </span>
        <span
          className="ios-caption"
          style={{
            flex: 1, minWidth: 0, color: "var(--ios-label-2)", textTransform: "uppercase",
            letterSpacing: "0.06em", fontWeight: 700,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
        {/* A tally over a single row says nothing the row does not; a tick on a
            finished topic says the one thing worth knowing while it is shut. */}
        {allDone ? (
          <span className="ios-caption" style={{ color: "var(--ios-green)", fontWeight: 700, flexShrink: 0 }}>
            Done ✓
          </span>
        ) : total > 1 ? (
          <span className="ios-caption ios-num" style={{ color: "var(--ios-label-3)", fontWeight: 700, flexShrink: 0 }}>
            {done}/{total}
          </span>
        ) : null}
      </button>
      {open ? children : null}
    </div>
  );
}
