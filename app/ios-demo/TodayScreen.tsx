"use client";

import { useState } from "react";
import {
  LargeTitle, Group, Cell, IconBadge,
  GlanceGrid, GlanceTile, Segmented, SeverityBadge, AskMorrisPill, Icons,
} from "@/components/ios";
import { Circle, Avatar } from "./ui";

export default function TodayScreen() {
  const [mode, setMode] = useState<"family" | "personal">("family");

  return (
    <>
      <LargeTitle
        title="Today"
        subtitle="Wednesday, July 2 · Good morning, Terry"
        avatarInitial="T"
        onCompose={() => {}}
      />

      <Segmented
        ariaLabel="Scope"
        value={mode}
        onChange={setMode}
        options={[
          { value: "family", label: "Family" },
          { value: "personal", label: "Personal" },
        ]}
      />

      <GlanceGrid>
        <GlanceTile label="Calendar" icon={<Icons.CalendarIcon />} value="Soccer" sub="Next · 4:30 PM" href="/home/family/calendar" />
        <GlanceTile label="Reminders" badge={3} value="3 due" sub="Duke Energy · 5 PM first" href="/home" accent="var(--ios-orange)" />
        <GlanceTile label="Health" icon={<Icons.HeartIcon />} value="8,240" sub="steps · Workout 6 PM" href="/health" accent="var(--ios-green)" />
        <GlanceTile label="Money" icon={<Icons.WalletIcon />} value="$482,300" sub="+$1,240 today" href="/finance/dashboard" accent="var(--ios-finance)" />
      </GlanceGrid>

      <AskMorrisPill />

      <Group header="Needs attention" id="needs-attention">
        <Cell lead={<IconBadge color="var(--ios-red)"><Icons.DumbbellIcon /></IconBadge>} title="Missed Upper Body workout" subtitle={<><SeverityBadge level="urgent" /> · was scheduled Jul 1</>} href="/health/train" />
        <Cell lead={<IconBadge color="var(--ios-orange)"><Icons.CalendarIcon /></IconBadge>} title="Overlapping events today" subtitle={<><SeverityBadge level="today" /> · 2 events within 30 min</>} href="/home" />
        <Cell lead={<IconBadge color="var(--ios-finance)"><Icons.WalletIcon /></IconBadge>} title="Duke Energy bill" subtitle={<><SeverityBadge level="today" /> · payment due today · 5:00 PM</>} href="/finance/dashboard" />
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.BriefcaseIcon /></IconBadge>} title="Emma's Biology quiz" subtitle={<><SeverityBadge level="week" /> · due Jul 5</>} href="/home/me/courses" />
      </Group>

      <Group header="Today's plan" id="today-plan">
        {[
          { t: "8:00 AM", l: "Take Mounjaro", c: "var(--ios-green)", icon: <Icons.PillIcon /> },
          { t: "9:30 AM", l: "Standup", c: "var(--ios-tint)", icon: <Icons.BriefcaseIcon /> },
          { t: "4:30 PM", l: "Soccer practice — Emma", c: "var(--ios-orange)", icon: <Icons.PeopleIcon /> },
          { t: "6:00 PM", l: "Upper Body workout", c: "var(--ios-green)", icon: <Icons.DumbbellIcon /> },
        ].map((r) => (
          <Cell key={r.l} insetSeparator lead={<span className="ios-num ios-footnote" style={{ width: 62, color: "var(--ios-label-2)" }}>{r.t}</span>} title={r.l} trailing={<IconBadge color={r.c}>{r.icon}</IconBadge>} chevron={false} />
        ))}
        <Cell insetSeparator lead={<span className="ios-footnote" style={{ width: 62, color: "var(--ios-label-2)" }}>Due today</span>} title="Renew car registration" chevron={false} />
      </Group>

      <Group header="My priorities" id="priorities">
        <Cell lead={<Circle />} title="Call plumber about leak" subtitle={<span style={{ color: "var(--ios-red)" }}>High priority</span>} chevron={false} />
        <Cell lead={<Circle />} title="Review Q3 budget" chevron={false} />
        <Cell lead={<Circle checked />} title={<s style={{ color: "var(--ios-label-2)" }}>Buy Emma&apos;s birthday gift</s>} chevron={false} />
      </Group>

      {mode === "family" && (
        <Group header="Family" id="family">
          {[
            { n: "Terry (you)", s: "2 tasks today", c: "var(--ios-tint)", i: "T" },
            { n: "Sarah", s: "All clear", c: "#B565A7", i: "S" },
            { n: "Emma", s: "Quiz Jul 5 · soccer 4:30", c: "#E8607A", i: "E" },
            { n: "Jack", s: "All clear", c: "var(--ios-green)", i: "J" },
          ].map((m) => (
            <Cell key={m.n} lead={<Avatar color={m.c} initial={m.i} />} title={m.n} subtitle={m.s} href="/home/family" />
          ))}
        </Group>
      )}

      <div style={{ height: 12 }} />
    </>
  );
}
