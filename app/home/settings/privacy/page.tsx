export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { LargeTitle, Group, Cell, TabBar, Icons } from "@/components/ios";

interface Row {
  category: string;
  state: "shared" | "private" | "mixed" | "not-saved";
  detail: string;
  href?: string;
  linkLabel?: string;
}

const STATE_LABEL: Record<Row["state"], string> = {
  shared: "Shared",
  private: "Private",
  mixed: "Partial",
  "not-saved": "Not saved",
};
const STATE_COLOR: Record<Row["state"], string> = {
  shared: "var(--ios-green)",
  private: "var(--ios-tint)",
  mixed: "var(--ios-orange)",
  "not-saved": "var(--ios-label-2)",
};

function StateBadge({ state }: { state: Row["state"] }) {
  const color = STATE_COLOR[state];
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, letterSpacing: "0.02em",
      padding: "2px 9px", borderRadius: 999, background: `${color}22`, color,
      whiteSpace: "nowrap",
    }}>
      {STATE_LABEL[state]}
    </span>
  );
}

export default async function PrivacySettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const [circleResult, householdRemindersResult, householdTodosResult, sharedAccountsResult, familyPlansResult] = await Promise.all([
    service.schema("hub").from("family_members").select("member_user_id").eq("user_id", user.id),
    service.schema("hub").from("reminders").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_household", true),
    service.schema("hub").from("todos").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_household", true),
    service.schema("finance").from("manual_account_shares").select("id", { count: "exact", head: true }).eq("owner_user_id", user.id).eq("accepted", true),
    service.schema("bible").from("family_plans").select("id", { count: "exact", head: true }).eq("created_by", user.id),
  ]);

  const circleSize: number = (circleResult.data ?? []).length;
  const householdItemCount = (householdRemindersResult.count ?? 0) + (householdTodosResult.count ?? 0);
  const sharedAccountCount: number = sharedAccountsResult.count ?? 0;
  const familyPlanCount: number = familyPlansResult.count ?? 0;

  const rows: Row[] = [
    {
      category: "Calendar & Responsibilities",
      state: householdItemCount > 0 ? "shared" : "private",
      detail: householdItemCount > 0
        ? `${householdItemCount} reminder${householdItemCount !== 1 ? "s" : ""}/task${householdItemCount !== 1 ? "s" : ""} flagged as household — visible to your circle`
        : "Nothing flagged as household yet — reminders and tasks are private by default",
      href: "/home/family",
      linkLabel: "Manage",
    },
    {
      category: "Meals (planning)",
      state: "shared",
      detail: "Meal plan is always visible to your family circle — a shared \"what's for dinner\" list, separate from your private nutrition log",
      href: "/home/family",
      linkLabel: "View",
    },
    {
      category: "Shopping",
      state: "shared",
      detail: "The shopping list is always visible to and editable by your family circle",
      href: "/home/family",
      linkLabel: "View",
    },
    {
      category: "Household goals",
      state: "shared",
      detail: "Household goals are always visible to your family circle",
      href: "/home/family",
      linkLabel: "View",
    },
    {
      category: "Children",
      state: circleSize > 0 ? "shared" : "private",
      detail: "Parents can see their child's courses and upcoming assignments. Configure exactly which modules each child can access.",
      href: "/home/settings/family",
      linkLabel: "Manage child access",
    },
    {
      category: "Approved financial information",
      state: sharedAccountCount > 0 ? "shared" : "private",
      detail: sharedAccountCount > 0
        ? `${sharedAccountCount} account${sharedAccountCount !== 1 ? "s" : ""} shared — nothing else in Finance is visible to anyone else`
        : "No accounts shared yet — your finances are fully private until you explicitly share an account",
      href: "/finance/dashboard/settings",
      linkLabel: "Manage sharing",
    },
    {
      category: "Career",
      state: "private",
      detail: "Always private. There is no sharing mechanism for career data — not even an option to turn on.",
    },
    {
      category: "Health",
      state: "private",
      detail: "Always private. Nutrition, workouts, medications, and vitals are never visible to anyone else.",
    },
    {
      category: "Mental wellness",
      state: "private",
      detail: "Always private. Mood check-ins are for you only.",
      href: "/health/wellness",
      linkLabel: "Open",
    },
    {
      category: "Spiritual development",
      state: familyPlanCount > 0 ? "mixed" : "private",
      detail: familyPlanCount > 0
        ? `Your personal notes and reading progress stay private. You've started ${familyPlanCount} family reading plan${familyPlanCount !== 1 ? "s" : ""}, visible to those you've shared it with.`
        : "Personal Bible notes and reading progress are private by default. Family reading plans and challenges are opt-in shared.",
      href: "/bible/plans",
      linkLabel: "Open",
    },
    {
      category: "Journal",
      state: "private",
      detail: "Always private, with no sharing mechanism at all — that's the entire point of a journal.",
      href: "/home/journal",
      linkLabel: "Open",
    },
    {
      category: "Personal finances",
      state: "private",
      detail: "Private by default. Only individually shared accounts (see \"Approved financial information\" above) are visible to your circle.",
    },
    {
      category: "Private AI conversations",
      state: "not-saved",
      detail: "Ask Morris and Bible chat aren't saved anywhere — nothing to share because nothing persists after you leave the page.",
    },
  ];

  return (
    <div data-ui="ios">
      <div className="ios-scroll">
        <div className="ios-navbar">
          <Link href="/home/settings" className="ios-back">
            <Icons.ChevronLeft aria-hidden style={{ width: 20, height: 20 }} />
            Settings
          </Link>
        </div>

        <LargeTitle
          title="Sharing & Privacy"
          subtitle={circleSize > 0
            ? "Your circle only sees what's marked Shared or Partial below"
            : "You have no one in your family circle yet, so everything is private"}
        />

        <Group
          header="Every data type"
          footer="Nothing is ever assumed shared. Never assume a family member sees more than what's marked Shared here."
        >
          {rows.map((r) => (
            <Cell
              key={r.category}
              title={r.category}
              subtitle={r.detail}
              trailing={<StateBadge state={r.state} />}
              href={r.href}
              chevron={!!r.href}
            />
          ))}
        </Group>

        <Group footer="See exactly what someone else sees of your data.">
          <Cell title="Preview as a family member" href="/home/family/preview" />
        </Group>

        <div style={{ height: 12 }} />
      </div>
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </div>
  );
}
