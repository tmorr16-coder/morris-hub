import type { ReactNode } from "react";
import { SparkleIcon } from "./icons";

export type Severity = "urgent" | "today" | "week";
const SEV_LABEL: Record<Severity, string> = { urgent: "Urgent", today: "Today", week: "This week" };

/** Severity badge used in Needs Attention rows. */
export function SeverityBadge({ level }: { level: Severity }) {
  return <span className={`ios-sev ios-sev--${level}`}>{SEV_LABEL[level]}</span>;
}

/** Pill chip; `selected` toggles the tinted state. */
export function Chip({
  children,
  selected,
  small,
  onClick,
}: {
  children: ReactNode;
  selected?: boolean;
  small?: boolean;
  onClick?: () => void;
}) {
  const cls = `ios-chip${small ? " ios-chip--sm" : ""}${selected ? " is-selected" : ""}`;
  if (onClick) {
    return (
      <button type="button" className={cls} aria-pressed={!!selected} onClick={onClick}>
        {children}
      </button>
    );
  }
  return <span className={cls}>{children}</span>;
}

/** Promoted Ask-Morris entry pill. */
export function AskMorrisPill({
  href = "/home/ask",
  placeholder = "Ask Morris anything…",
  onClick,
}: {
  href?: string;
  placeholder?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <SparkleIcon style={{ width: 18, height: 18, color: "var(--ios-tint)" }} />
      <span style={{ flex: 1 }}>{placeholder}</span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="ios-ask" onClick={onClick} style={{ width: "calc(100% - 32px)", textAlign: "left" }}>
        {inner}
      </button>
    );
  }
  return (
    <a className="ios-ask" href={href}>
      {inner}
    </a>
  );
}
