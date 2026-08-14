export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IOSScreen, LargeTitle, Group, Cell, IconBadge, TabBar, Icons } from "@/components/ios";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "You";
  const initial = (user.user_metadata?.full_name || user.email || "?")[0]?.toUpperCase();

  return (
    <IOSScreen>
      <LargeTitle title="Settings" />

      {/* Profile card */}
      <div className="ios-list" style={{ margin: "8px 16px 0", padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
        <span aria-hidden style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--ios-tint)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 600, flexShrink: 0 }}>
          {initial}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span className="ios-title-3">{name}</span>
          {user.email && <span className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>{user.email}</span>}
        </div>
      </div>

      <Group header="Sharing">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.PeopleIcon /></IconBadge>} title="Family circle" subtitle="Manage who you share accounts and data with" href="/home/settings/family" />
        <Cell lead={<IconBadge color="#8E8E93"><Icons.GearIcon /></IconBadge>} title="Sharing & privacy" subtitle="See exactly what's shared and what's private" href="/home/settings/privacy" />
      </Group>

      <Group header="Preferences">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.GearIcon /></IconBadge>} title="Modules" subtitle="Which apps appear in your menu" href="/home/settings/modules" />
        <Cell lead={<IconBadge color="#E8843C"><Icons.HomeIcon /></IconBadge>} title="Home & reminders" subtitle="Location · reminder categories" href="/home/settings/general" />
        <Cell lead={<IconBadge color="#C97A3A"><Icons.TrendUpIcon /></IconBadge>} title="Investing" subtitle="Watchlist tickers · categories" href="/home/settings/investing" />
        <Cell lead={<IconBadge color="#9A3B2A"><Icons.NewsIcon /></IconBadge>} title="News" subtitle="Local cities · subscriptions · topics" href="/home/settings/news" />
        <Cell lead={<IconBadge color="#2A7B4A"><Icons.ChartIcon /></IconBadge>} title="Sports" subtitle="Teams to track" href="/home/settings/sports" />
        <Cell lead={<IconBadge color="#5E5CE6"><Icons.SparkleIcon /></IconBadge>} title="Read-aloud voice" subtitle="Text-to-speech voice & speed" href="/home/settings/voice" />
      </Group>

      <Group header="Appearance & account">
        <Cell lead={<IconBadge color="#8E8E93"><Icons.GearIcon /></IconBadge>} title="Appearance & integrations" subtitle="Theme · timezone · connected services" href="/settings" />
      </Group>

      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
