import Link from "next/link";
import { Icons } from "@/components/ios";
import type { ReactNode } from "react";

// Quick-launch favorites — one tap to the capabilities Terry uses most.
//
// Four columns, two rows. It was three columns and six actions; adding the two
// school shortcuts would have left a ragged row of two, and four across still
// gives each label 79px at 390px — enough for the longest of them.
const ACTIONS: { label: string; href: string; color: string; icon: ReactNode }[] = [
  // Ask Morris intentionally omitted here — the hero Ask pill right below is the
  // primary global entry point (avoids the Today triple-up).
  { label: "Panel", href: "/home/ask/compare", color: "var(--ios-family)", icon: <Icons.SparkleIcon /> },
  { label: "Workout", href: "/health/workout/builder", color: "var(--ios-health)", icon: <Icons.DumbbellIcon /> },
  { label: "Bible", href: "/bible/read", color: "var(--ios-bible)", icon: <Icons.BookIcon /> },
  { label: "Meal", href: "/health/nutrition", color: "var(--ios-orange)", icon: <Icons.ForkKnifeIcon /> },
  { label: "Markets", href: "/investments/stocks", color: "var(--ios-investments)", icon: <Icons.TrendUpIcon /> },
  { label: "News", href: "/news", color: "var(--ios-news)", icon: <Icons.NewsIcon /> },
  // Buddy resolves the child himself — see app/children/buddy/page.tsx. The URL
  // is fixed, so it also works as an iPad home-screen icon that opens straight
  // into the tutor.
  { label: "Buddy", href: "/children/buddy", color: "#FF8C42", icon: <Icons.SparkleIcon /> },
  { label: "Children", href: "/children", color: "var(--ios-children)", icon: <Icons.PeopleIcon /> },
];

export default function QuickActions() {
  return (
    <div style={{ margin: "16px 0 0" }}>
      <div className="ios-group-header">Quick actions</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: "0 16px" }}>
        {ACTIONS.map((a) => (
          <Link key={a.label} href={a.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center", padding: "8px 0", borderRadius: 14 }}>
            <span style={{ width: 52, height: 52, borderRadius: 15, background: a.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ display: "flex", width: 26, height: 26 }}>{a.icon}</span>
            </span>
            <span className="ios-caption" style={{ color: "var(--ios-label)", fontWeight: 500, lineHeight: 1.15 }}>{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
