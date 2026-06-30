"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/bible",            label: "Dashboard" },
  { href: "/bible/read",       label: "Read" },
  { href: "/bible/plans",      label: "Plans" },
  { href: "/bible/search",     label: "Search" },
  { href: "/bible/chat",       label: "Chat" },
  { href: "/bible/notes",      label: "Notes" },
  { href: "/bible/challenges", label: "Challenges" },
  { href: "/bible/settings",   label: "Settings" },
];

export default function BibleNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Bible navigation"
      style={{
        display: "flex",
        gap: 4,
        padding: "8px 20px",
        borderBottom: "1px solid var(--color-rule)",
        background: "var(--color-bg-card)",
        overflowX: "auto",
        scrollbarWidth: "none",
      } as React.CSSProperties}
    >
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || (href !== "/bible" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            style={{
              padding: "5px 11px",
              borderRadius: 7,
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              color: active ? "var(--color-ink)" : "var(--color-ink-3)",
              textDecoration: "none",
              background: active ? "rgba(0,0,0,0.06)" : "transparent",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-geist, system-ui), sans-serif",
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
