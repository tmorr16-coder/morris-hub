"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/career", label: "Overview" },
  { href: "/career/goals", label: "Goals" },
  { href: "/career/timeline", label: "Timeline" },
  { href: "/career/70", label: "70% Experiences" },
  { href: "/career/20", label: "20% Relationships" },
  { href: "/career/10", label: "10% Learning" },
  { href: "/career/profile", label: "Profile & Assessment" },
  { href: "/career/advisor", label: "Career Advisor" },
  { href: "/career/certifications", label: "Certifications" },
  { href: "/career/lsat", label: "LSAT Prep" },
  { href: "/career/settings", label: "⚙ Settings" },
];

export default function CareerSubNav() {
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
          const isActive =
            href === "/career" ? pathname === "/career" : pathname.startsWith(href);
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
