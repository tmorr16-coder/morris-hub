export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import { isCurrentUserAdmin } from "@/lib/supabase/auth-utils";
import { IOSScreen, LargeTitle, Group, Cell, IconBadge, TabBar, Icons } from "@/components/ios";

export default async function MorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const prefs = await getPreferences(user.id);
  const access = prefs.app_access;
  const can = (key: string) => !access?.length || access.includes(key);
  const isAdmin = await isCurrentUserAdmin();

  return (
    <IOSScreen>
      <LargeTitle brand title="More" avatarInitial={(user.user_metadata?.full_name || user.email || "?")[0]?.toUpperCase()} />

      <Group header="Money">
        {can("finance") && <Cell lead={<IconBadge color="var(--ios-money)"><Icons.WalletIcon /></IconBadge>} title="Finances" subtitle="Net worth · accounts · spending" href="/finance/dashboard" />}
        {can("investments") && <Cell lead={<IconBadge color="var(--ios-investments)"><Icons.TrendUpIcon /></IconBadge>} title="Investments" subtitle="Portfolio · research · paper trading" href="/investments" />}
        {can("finance") && <Cell lead={<IconBadge color="var(--ios-money)"><Icons.ChartIcon /></IconBadge>} title="Retirement" href="/finance/retirement" />}
        {can("finance") && <Cell lead={<IconBadge color="var(--ios-money)"><Icons.ChecklistIcon /></IconBadge>} title="Tax" subtitle="Estimator · strategy · rates" href="/finance/tax" />}
      </Group>

      <Group header="Learn & grow">
        {can("career") && <Cell lead={<IconBadge color="var(--ios-career)"><Icons.BriefcaseIcon /></IconBadge>} title="Career" subtitle="Advisor · goals · certifications" href="/career" />}
        {can("student-success") && <Cell lead={<IconBadge color="var(--ios-career)"><Icons.BookIcon /></IconBadge>} title="Student success" subtitle="Courses · LSAT prep" href="/home/me/courses" />}
        {can("bible") && <Cell lead={<IconBadge color="var(--ios-bible)"><Icons.BookIcon /></IconBadge>} title="Bible" subtitle="Reading plans · notes · study" href="/bible/dashboard" />}
      </Group>

      <Group header="Explore">
        <Cell lead={<IconBadge color="var(--ios-travel)"><Icons.PlaneIcon /></IconBadge>} title="Travel" subtitle="Flights · hotels · loyalty · price alerts" href="/travel" />
      </Group>

      <Group header="Stay informed">
        <Cell lead={<IconBadge color="var(--ios-news)"><Icons.NewsIcon /></IconBadge>} title="News" subtitle="Topics · local · company" href="/news" />
        <Cell lead={<IconBadge color="var(--ios-morris)"><Icons.SparkleIcon /></IconBadge>} title="Ask Morris" subtitle="Your AI across everything" href="/home/ask" />
        <Cell lead={<IconBadge color="var(--ios-family)"><Icons.SparkleIcon /></IconBadge>} title="Ask the panel" subtitle="Claude · Gemini · GPT, side by side" href="/home/ask/compare" />
      </Group>

      <Group header="You">
        <Cell lead={<IconBadge color="var(--ios-orange)"><Icons.ChecklistIcon /></IconBadge>} title="Tasks & reminders" subtitle="To-dos, bills, appointments" href="/home/tasks" />
        <Cell lead={<IconBadge color="var(--ios-morris)"><Icons.PersonIcon /></IconBadge>} title="Me" subtitle="Your profile & progress" href="/home/me" />
        <Cell lead={<IconBadge color="var(--ios-family)"><Icons.ComposeIcon /></IconBadge>} title="Journal" href="/home/journal" />
        <Cell lead={<IconBadge color="var(--ios-children)"><Icons.PeopleIcon /></IconBadge>} title="Children" href="/children" />
      </Group>

      <Group header="Account">
        <Cell lead={<IconBadge color="#8E8E93"><Icons.GearIcon /></IconBadge>} title="Settings" subtitle="Integrations · modules · appearance" href="/settings" />
        <Cell lead={<IconBadge color="#8E8E93"><Icons.PeopleIcon /></IconBadge>} title="Family & sharing" href="/home/settings/family" />
        {isAdmin && <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.PersonIcon /></IconBadge>} title="Admin" subtitle="Access, approvals & invites" href="/home/admin" />}
      </Group>

      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
