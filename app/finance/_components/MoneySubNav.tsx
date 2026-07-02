"use client";

import SubNav from "@/components/SubNav";

const TABS = [
  { href: "/finance/dashboard", label: "Overview" },
  { href: "/finance/portfolio", label: "Portfolio" },
  { href: "/investments/stocks", label: "Stocks" },
  { href: "/investments/ideas", label: "Ideas" },
  { href: "/finance/retirement", label: "Retirement" },
  { href: "/finance/dashboard/insights", label: "Insights" },
  { href: "/finance/dashboard/import", label: "Accounts" },
  { href: "/finance/dashboard/settings", label: "Settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/finance/dashboard") return pathname === "/finance/dashboard" || pathname === "/finance";
  return pathname.startsWith(href);
}

export default function MoneySubNav() {
  return <SubNav tabs={TABS} isActive={isActive} />;
}
