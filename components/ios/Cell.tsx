import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "./icons";

export interface CellProps {
  /** Leading icon badge or custom node (avatar, checkbox…). */
  lead?: ReactNode;
  /** Background color for the default rounded icon badge (when `lead` is an icon element you wrap yourself, ignore). */
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned value/accessory before the chevron. */
  trailing?: ReactNode;
  /** Show a disclosure chevron (defaults true when href/onClick present). */
  chevron?: boolean;
  href?: string;
  onClick?: () => void;
  /** Inset the separator to align under the title instead of the row edge. */
  insetSeparator?: boolean;
  ariaLabel?: string;
}

/**
 * A single grouped-list row. Renders as a Link, a button, or a static div
 * depending on whether href/onClick is supplied. Server-safe unless onClick
 * (a client handler) is passed by a client parent.
 */
export function Cell({
  lead,
  title,
  subtitle,
  trailing,
  chevron,
  href,
  onClick,
  insetSeparator,
  ariaLabel,
}: CellProps) {
  const interactive = href != null || onClick != null;
  const showChevron = chevron ?? interactive;

  const inner = (
    <>
      {lead != null && <span className="ios-cell-lead">{lead}</span>}
      <span className="ios-cell-body">
        <span className="ios-cell-title">{title}</span>
        {subtitle != null && <span className="ios-cell-sub">{subtitle}</span>}
      </span>
      {trailing != null && <span className="ios-cell-trail">{trailing}</span>}
      {showChevron && <ChevronRight className="ios-chevron" />}
    </>
  );

  const cls = `ios-cell${insetSeparator ? " ios-cell--inset" : ""}`;

  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={ariaLabel}>
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} aria-label={ariaLabel}>
      {inner}
    </div>
  );
}

/** Rounded SF-symbol-style leading icon badge. */
export function IconBadge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="ios-icon" style={{ background: color }}>
      {children}
    </span>
  );
}
