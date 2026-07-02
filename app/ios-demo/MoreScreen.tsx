"use client";

import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";

export default function MoreScreen({ onOpenMoney, onOpenAsk, onOpenInvest, onOpenNews, onOpenCareer, onOpenBible, onOpenSettings }: { onOpenMoney?: () => void; onOpenAsk?: () => void; onOpenInvest?: () => void; onOpenNews?: () => void; onOpenCareer?: () => void; onOpenBible?: () => void; onOpenSettings?: () => void }) {
  return (
    <>
      <LargeTitle title="More" avatarInitial="T" />

      <Group header="Money">
        <Cell lead={<IconBadge color="var(--ios-finance)"><Icons.WalletIcon /></IconBadge>} title="Finances" subtitle="Net worth $482,300 · +$1,240 today" onClick={onOpenMoney} />
        <Cell lead={<IconBadge color="#C97A3A"><Icons.TrendUpIcon /></IconBadge>} title="Investments" subtitle="Portfolio · research · paper trading" onClick={onOpenInvest} />
        <Cell lead={<IconBadge color="#8B6A47"><Icons.ChartIcon /></IconBadge>} title="Retirement" href="/finance/retirement" />
      </Group>

      <Group header="Learn & grow">
        <Cell lead={<IconBadge color="#2A6049"><Icons.BriefcaseIcon /></IconBadge>} title="Career" subtitle="Advisor · goals · certifications" onClick={onOpenCareer} />
        <Cell lead={<IconBadge color="#6B5B95"><Icons.BookIcon /></IconBadge>} title="Student success" subtitle="Courses · LSAT prep" href="/home/me/courses" />
        <Cell lead={<IconBadge color="#3B5C7F"><Icons.BookIcon /></IconBadge>} title="Bible" subtitle="Reading plans · notes · chat" onClick={onOpenBible} />
      </Group>

      <Group header="Stay informed">
        <Cell lead={<IconBadge color="#9A3B2A"><Icons.NewsIcon /></IconBadge>} title="News" subtitle="Topics · local · company" onClick={onOpenNews} />
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.SparkleIcon /></IconBadge>} title="Ask Morris" subtitle="Your AI across everything" onClick={onOpenAsk} />
      </Group>

      <Group header="Account">
        <Cell lead={<IconBadge color="#8E8E93"><Icons.PeopleIcon /></IconBadge>} title="Family & sharing" href="/home/settings/family" />
        <Cell lead={<IconBadge color="#8E8E93"><Icons.GearIcon /></IconBadge>} title="Settings" onClick={onOpenSettings} />
      </Group>

      <div style={{ height: 12 }} />
    </>
  );
}
