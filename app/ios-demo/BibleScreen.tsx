"use client";

import Link from "next/link";
import { NavBar, LargeTitle, Group, Cell, IconBadge, AskMorrisPill, Icons } from "@/components/ios";

export default function BibleScreen({ onBack }: { onBack: () => void }) {
  return (
    <>
      <NavBar back={{ label: "More", onBack }} />
      <LargeTitle title="Bible" subtitle="Reading plans · notes · reflection" />

      {/* Today's reading hero */}
      <div className="ios-list" style={{ margin: "8px 16px 0", padding: 16 }}>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Today · Day 42</div>
        <div className="ios-title-2" style={{ marginTop: 4 }}>Romans 8</div>
        <div className="ios-subhead" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>“There is now no condemnation for those who are in Christ Jesus.”</div>
        <Link href="/bible/read/romans/8" className="ios-btn ios-btn--primary" style={{ marginTop: 14 }}>Continue reading</Link>
      </div>

      <Group header="Plan">
        <Cell lead={<IconBadge color="#3B5C7F"><Icons.BookIcon /></IconBadge>} title="The Story of Redemption" subtitle="42 of 90 days · 47% complete" href="/bible/plans" />
        <Cell lead={<IconBadge color="var(--ios-green)"><Icons.ChecklistIcon /></IconBadge>} title="Reading streak" trailing={<span className="ios-num">18 days</span>} chevron={false} />
      </Group>

      <Group header="Study">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.SparkleIcon /></IconBadge>} title="Ask about this passage" subtitle="AI study companion" href="/bible/chat" />
        <Cell lead={<IconBadge color="#6B5B95"><Icons.ComposeIcon /></IconBadge>} title="Notes & highlights" trailing="24" href="/bible/notes" />
        <Cell lead={<IconBadge color="#8B6A47"><Icons.BookIcon /></IconBadge>} title="Search Scripture" href="/bible/search" />
      </Group>

      <AskMorrisPill placeholder="Ask about today's reading…" href="/bible/chat" />

      <div style={{ height: 12 }} />
    </>
  );
}
