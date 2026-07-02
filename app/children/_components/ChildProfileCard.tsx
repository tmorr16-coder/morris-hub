import Link from "next/link";
import type { ChildCardSummary } from "../_lib/children";

const TIER_LABEL: Record<string, string> = {
  elementary: "Elementary",
  teen: "Teen",
  college: "College",
};

export default function ChildProfileCard({ card }: { card: ChildCardSummary }) {
  return (
    <Link href={`/children/${card.childId}`} style={{
      display: "block", textDecoration: "none",
      background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
      borderRadius: 14, padding: "18px 20px", boxShadow: "var(--shadow-card)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%", background: "var(--color-accent-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 700, color: "var(--color-accent)", flexShrink: 0,
        }}>
          {card.initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            {card.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            {TIER_LABEL[card.ageTier]}{card.age !== null ? ` · Age ${card.age}` : ""}
          </div>
        </div>
      </div>

      {card.attentionItem && (
        <div style={{
          fontSize: 12, color: "#9A3B2A", background: "rgba(154,59,42,0.08)",
          borderLeft: "3px solid #9A3B2A", padding: "6px 10px", borderRadius: 6, marginBottom: 10,
          fontFamily: "var(--font-geist, system-ui), sans-serif",
        }}>
          {card.attentionItem}
        </div>
      )}

      <div className="serif" style={{ fontSize: 15, color: "var(--color-ink)", marginBottom: 8 }}>
        {card.todaysScheduleItem ?? "Nothing scheduled today"}
      </div>

      <div style={{
        display: "flex", gap: 12, fontSize: 11, color: "var(--color-ink-3)", paddingTop: 8,
        borderTop: "1px solid var(--color-rule-soft)", fontFamily: "var(--font-geist, system-ui), sans-serif",
      }}>
        <span>{card.upcomingDeadline ? `Due: ${card.upcomingDeadline.title}` : "No upcoming deadlines"}</span>
      </div>
    </Link>
  );
}
