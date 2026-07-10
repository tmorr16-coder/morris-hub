"use client";

import SubNav from "@/components/SubNav";

const TABS = [
  { href: "/health", label: "Dashboard" },
  { href: "/health/train", label: "Workouts" },
  { href: "/health/nutrition", label: "Nutrition" },
  { href: "/health/medications", label: "Medications" },
  { href: "/health/wellness", label: "Wellness" },
  { href: "/health/settings/integrations", label: "Settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/health") return pathname === "/health";
  if (href === "/health/train") return pathname.startsWith("/health/workout") || pathname.startsWith("/health/train");
  if (href === "/health/medications") return pathname.startsWith("/health/medications") || pathname.startsWith("/health/zepbound");
  return pathname.startsWith(href);
}

export default function HealthSubNav() {
  return <SubNav tabs={TABS} isActive={isActive} />;
}
