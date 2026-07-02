"use client";

import { NavBar, LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";

export default function NewsScreen({ onBack }: { onBack: () => void }) {
  return (
    <>
      <NavBar back={{ label: "More", onBack }} />
      <LargeTitle title="News" subtitle="Your topics, local, and company" />

      <Group header="Top stories">
        <Story title="Fed holds rates steady, signals two cuts later this year" source="Reuters" time="32m" />
        <Story title="New AI model benchmarks spark debate over evaluation methods" source="The Verge" time="1h" />
        <Story title="Markets edge higher as tech earnings beat estimates" source="Bloomberg" time="2h" />
      </Group>

      <Group header="Indianapolis">
        <Story title="Downtown transit expansion breaks ground next month" source="IndyStar" time="3h" icon={<Icons.HomeIcon />} color="#4D6B3A" />
        <Story title="Colts finalize preseason schedule" source="WISH-TV" time="5h" icon={<Icons.HomeIcon />} color="#4D6B3A" />
      </Group>

      <Group header="Eli Lilly · LLY" footer="Your employer feed. Tap to open the ticker.">
        <Cell
          lead={<IconBadge color="var(--ios-finance)"><Icons.TrendUpIcon /></IconBadge>}
          title="Lilly's weight-loss pill posts strong trial data"
          subtitle="WSJ · 1h"
          trailing={<span className="ios-num" style={{ color: "var(--ios-green)", fontWeight: 600 }}>$892.60 ▲0.8%</span>}
          chevron={false}
          href="/investments/stocks"
        />
      </Group>

      <Group header="Following">
        <Cell lead={<IconBadge color="#9A3B2A"><Icons.NewsIcon /></IconBadge>} title="Manage sources & topics" href="/news" />
      </Group>

      <div style={{ height: 12 }} />
    </>
  );
}

function Story({ title, source, time, icon, color = "var(--ios-tint)" }: { title: string; source: string; time: string; icon?: React.ReactNode; color?: string }) {
  return (
    <Cell
      lead={<IconBadge color={color}>{icon ?? <Icons.NewsIcon />}</IconBadge>}
      title={title}
      subtitle={`${source} · ${time}`}
      href="/news"
    />
  );
}
