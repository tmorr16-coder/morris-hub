import type { ReactNode } from "react";
import Link from "next/link";

/** 2×2 grid of one-tap glance tiles — the quick-access summary layer. */
export function GlanceGrid({ children }: { children: ReactNode }) {
  return <div className="ios-glance">{children}</div>;
}

export function GlanceTile({
  label,
  icon,
  value,
  sub,
  badge,
  accent,
  href,
}: {
  label: string;
  icon?: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  /** Small count badge in the top-right (e.g. reminders due). */
  badge?: ReactNode;
  /** Tints the label + icon (defaults to the brand tint). */
  accent?: string;
  href: string;
}) {
  return (
    <Link className="ios-tile" href={href} style={accent ? ({ "--tile-accent": accent } as React.CSSProperties) : undefined}>
      <span className="ios-tile-top">
        <span className="ios-tile-label" style={{ color: accent ?? "var(--ios-tint)" }}>
          {label}
        </span>
        {badge != null ? (
          <span className="ios-badge ios-num">{badge}</span>
        ) : icon != null ? (
          <span style={{ color: accent ?? "var(--ios-tint)", display: "flex" }}>{icon}</span>
        ) : null}
      </span>
      <span className="ios-tile-value ios-num">{value}</span>
      {sub != null && <span className="ios-tile-sub">{sub}</span>}
    </Link>
  );
}
