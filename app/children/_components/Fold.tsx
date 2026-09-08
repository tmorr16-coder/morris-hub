"use client";

// A section that folds, and that can be moved.
//
// Every section on the workspace is one of these. Some open by default and
// some do not, but the choice belongs to whoever is holding the iPad: what one
// parent checks nightly the other never opens, and the useful order in
// September is not the useful order in May.
//
// Shut, a fold costs one row and states what is inside it, so nothing is
// hidden, only quiet. The accessory — a progress bar, a count — stays visible
// either way, so a folded section can still report.

import { useLocalValue, writeLocal } from "../_lib/ui-state";

export function Fold({
  id,
  storageKey,
  title,
  count,
  summary,
  accessory,
  defaultOpen = false,
  arrange,
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
  /** Stays under the header whether the fold is open or shut. */
  accessory?: React.ReactNode;
  defaultOpen?: boolean;
  /** Present only while the screen is being arranged. */
  arrange?: { up: (() => void) | null; down: (() => void) | null };
  children: React.ReactNode;
}) {
  const open = useLocalValue<boolean>(storageKey, defaultOpen);
  const arranging = arrange != null;

  return (
    <section
      className="ios-group"
      id={id}
      // Shut folds sit closer together than open ones. A screen with ten of
      // them is meant to be an overview, and the design system's 22px between
      // sections is spacing for content, not for a table of contents.
      // scroll-margin keeps the four tiles' #spelling and #scripture jumps from
      // landing with the heading against the very top of the scroller.
      style={{ marginTop: open ? undefined : 10, scrollMarginTop: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px var(--ios-gutter) 6px" }}>
        {arranging && (
          <span aria-hidden style={{ fontSize: 15, color: "var(--ios-label-3)", cursor: "grab", lineHeight: 1 }}>≡</span>
        )}
        <button
          type="button"
          onClick={() => writeLocal(storageKey, !open)}
          aria-expanded={open}
          style={{
            display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0,
            padding: 0, background: "none", border: "none", cursor: "pointer",
            textAlign: "left", color: "inherit",
          }}
        >
          <span
            aria-hidden
            style={{
              fontSize: 11, lineHeight: 1, color: "var(--ios-label-3)", flexShrink: 0,
              transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s ease",
            }}
          >
            ▶
          </span>
          <span
            className="ios-group-header"
            style={{ padding: 0, margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {title}
          </span>
          {count != null && count !== 0 && !arranging && (
            <span
              className="ios-caption"
              style={{
                color: "var(--ios-label-2)", background: "var(--ios-fill)",
                borderRadius: 999, padding: "2px 9px", fontWeight: 600, flexShrink: 0,
              }}
            >
              {count}
            </span>
          )}
        </button>
        {arranging && (
          <span style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            <MoveButton label={`Move ${title} up`} glyph="▲" onClick={arrange.up} />
            <MoveButton label={`Move ${title} down`} glyph="▼" onClick={arrange.down} />
          </span>
        )}
      </div>
      {accessory}
      {!open && summary != null && summary !== "" ? (
        <p
          className="ios-group-footer ios-footnote"
          style={{
            margin: 0, color: "var(--ios-label-3)",
            display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden",
          }}
        >
          {summary}
        </p>
      ) : null}
      {open ? children : null}
    </section>
  );
}

function MoveButton({ label, glyph, onClick }: { label: string; glyph: string; onClick: (() => void) | null }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!onClick}
      onClick={onClick ?? undefined}
      style={{
        width: 34, height: 30, borderRadius: 8, border: "1px solid var(--ios-separator)",
        background: onClick ? "var(--ios-cell)" : "transparent",
        color: onClick ? "var(--ios-tint)" : "var(--ios-label-3)",
        opacity: onClick ? 1 : 0.35, fontSize: 11, cursor: onClick ? "pointer" : "default",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {glyph}
    </button>
  );
}
