import Link from "next/link";
import { Icons } from "@/components/ios";
import type { ReactNode } from "react";

// Quick-launch favorites — one tap to the capabilities Terry uses most.
// Short labels + a fixed 3-column grid (2 rows) so nothing clips on a 390px phone.
const ACTIONS: { label: string; href: string; color: string; icon: ReactNode }[] = [
  // Ask Morris intentionally omitted here — the hero Ask pill right below is the
  // primary global entry point (avoids the Today triple-up).
  { label: "Panel", href: "/home/ask/compare", color: "var(--ios-family)", icon: <Icons.SparkleIcon /> },
  { label: "Workout", href: "/health/workout/builder", color: "var(--ios-health)", icon: <Icons.DumbbellIcon /> },
  { label: "Bible", href: "/bible/read", color: "var(--ios-bible)", icon: <Icons.BookIcon /> },
  { label: "Meal", href: "/health/nutrition", color: "var(--ios-orange)", icon: <Icons.ForkKnifeIcon /> },
  { label: "Markets", href: "/investments/stocks", color: "var(--ios-investments)", icon: <Icons.TrendUpIcon /> },
  { label: "News", href: "/news", color: "var(--ios-news)", icon: <Icons.NewsIcon /> },
];

export default function QuickActions() {
  return (
    <div style={{ margin: "16px 0 0" }}>
      <div className="ios-group-header">Quick actions</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, padding: "0 16px" }}>
        {ACTIONS.map((a) => (
          <Link key={a.label} href={a.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center", padding: "8px 0", borderRadius: 14 }}>
            <span style={{ width: 54, height: 54, borderRadius: 16, background: a.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ display: "flex", width: 26, height: 26 }}>{a.icon}</span>
            </span>
            <span className="ios-caption" style={{ color: "var(--ios-label)", fontWeight: 500, lineHeight: 1.15 }}>{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
