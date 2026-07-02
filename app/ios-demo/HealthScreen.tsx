"use client";

import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";
import { Rings, Circle } from "./ui";

export default function HealthScreen() {
  return (
    <>
      <LargeTitle title="Health" subtitle="Wednesday, July 2" avatarInitial="T" onCompose={() => {}} />

      {/* Rings hero */}
      <div className="ios-list" style={{ margin: "14px 16px 0", padding: 16, display: "flex", alignItems: "center", gap: 18 }}>
        <Rings move={0.72} exercise={0.55} stand={0.9} size={96} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Stat color="#FA114F" label="Move" value="720" unit="/ 1,000 cal" />
          <Stat color="#92E82A" label="Exercise" value="33" unit="/ 60 min" />
          <Stat color="#1AD5DE" label="Stand" value="11" unit="/ 12 hr" />
        </div>
      </div>

      <Group header="Today">
        <Cell lead={<IconBadge color="var(--ios-green)"><Icons.HeartIcon /></IconBadge>} title="Steps" trailing={<span className="ios-num">8,240</span>} chevron={false} />
        <Cell lead={<IconBadge color="#FA114F"><Icons.HeartIcon /></IconBadge>} title="Resting heart rate" trailing={<span className="ios-num">58 bpm</span>} chevron={false} />
        <Cell lead={<IconBadge color="#5E5CE6"><Icons.MoonIcon /></IconBadge>} title="Sleep" trailing={<span className="ios-num">7h 12m</span>} chevron={false} />
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.TrendUpIcon /></IconBadge>} title="Weight" subtitle="Down 0.6 lb from yesterday" trailing={<span className="ios-num">182.4 lb</span>} href="/health/progress" />
      </Group>

      <Group header="Medications">
        <Cell lead={<Circle />} title="Zepbound (Mounjaro)" subtitle="7.5 mg · weekly dose due today" chevron={false} />
        <Cell lead={<Circle checked />} title={<s style={{ color: "var(--ios-label-2)" }}>Vitamin D</s>} subtitle="Taken 8:02 AM" chevron={false} />
      </Group>

      <Group header="Training">
        <Cell lead={<IconBadge color="var(--ios-green)"><Icons.DumbbellIcon /></IconBadge>} title="Upper Body" subtitle="Scheduled · 6:00 PM · 8 exercises" trailing={<span style={{ color: "var(--ios-tint)", fontWeight: 600 }}>Start</span>} href="/health/train" />
      </Group>

      {/* Quick log */}
      <div style={{ display: "flex", gap: 10, padding: "14px 16px 0" }}>
        <QuickLog label="Log weight" icon={<Icons.TrendUpIcon />} />
        <QuickLog label="Log workout" icon={<Icons.DumbbellIcon />} />
        <QuickLog label="Log dose" icon={<Icons.PillIcon />} />
      </div>

      <div style={{ height: 12 }} />
    </>
  );
}

function Stat({ color, label, value, unit }: { color: string; label: string; value: string; unit: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <span className="ios-subhead" style={{ color: "var(--ios-label-2)", width: 62 }}>{label}</span>
      <span className="ios-headline ios-num">{value}</span>
      <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>{unit}</span>
    </div>
  );
}

function QuickLog({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <button className="ios-list" style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, margin: 0, color: "var(--ios-tint)" }}>
      <span style={{ display: "flex", width: 22, height: 22 }}>{icon}</span>
      <span className="ios-caption" style={{ color: "var(--ios-label)" }}>{label}</span>
    </button>
  );
}
