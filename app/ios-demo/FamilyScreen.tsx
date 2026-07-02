"use client";

import { LargeTitle, Group, Cell, IconBadge, Segmented, Icons } from "@/components/ios";
import { Avatar, WeekStrip } from "./ui";
import { useState } from "react";

const M = {
  terry: "var(--ios-tint)",
  sarah: "#B565A7",
  emma: "#E8607A",
  jack: "#34A56F",
};

export default function FamilyScreen() {
  const [view, setView] = useState<"week" | "month">("week");

  return (
    <>
      <LargeTitle title="Family" subtitle="Your circle · week of Jun 30" avatarInitial="T" onCompose={() => {}} />

      <Segmented
        ariaLabel="Calendar view"
        value={view}
        onChange={setView}
        options={[
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
      />

      <WeekStrip
        days={[
          { label: "Mon", date: 30, dots: [M.terry] },
          { label: "Tue", date: 1, dots: [M.jack] },
          { label: "Wed", date: 2, selected: true, dots: [M.emma, M.terry, M.terry] },
          { label: "Thu", date: 3, dots: [M.jack] },
          { label: "Fri", date: 4, dots: [M.terry] },
          { label: "Sat", date: 5, dots: [M.emma, M.sarah] },
          { label: "Sun", date: 6 },
        ]}
      />

      {/* Events grouped by day */}
      <Group header="Today · Wed Jul 2">
        <EventCell time="4:30 PM" who="emma" title="Soccer practice" sub="Emma · Northside fields" />
        <EventCell time="5:00 PM" who="terry" title="Duke Energy bill due" sub="Terry · bill" />
        <EventCell time="6:00 PM" who="terry" title="Upper Body workout" sub="Terry · health" />
      </Group>

      <Group header="Thursday · Jul 3">
        <EventCell time="8:00 AM" who="jack" title="Dentist checkup" sub="Jack · Dr. Alvarez" />
      </Group>

      <Group header="Saturday · Jul 5">
        <EventCell time="All day" who="emma" title="Biology quiz" sub="Emma · Period 3" />
        <EventCell time="10:00 AM" who="sarah" title="Farmers market run" sub="Sarah" />
      </Group>

      {/* Members */}
      <Group header="Members" footer="Tap a member to see their schedule and tasks.">
        <Cell lead={<Avatar color={M.terry} initial="T" />} title="Terry (you)" subtitle="2 tasks today" href="/home/me" />
        <Cell lead={<Avatar color={M.sarah} initial="S" />} title="Sarah" subtitle="All clear today" href="/home/family/preview" />
        <Cell lead={<Avatar color={M.emma} initial="E" />} title="Emma" subtitle="Quiz Jul 5 · soccer 4:30" href="/home/family/preview" />
        <Cell lead={<Avatar color={M.jack} initial="J" />} title="Jack" subtitle="Dentist Thu 8:00 AM" href="/home/family/preview" />
      </Group>

      {/* Shared lists */}
      <Group header="Shared">
        <Cell lead={<IconBadge color="#34A56F"><Icons.CartIcon /></IconBadge>} title="Shopping list" trailing="12" href="/home/family" />
        <Cell lead={<IconBadge color="#E8734A"><Icons.ForkKnifeIcon /></IconBadge>} title="Meal plan" subtitle="Tonight · Tacos" href="/home/family" />
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.ChecklistIcon /></IconBadge>} title="Household tasks" trailing="3 open" href="/home/family" />
        <Cell lead={<IconBadge color="#8E8E93"><Icons.HomeIcon /></IconBadge>} title="Household goals" subtitle="Save for summer trip · 68%" href="/home/family" />
      </Group>

      <div style={{ height: 12 }} />
    </>
  );
}

function EventCell({ time, who, title, sub }: { time: string; who: keyof typeof M; title: string; sub: string }) {
  return (
    <Cell
      insetSeparator
      lead={
        <span style={{ display: "flex", alignItems: "center", gap: 8, width: 78 }}>
          <span style={{ width: 4, height: 30, borderRadius: 2, background: M[who], flexShrink: 0 }} />
          <span className="ios-num ios-footnote" style={{ color: "var(--ios-label-2)" }}>{time}</span>
        </span>
      }
      title={title}
      subtitle={sub}
      chevron={false}
    />
  );
}
