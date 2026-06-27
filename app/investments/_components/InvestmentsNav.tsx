"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function InvestmentsNav() {
  const pathname = usePathname();
  const isStocks = pathname.includes("/stocks");
  const isIdeas = pathname.includes("/ideas");

  const navItems = [
    { label: "📊 Stocks", href: "/investments/stocks", active: isStocks || (!isStocks && !isIdeas) },
    { label: "💡 Ideas",  href: "/investments/ideas",  active: isIdeas },
  ];

  return (
    <nav
      style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--color-rule)",
        borderTop: "1px solid var(--color-rule)",
        backgroundColor: "var(--color-bg)",
        paddingLeft: 28,
        paddingRight: 28,
      }}
    >
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          style={{
            padding: "14px 20px",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: item.active ? 600 : 500,
            color: item.active ? "var(--color-ink)" : "var(--color-ink-2)",
            borderBottom: item.active ? "2px solid var(--color-accent)" : "none",
            transition: "all 0.2s",
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
