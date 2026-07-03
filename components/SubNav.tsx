"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect } from "react";

export interface SubNavTab {
  href: string;
  label: string;
}

interface Props {
  tabs: SubNavTab[];
  /** Defaults to exact-match on the first tab's href, startsWith for the rest. */
  isActive?: (pathname: string, href: string) => boolean;
}

// iOS-native section sub-nav: a single horizontally-scrollable row of pills.
// Works at every width — the row scrolls (with trailing padding so the last
// pill is never clipped) and auto-scrolls the active pill into view. Replaces
// the old desktop-row / mobile-dropdown split that cut off on narrow screens.
export default function SubNav({ tabs, isActive }: Props) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  const activeCheck =
    isActive ?? ((p: string, href: string) => (href === tabs[0].href ? p === href : p.startsWith(href)));

  useEffect(() => {
    const el = activeRef.current;
    if (el) el.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  return (
    <div
      style={{
        background: "var(--ios-bg-elevated)",
        borderBottom: "0.5px solid var(--ios-separator)",
        position: "sticky",
        top: 0,
        zIndex: 5,
      }}
    >
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          padding: "10px 16px 10px",
        }}
      >
        {tabs.map(({ href, label }) => {
          const active = activeCheck(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              ref={active ? activeRef : undefined}
              className="ios-footnote"
              style={{
                flex: "0 0 auto",
                padding: "7px 14px",
                borderRadius: 980,
                fontWeight: 600,
                whiteSpace: "nowrap",
                textDecoration: "none",
                background: active ? "var(--ios-tint)" : "var(--ios-fill)",
                color: active ? "#fff" : "var(--ios-label)",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {label}
            </Link>
          );
        })}
        {/* trailing spacer so the last pill clears the edge */}
        <span aria-hidden style={{ flex: "0 0 8px" }} />
      </div>
    </div>
  );
}
