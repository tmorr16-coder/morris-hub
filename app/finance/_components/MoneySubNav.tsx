"use client";

import SubNav from "@/components/SubNav";

// Ordered by how often each is actually wanted, not by how the module grew.
// Accounts and Settings were last of eight, which on a phone means off the
// right-hand edge of a scrolling nav — the two places you go to fix something
// were the two hardest to reach.
const TABS = [
  { href: "/finance/dashboard", label: "Overview" },
  { href: "/finance/dashboard/settings", label: "Accounts" },
  { href: "/finance/dashboard/insights", label: "Spending" },
  { href: "/finance/portfolio", label: "Portfolio" },
  { href: "/finance/retirement", label: "Retirement" },
  { href: "/finance/dashboard/import", label: "Add / import" },
  { href: "/investments/stocks", label: "Stocks" },
  { href: "/investments/ideas", label: "Ideas" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/finance/dashboard") return pathname === "/finance/dashboard" || pathname === "/finance";
  return pathname.startsWith(href);
}

export default function MoneySubNav() {
  return <SubNav tabs={TABS} isActive={isActive} />;
}
