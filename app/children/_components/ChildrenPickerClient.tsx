"use client";

import type { ChildCardSummary } from "../_lib/children";
import { Group, Cell, IconBadge, Icons } from "@/components/ios";
import ChildProfileCard from "./ChildProfileCard";

export default function ChildrenPickerClient({ cards }: { cards: ChildCardSummary[] }) {
  return (
    <>
      <Group header={`Kids · ${cards.length}`}>
        {cards.map((c) => (
          <ChildProfileCard key={c.childId} card={c} />
        ))}
      </Group>
      <Group>
        <Cell
          href="/home/settings/family"
          lead={<IconBadge color="var(--ios-tint)"><Icons.PlusIcon /></IconBadge>}
          title="Add a child"
        />
      </Group>
    </>
  );
}
