export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";
import AppearanceAccount from "./_components/AppearanceAccount";

// Live connection status for the three fitness integrations. Fully defensive —
// any missing table just reports "Not connected" rather than throwing.
async function fitnessStatus(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  let oura = false, withings = false, apple = false;
  try {
    const { data } = await db.from("oura_tokens").select("access_token").eq("user_id", userId).maybeSingle();
    oura = !!data?.access_token;
  } catch { /* table may not exist */ }
  if (!oura && process.env.OURA_ACCESS_TOKEN) oura = true;
  try {
    const { data } = await db.from("withings_tokens").select("updated_at").eq("user_id", userId).maybeSingle();
    withings = data != null;
  } catch { /* table may not exist */ }
  try {
    const { count } = await db.from("apple_health_metrics").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("source", "apple_health");
    apple = (count ?? 0) > 0;
  } catch { /* table may not exist */ }
  return { oura, withings, apple };
}

function StatusBadge({ on }: { on: boolean }) {
  return (
    <span className="ios-footnote" style={{ color: on ? "var(--ios-green)" : "var(--ios-label-3)", display: "inline-flex", alignItems: "center", gap: 6 }}>
      {on && <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ios-green)" }} />}
      {on ? "Connected" : "Set up"}
    </span>
  );
}

export default async function SettingsHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = user.email ?? "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const name = ((user.user_metadata as any)?.full_name as string | undefined) ?? email.split("@")[0] ?? "You";
  const initial = (name[0] ?? "U").toUpperCase();

  const fit = await fitnessStatus(user.id);

  return (
    <div className="ios-scroll">
      <LargeTitle title="Settings" subtitle="Everything in one place" />

      {/* Profile card */}
      <div className="ios-list" style={{ margin: "8px 16px 0", padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
        <span aria-hidden style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--ios-tint)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 600 }}>{initial}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span className="ios-title-3">{name}</span>
          <span className="ios-subhead" style={{ color: "var(--ios-label-2)", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</span>
        </div>
      </div>

      {/* Fitness integrations — set once, manage here */}
      <Group header="Devices & fitness" footer="Connect once. Oura, Withings, and Apple Health sync automatically and appear across Health.">
        <Cell lead={<IconBadge color="#7B61FF"><Icons.HeartIcon /></IconBadge>} title="Oura Ring" subtitle="Sleep, readiness, HRV" trailing={<StatusBadge on={fit.oura} />} href="/health/settings/integrations" />
        <Cell lead={<IconBadge color="#00B2A9"><Icons.ChartIcon /></IconBadge>} title="Withings" subtitle="Weight, body composition" trailing={<StatusBadge on={fit.withings} />} href="/health/settings/integrations" />
        <Cell lead={<IconBadge color="#8E8E93"><Icons.DumbbellIcon /></IconBadge>} title="Apple Health / Watch" subtitle="Steps, workouts, heart rate" trailing={<StatusBadge on={fit.apple} />} href="/health/settings/integrations" />
      </Group>

      {/* Connected accounts */}
      <Group header="Connected accounts">
        <Cell lead={<IconBadge color="var(--ios-finance)"><Icons.WalletIcon /></IconBadge>} title="Banks & finances" subtitle="Plaid · accounts, transactions" href="/finance/dashboard/settings" />
        <Cell lead={<IconBadge color="#0077B5"><Icons.BriefcaseIcon /></IconBadge>} title="LinkedIn" subtitle="Career profile & experience" href="/career/settings" />
      </Group>

      {/* Module settings */}
      <Group header="Module settings">
        <Cell lead={<IconBadge color="var(--ios-green)"><Icons.HeartIcon /></IconBadge>} title="Health" subtitle="Profile, goals, integrations" href="/health/settings/integrations" />
        <Cell lead={<IconBadge color="var(--ios-finance)"><Icons.WalletIcon /></IconBadge>} title="Finance" subtitle="PIN, sharing, accounts" href="/finance/dashboard/settings" />
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.BriefcaseIcon /></IconBadge>} title="Career" subtitle="LinkedIn, notifications, LSAT" href="/career/settings" />
        <Cell lead={<IconBadge color="#3B5C7F"><Icons.BookIcon /></IconBadge>} title="Bible" subtitle="Translation, font, reminders" href="/bible/settings" />
        <Cell lead={<IconBadge color="var(--ios-orange)"><Icons.ChecklistIcon /></IconBadge>} title="Courses" subtitle="Reminders & study schedule" href="/home/me/courses/settings" />
      </Group>

      {/* Home & family */}
      <Group header="Home & family">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.HomeIcon /></IconBadge>} title="Home screen & widgets" subtitle="Layout, news, topics" href="/home/settings" />
        <Cell lead={<IconBadge color="var(--ios-orange)"><Icons.PeopleIcon /></IconBadge>} title="Family circle" subtitle="Members & sharing" href="/home/settings/family" />
        <Cell lead={<IconBadge color="#8E8E93"><Icons.GearIcon /></IconBadge>} title="Privacy & data" href="/home/settings/privacy" />
      </Group>

      <AppearanceAccount />

      <div style={{ height: 24 }} />
    </div>
  );
}
