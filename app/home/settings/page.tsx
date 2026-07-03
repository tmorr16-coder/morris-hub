export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import { IOSScreen, LargeTitle, Group, Cell, IconBadge, TabBar, Icons } from "@/components/ios";
import SettingsForm from "./_components/SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const prefs = await getPreferences(user.id);
  const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "You";
  const initial = name[0]?.toUpperCase() ?? "T";

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

      {/* Preferences editor — kept intact, iOS-styled chrome */}
      <section style={{ marginTop: 22 }}>
        <h2 className="ios-group-header">Preferences</h2>
        <div style={{ padding: "0 16px" }}>
          <SettingsForm initialPrefs={prefs} />
        </div>
      </section>

      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
