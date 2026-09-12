"use client";

// The week, as one list.
//
// Everything the workspace knows about what is owed this week, gathered from
// four different tables into a single checklist: the spelling words, the
// memory verse and recitation, the practice the graded papers argued for, and
// anything a parent sent to the child's screen by hand.
//
// It sits above everything else and it is the only place on the screen that
// answers "what are we meant to do tonight". Before this, that answer was
// spread across five sections in the order the data happened to arrive, and
// the two that mattered most on a Tuesday — spelling and scripture — were the
// fourth and the eighth.
//
// Rows are deliberately not all the same. Some carry a count (words
// practised), some a streak, some only whether they have been handed to the
// child yet. A row that is finished says so and stops asking.

import Link from "next/link";
import { TopicGroup } from "./TopicGroup";

export interface WeekItem {
  key: string;
  /** Which run of rows this belongs to. Rows arrive already in group order. */
  group: string;
  /** Emoji rather than an icon badge: this list is scanned, not read. */
  glyph: string;
  label: string;
  detail?: string | null;
  /** Partial credit, shown as "3/10" and counted as a fraction in the total. */
  progress?: { done: number; total: number } | null;
  done: boolean;
  /** The section this row belongs to, e.g. "#spelling". */
  href?: string;
  /** The one thing to do about this row from here. */
  action?: { label: string; run: () => void; disabled?: boolean; muted?: boolean } | null;
}

function completion(items: WeekItem[]): { done: number; total: number } {
  let done = 0;
  for (const it of items) {
    if (it.done) done += 1;
    else if (it.progress && it.progress.total > 0) done += it.progress.done / it.progress.total;
  }
  return { done, total: items.length };
}

/** How far through the week, for the fold's header. Visible open or shut. */
export function WeekProgress({ items, weekLabel }: { items: WeekItem[]; weekLabel?: string | null }) {
  const { done, total } = completion(items);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const allDone = total > 0 && pct === 100;
  return (
    <div style={{ padding: "0 var(--ios-gutter) 4px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>{weekLabel}</span>
        <span
          className="ios-subhead"
          style={{ color: allDone ? "var(--ios-green)" : "var(--ios-label-2)", fontWeight: 700, whiteSpace: "nowrap" }}
        >
          {total === 0 ? "—" : allDone ? "All done 🎉" : `${Math.round(done)} of ${total}`}
        </span>
      </div>
      {total > 0 && (
        <div
          aria-hidden
          style={{ height: 6, borderRadius: 999, background: "var(--ios-fill)", marginTop: 6, overflow: "hidden" }}
        >
          <div
            style={{
              height: "100%", width: `${pct}%`, borderRadius: 999,
              background: allDone ? "var(--ios-green)" : "var(--ios-tint)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Rows in runs, each run under its own heading.
 *
 * Seven rows is a list; fifteen is a wall. Once a week carries spelling, three
 * pieces of memory work, four exercises, a note from the teacher and whatever
 * was typed in by hand, an undifferentiated column of them cannot be read at a
 * glance — which is the only thing this card is for. The headings are the
 * kinds of work, and each one carries its own count, so a parent with ten
 * minutes can see that the words are done and the practice is not without
 * reading a single row.
 *
 * Rows arrive in group order, so this walks them once and starts a new heading
 * whenever the group changes; it never sorts, and a group cannot appear twice.
 */
export function WeekRows({ items, emptyNote, keyPrefix }: { items: WeekItem[]; emptyNote: string; keyPrefix: string }) {
  const runs: { group: string; items: WeekItem[] }[] = [];
  for (const it of items) {
    const last = runs[runs.length - 1];
    if (last && last.group === it.group) last.items.push(it);
    else runs.push({ group: it.group, items: [it] });
  }

  return (
    <div className="ios-list" style={{ margin: "8px var(--ios-gutter) 0", overflow: "hidden", padding: 0 }}>
      {items.length === 0 && (
        <div style={{ padding: "18px 16px", color: "var(--ios-label-2)" }} className="ios-subhead">
          {emptyNote}
        </div>
      )}

      {/* A single run needs no heading — the card's own title already says what
          it is, and a lone header over a lone row is just noise. */}
      {runs.length === 1 && <RunRows items={runs[0].items} />}
      {runs.length > 1 && runs.map((run, ri) => (
        <TopicGroup
          key={run.group}
          storageKey={`${keyPrefix}-${run.group}`}
          title={run.group}
          done={run.items.filter((x) => x.done).length}
          total={run.items.length}
          first={ri === 0}
        >
          <RunRows items={run.items} />
        </TopicGroup>
      ))}
    </div>
  );
}

function RunRows({ items }: { items: WeekItem[] }) {
  return (
    <>
      {items.map((it, i) => {
          const body = (
            <>
              <span
                aria-hidden
                style={{
                  fontSize: 22, width: 30, textAlign: "center", flexShrink: 0,
                  opacity: it.done ? 0.45 : 1,
                }}
              >
                {it.done ? "✅" : it.glyph}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2,
                    overflow: "hidden", fontSize: 17, fontWeight: 600, lineHeight: "22px",
                    color: it.done ? "var(--ios-label-3)" : "var(--ios-label)",
                    textDecoration: it.done ? "line-through" : "none",
                  }}
                >
                  {it.label}
                </span>
                {it.detail && (
                  <span
                    className="ios-caption"
                    style={{
                      display: "block", color: "var(--ios-label-2)", marginTop: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {it.detail}
                  </span>
                )}
              </span>
              {it.progress && it.progress.total > 0 && !it.done && (
                <span
                  className="ios-caption ios-num"
                  style={{
                    color: "var(--ios-label-2)", background: "var(--ios-fill)",
                    borderRadius: 999, padding: "3px 9px", fontWeight: 700, flexShrink: 0,
                  }}
                >
                  {it.progress.done}/{it.progress.total}
                </span>
              )}
            </>
          );

          const rowStyle: React.CSSProperties = {
            display: "flex", alignItems: "center", gap: 12, width: "100%",
            padding: "12px 16px", textAlign: "left", background: "none",
            border: "none", color: "inherit",
            borderTop: i === 0 ? "none" : "1px solid var(--ios-separator)",
          };

          return (
            <div key={it.key} style={{ display: "flex", alignItems: "stretch" }}>
              {it.href ? (
                <Link href={it.href} style={{ ...rowStyle, flex: 1, textDecoration: "none" }}>{body}</Link>
              ) : (
                <div style={{ ...rowStyle, flex: 1 }}>{body}</div>
              )}
              {it.action && (
                <div
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "flex-end",
                    paddingRight: 14, flexShrink: 0, maxWidth: 104,
                    borderTop: i === 0 ? "none" : "1px solid var(--ios-separator)",
                  }}
                >
                  <button
                    type="button"
                    className="ios-btn--plain"
                    disabled={it.action.disabled}
                    onClick={it.action.run}
                    style={{
                      color: it.action.muted ? "var(--ios-green)" : "var(--ios-tint)",
                      fontWeight: 700, whiteSpace: "nowrap", fontSize: 15,
                    }}
                  >
                    {it.action.label}
                  </button>
                </div>
              )}
            </div>
          );
        })}
    </>
  );
}
