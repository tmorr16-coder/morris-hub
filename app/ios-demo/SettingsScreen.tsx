"use client";

import { NavBar, LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";
import { Avatar } from "./ui";

export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <>
      <NavBar back={{ label: "More", onBack }} />
      <LargeTitle title="Settings" />

      {/* Profile card */}
      <div className="ios-list" style={{ margin: "8px 16px 0", padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar color="var(--ios-tint)" initial="T" size={56} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="ios-title-3">Terry Morris</span>
          <span className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>tmorr16@gmail.com · Admin</span>
        </div>
      </div>

      <Group header="Family & sharing">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.PeopleIcon /></IconBadge>} title="Family circle" subtitle="Sarah, Emma, Jack" href="/home/settings/family" />
        <Cell lead={<IconBadge color="var(--ios-green)"><Icons.HomeIcon /></IconBadge>} title="Shared with me" href="/home/family" />
        <Cell lead={<IconBadge color="#8E8E93"><Icons.GearIcon /></IconBadge>} title="Privacy & data" href="/home/settings/privacy" />
      </Group>

      <Group header="App">
        <Cell lead={<IconBadge color="#5E5CE6"><Icons.MoonIcon /></IconBadge>} title="Appearance" trailing="Automatic" href="/home/settings" />
        <Cell lead={<IconBadge color="var(--ios-red)"><Icons.BellIcon /></IconBadge>} title="Notifications" href="/home/settings" />
        <Cell lead={<IconBadge color="var(--ios-finance)"><Icons.WalletIcon /></IconBadge>} title="Connected accounts" subtitle="SimpleFIN · Oura · Withings" href="/health/settings/integrations" />
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.HomeIcon /></IconBadge>} title="Home screen widgets" href="/home/settings" />
      </Group>

      <Group header="Access">
        <Cell lead={<IconBadge color="#8E8E93"><Icons.GearIcon /></IconBadge>} title="Modules & permissions" href="/home/settings" />
        <Cell title={<span style={{ color: "var(--ios-red)" }}>Sign out</span>} href="/login" chevron={false} />
      </Group>

      <div style={{ height: 12 }} />
    </>
  );
}
