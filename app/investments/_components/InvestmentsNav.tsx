"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function InvestmentsNav() {
  const pathname = usePathname();
  const isStockResearch = pathname.includes("/stocks");

  const navItems = [
    { label: "💡 Ideas", href: "/investments", active: !isStockResearch },
    { label: "📊 Stocks", href: "/investments/stocks", active: isStockResearch },
  ];

  return (
    <nav
      style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--color-rule)",
        marginBottom: 28,
        marginLeft: 0,
        marginRight: 0,
        marginTop: -32,
        paddingLeft: 28,
        paddingRight: 28,
        paddingTop: 32,
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
