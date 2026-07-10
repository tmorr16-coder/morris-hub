"use client";

import { NavBar, LargeTitle, Group, Cell, IconBadge, AskMorrisPill, Icons } from "@/components/ios";

export default function CareerScreen({ onBack }: { onBack: () => void }) {
  return (
    <>
      <NavBar back={{ label: "More", onBack }} />
      <LargeTitle title="Career" subtitle="Your personal advisor" />

      <AskMorrisPill placeholder="Ask your career advisor…" href="/career/advisor" />

      <Group header="Active goals" footer="3 active · 1 due this quarter">
        <Cell lead={<IconBadge color="#2A6049"><Icons.TrendUpIcon /></IconBadge>} title="Move into a senior IC role" subtitle="Long-term · on track" href="/career/goals" />
        <Cell lead={<IconBadge color="var(--ios-orange)"><Icons.BriefcaseIcon /></IconBadge>} title="Lead the Q3 platform launch" subtitle="This quarter · due Sep 30" href="/career/goals" />
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.BookIcon /></IconBadge>} title="Finish PMP certification" subtitle="42% · exam window Aug" href="/career/certifications" />
      </Group>

      <Group header="This week">
        <Cell lead={<IconBadge color="#6B5B95"><Icons.ChecklistIcon /></IconBadge>} title="1:1 prep — growth conversation" subtitle="Thu · before your manager sync" href="/career/timeline" />
        <Cell lead={<IconBadge color="#2A6049"><Icons.PeopleIcon /></IconBadge>} title="Reconnect with a mentor" subtitle="Reach out to 1 person" href="/career/advisor" />
      </Group>

      <Group header="Grow">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.BriefcaseIcon /></IconBadge>} title="Advisor" subtitle="AI coaching on your resume & goals" href="/career/advisor" />
        <Cell lead={<IconBadge color="#8B6A47"><Icons.BookIcon /></IconBadge>} title="Certifications" href="/career/certifications" />
        <Cell lead={<IconBadge color="#8E8E93"><Icons.ChartIcon /></IconBadge>} title="Timeline & milestones" href="/career/timeline" />
      </Group>

      <div style={{ height: 12 }} />
    </>
  );
}
