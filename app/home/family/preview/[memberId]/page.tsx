export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { IOSScreen, LargeTitle, Group, Cell, IconBadge, TabBar, Icons } from "@/components/ios";

export default async function PreviewAsMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Look up by the family_members primary key — works for both account-holding
  // members and managed (no-login) children, whose member_user_id is null.
  const { data: memberRow } = await service.schema("hub").from("family_members")
    .select("id, member_user_id, display_name, nickname")
    .eq("user_id", user.id).eq("id", memberId).maybeSingle();
  if (!memberRow) notFound();

  // Assignment/sharing targets reference auth.users, so they only apply to
  // account-holding members. For a managed child (no auth id) these are empty.
  const authTarget: string | null = memberRow.member_user_id ?? null;

  let memberLabel: string = memberRow.display_name ?? memberRow.nickname ?? "This person";
  if (!memberRow.display_name && !memberRow.nickname && authTarget) {
    const { data: authUser } = await service.auth.admin.getUserById(authTarget);
    memberLabel = authUser?.user?.user_metadata?.full_name
      ?? authUser?.user?.user_metadata?.name
      ?? authUser?.user?.email
      ?? "This person";
  }

  const { data: myFamilyPlanIds } = await service.schema("bible").from("family_plans")
    .select("id").eq("created_by", user.id);
  const myFamilyPlanIdList: string[] = (myFamilyPlanIds ?? []).map((p: { id: string }) => p.id);

  const [householdRemindersResult, assignedRemindersResult, householdTodosResult, assignedTodosResult, sharedAccountsResult, familyPlansResult] = await Promise.all([
    // My household-flagged reminders — visible to everyone in my circle, including this member
    service.schema("hub").from("reminders")
      .select("id, title, due_at, category")
      .eq("user_id", user.id).eq("is_household", true).is("completed_at", null),
    // Reminders I've specifically assigned to this member (account-holders only)
    authTarget
      ? service.schema("hub").from("reminders")
          .select("id, title, due_at, category")
          .eq("user_id", user.id).eq("assigned_to", authTarget).is("completed_at", null)
      : Promise.resolve({ data: [] }),
    service.schema("hub").from("todos")
      .select("id, title, due_date")
      .eq("user_id", user.id).eq("is_household", true).eq("completed", false),
    authTarget
      ? service.schema("hub").from("todos")
          .select("id, title, due_date")
          .eq("user_id", user.id).eq("assigned_to", authTarget).eq("completed", false)
      : Promise.resolve({ data: [] }),
    authTarget
      ? service.schema("finance").from("manual_account_shares")
          .select("id, account:manual_accounts(name)")
          .eq("owner_user_id", user.id).eq("recipient_user_id", authTarget).eq("accepted", true)
      : Promise.resolve({ data: [] }),
    authTarget && myFamilyPlanIdList.length > 0
      ? service.schema("bible").from("family_plan_members")
          .select("family_plan:family_plans(name, plan:reading_plans(title))")
          .eq("user_id", authTarget)
          .in("family_plan_id", myFamilyPlanIdList)
      : Promise.resolve({ data: [] }),
  ]);

  const householdReminders = householdRemindersResult.data ?? [];
  const assignedReminders = assignedRemindersResult.data ?? [];
  const householdTodos = householdTodosResult.data ?? [];
  const assignedTodos = assignedTodosResult.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharedAccounts = (sharedAccountsResult.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharedPlans = (familyPlansResult.data ?? []) as any[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reminders = [...householdReminders, ...assignedReminders] as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todos = [...householdTodos, ...assignedTodos] as any[];
  const totalVisibleItems = reminders.length + todos.length;

  return (
    <IOSScreen>
      <Link href="/home/family/preview" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-tint)", padding: "6px 16px 0", fontWeight: 500 }} className="ios-subhead">
        <Icons.ChevronLeft style={{ width: 16, height: 16 }} /> Choose someone else
      </Link>
      <LargeTitle title={`What ${memberLabel} sees`} subtitle={`Computed from your data & sharing settings only — nothing from ${memberLabel}'s account was read.`} />

      {totalVisibleItems === 0 ? (
        <Group header="Calendar & responsibilities">
          <Cell title={<span style={{ color: "var(--ios-label-2)" }}>Nothing shared with {memberLabel} right now.</span>} />
        </Group>
      ) : (
        <Group header="Calendar & responsibilities">
          {reminders.map((r) => (
            <Cell
              key={`r-${r.id}`}
              lead={<IconBadge color="var(--ios-tint)"><Icons.BellIcon /></IconBadge>}
              title={r.title}
              subtitle="Reminder"
            />
          ))}
          {todos.map((t) => (
            <Cell
              key={`t-${t.id}`}
              lead={<IconBadge color="var(--ios-green)"><Icons.ChecklistIcon /></IconBadge>}
              title={t.title}
              subtitle="Task"
            />
          ))}
        </Group>
      )}

      {sharedAccounts.length === 0 ? (
        <Group header="Approved financial information">
          <Cell title={<span style={{ color: "var(--ios-label-2)" }}>No accounts shared with {memberLabel}.</span>} />
        </Group>
      ) : (
        <Group header="Approved financial information">
          {sharedAccounts.map((s) => (
            <Cell
              key={s.id}
              lead={<IconBadge color="var(--ios-finance)"><Icons.WalletIcon /></IconBadge>}
              title={s.account?.name ?? "Account"}
            />
          ))}
        </Group>
      )}

      {sharedPlans.length === 0 ? (
        <Group header="Spiritual development">
          <Cell title={<span style={{ color: "var(--ios-label-2)" }}>No shared family reading plans with {memberLabel}.</span>} />
        </Group>
      ) : (
        <Group header="Spiritual development">
          {sharedPlans.map((p, i) => (
            <Cell
              key={i}
              lead={<IconBadge color="#3B5C7F"><Icons.BookIcon /></IconBadge>}
              title={p.family_plan?.name ?? p.family_plan?.plan?.title ?? "Family reading plan"}
            />
          ))}
        </Group>
      )}

      <p className="ios-footnote" style={{ padding: "10px 32px 0", color: "var(--ios-label-2)", lineHeight: 1.5 }}>
        Everything else — Career, Health, Mental wellness, Journal, and any Finance account not listed above — stays private to you.
      </p>

      <div style={{ height: 12 }} />
      <TabBar current="family" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
