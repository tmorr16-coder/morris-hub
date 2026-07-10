import Link from "next/link";
import { Icons } from "@/components/ios";
import type { ReactNode } from "react";

// Quick-launch favorites — one tap to the capabilities Terry uses most.
const ACTIONS: { label: string; href: string; color: string; icon: ReactNode }[] = [
  { label: "Build workout", href: "/health/workout/builder", color: "var(--ios-green)", icon: <Icons.DumbbellIcon /> },
  { label: "Bible plan", href: "/bible/read", color: "#3B5C7F", icon: <Icons.BookIcon /> },
  { label: "Ask Morris", href: "/home/ask", color: "var(--ios-tint)", icon: <Icons.SparkleIcon /> },
  { label: "Log meal", href: "/health/nutrition", color: "#E8734A", icon: <Icons.ForkKnifeIcon /> },
  { label: "Markets", href: "/investments/stocks", color: "#C97A3A", icon: <Icons.TrendUpIcon /> },
  { label: "News", href: "/news", color: "#9A3B2A", icon: <Icons.NewsIcon /> },
];

export default function QuickActions() {
  return (
    <div style={{ margin: "16px 0 0" }}>
      <div className="ios-group-header">Quick actions</div>
      <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "0 16px 2px", scrollbarWidth: "none" }}>
        {ACTIONS.map((a) => (
          <Link key={a.label} href={a.href} style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 64, textAlign: "center" }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: a.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ display: "flex", width: 26, height: 26 }}>{a.icon}</span>
            </span>
            <span className="ios-caption" style={{ color: "var(--ios-label-2)", lineHeight: 1.15 }}>{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
