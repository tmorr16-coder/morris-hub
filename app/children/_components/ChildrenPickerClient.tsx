"use client";

import type { ChildCardSummary } from "../_lib/children";
import ChildProfileCard from "./ChildProfileCard";

export default function ChildrenPickerClient({ cards }: { cards: ChildCardSummary[] }) {
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {cards.map((c) => (
          <ChildProfileCard key={c.childId} card={c} />
        ))}
      </div>
      <a href="/home/settings/family" style={{
        display: "inline-block", fontSize: 13, fontWeight: 600, color: "var(--color-accent)",
        textDecoration: "none", fontFamily: "var(--font-geist, system-ui), sans-serif",
      }}>
        + Add a child →
      </a>
    </div>
  );
}
