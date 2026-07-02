"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/health", label: "Dashboard" },
  { href: "/health/workout", label: "Workouts" },
  { href: "/health/nutrition", label: "Nutrition" },
  { href: "/health/medications", label: "Medications" },
  { href: "/health/progress", label: "Progress" },
  { href: "/health/wellness", label: "Wellness" },
  { href: "/health/settings/integrations", label: "⚙ Settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/health") return pathname === "/health";
  if (href === "/health/workout") return pathname.startsWith("/health/workout") || pathname.startsWith("/health/train");
  if (href === "/health/medications") return pathname.startsWith("/health/medications") || pathname.startsWith("/health/zepbound");
  return pathname.startsWith(href);
}

export default function HealthSubNav() {
  const pathname = usePathname();

  return (
    <div
      style={{
        background: "var(--color-bg-card)",
        borderBottom: "1px solid var(--color-rule)",
        overflowX: "auto",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 0,
          maxWidth: 1180,
          margin: "0 auto",
          padding: "0 28px",
        }}
      >
        {NAV_LINKS.map(({ href, label }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "inline-block",
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? "var(--color-accent)" : "var(--color-ink-2)",
                textDecoration: "none",
                borderBottom: active
                  ? "2px solid var(--color-accent)"
                  : "2px solid transparent",
                whiteSpace: "nowrap",
                transition: "color 0.15s",
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
