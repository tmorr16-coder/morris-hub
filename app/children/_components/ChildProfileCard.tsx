import type { ChildCardSummary } from "../_lib/children";
import { Cell } from "@/components/ios";

const TIER_LABEL: Record<string, string> = {
  elementary: "Elementary",
  teen: "Teen",
  college: "College",
};

export default function ChildProfileCard({ card }: { card: ChildCardSummary }) {
  return (
    <Cell
      href={`/children/${card.childId}`}
      lead={
        <span
          aria-hidden
          style={{
            width: 30, height: 30, borderRadius: "50%", background: "var(--ios-tint)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, flexShrink: 0,
          }}
        >
          {card.initial}
        </span>
      }
      title={card.name}
      subtitle={
        <>
          {TIER_LABEL[card.ageTier]}{card.age !== null ? ` · Age ${card.age}` : ""}
          <span style={{ display: "block" }}>{card.todaysScheduleItem ?? "Nothing scheduled today"}</span>
          <span style={{ display: "block" }}>
            {card.upcomingDeadline ? `Due: ${card.upcomingDeadline.title}` : "No upcoming deadlines"}
          </span>
          {card.attentionItem && (
            <span style={{ display: "block", color: "var(--ios-orange)" }}>{card.attentionItem}</span>
          )}
        </>
      }
    />
  );
}
