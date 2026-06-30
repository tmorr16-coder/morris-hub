"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  {
    href: "/finance/dashboard",
    label: "Overview",
    match: (p: string) => p === "/finance/dashboard" || p === "/finance",
  },
  {
    href: "/investments/stocks",
    label: "Stocks",
    match: (p: string) => p.startsWith("/investments/stocks"),
  },
  {
    href: "/investments/ideas",
    label: "Ideas",
    match: (p: string) => p.startsWith("/investments/ideas"),
  },
  {
    href: "/finance/retirement",
    label: "Retirement",
    match: (p: string) => p.startsWith("/finance/retirement"),
  },
  {
    href: "/finance/dashboard/insights",
    label: "Insights",
    match: (p: string) => p.startsWith("/finance/dashboard/insights"),
  },
  {
    href: "/finance/dashboard/import",
    label: "Accounts",
    match: (p: string) => p.startsWith("/finance/dashboard/import"),
  },
  {
    href: "/finance/dashboard/settings",
    label: "Settings",
    match: (p: string) => p.startsWith("/finance/dashboard/settings"),
  },
];

export default function MoneySubNav() {
  const pathname = usePathname();
  return (
    <div
      style={{
        background: "var(--color-bg-card)",
        borderBottom: "1px solid var(--color-rule)",
        overflowX: "auto",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      } as React.CSSProperties}
    >
      <style>{`.money-subnav::-webkit-scrollbar { display: none; }`}</style>
      <div
        className="money-subnav"
        style={{
          display: "flex",
          gap: 0,
          maxWidth: 1180,
          margin: "0 auto",
          padding: "0 20px",
          overflowX: "auto",
          scrollbarWidth: "none",
        } as React.CSSProperties}
      >
        {LINKS.map(({ href, label, match }) => {
          const isActive = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "inline-block",
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--color-accent)" : "var(--color-ink-2)",
                textDecoration: "none",
                borderBottom: isActive
                  ? "2px solid var(--color-accent)"
                  : "2px solid transparent",
                whiteSpace: "nowrap",
                transition: "color 0.15s",
                flexShrink: 0,
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
