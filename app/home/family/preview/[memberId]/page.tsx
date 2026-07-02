export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";

export default async function PreviewAsMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prefs = await getPreferences(user.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data: memberRow } = await service.schema("hub").from("family_members")
    .select("member_user_id, display_name, nickname")
    .eq("user_id", user.id).eq("member_user_id", memberId).maybeSingle();
  if (!memberRow) notFound();

  let memberLabel: string = memberRow.display_name ?? memberRow.nickname ?? "This person";
  if (!memberRow.display_name && !memberRow.nickname) {
    const { data: authUser } = await service.auth.admin.getUserById(memberId);
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
    // Reminders I've specifically assigned to this member
    service.schema("hub").from("reminders")
      .select("id, title, due_at, category")
      .eq("user_id", user.id).eq("assigned_to", memberId).is("completed_at", null),
    service.schema("hub").from("todos")
      .select("id, title, due_date")
      .eq("user_id", user.id).eq("is_household", true).eq("completed", false),
    service.schema("hub").from("todos")
      .select("id, title, due_date")
      .eq("user_id", user.id).eq("assigned_to", memberId).eq("completed", false),
    service.schema("finance").from("manual_account_shares")
      .select("id, account:manual_accounts(name)")
      .eq("owner_user_id", user.id).eq("recipient_user_id", memberId).eq("accepted", true),
    myFamilyPlanIdList.length > 0
      ? service.schema("bible").from("family_plan_members")
          .select("family_plan:family_plans(name, plan:reading_plans(title))")
          .eq("user_id", memberId)
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

  const totalVisibleItems = householdReminders.length + assignedReminders.length + householdTodos.length + assignedTodos.length;

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    appAccess: prefs.app_access ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="family" user={menuUser} />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 100px" }}>
        <Link href="/home/family/preview" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--color-ink-3)", textDecoration: "none", marginBottom: 20 }}>
          ← Choose someone else
        </Link>
        <h1 className="serif" style={{ fontSize: 28, marginBottom: 6 }}>What {memberLabel} sees</h1>
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", marginBottom: 28, lineHeight: 1.6 }}>
          This is computed from your own data and sharing settings only — nothing from {memberLabel}&apos;s account was read.
        </p>

        <section style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 12 }}>
            Calendar &amp; Responsibilities
          </div>
          {totalVisibleItems === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>Nothing shared with {memberLabel} right now.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {[...householdReminders, ...assignedReminders].map((r: any) => (
                <div key={`r-${r.id}`} style={{ fontSize: 13, color: "var(--color-ink-2)", padding: "8px 14px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 8 }}>
                  {r.title} <span style={{ color: "var(--color-ink-4)", fontSize: 11 }}>· reminder</span>
                </div>
              ))}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {[...householdTodos, ...assignedTodos].map((t: any) => (
                <div key={`t-${t.id}`} style={{ fontSize: 13, color: "var(--color-ink-2)", padding: "8px 14px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 8 }}>
                  {t.title} <span style={{ color: "var(--color-ink-4)", fontSize: 11 }}>· task</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 12 }}>
            Approved financial information
          </div>
          {sharedAccounts.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>No accounts shared with {memberLabel}.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sharedAccounts.map((s) => (
                <div key={s.id} style={{ fontSize: 13, color: "var(--color-ink-2)", padding: "8px 14px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 8 }}>
                  {s.account?.name ?? "Account"}
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 12 }}>
            Spiritual development
          </div>
          {sharedPlans.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>No shared family reading plans with {memberLabel}.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sharedPlans.map((p, i) => (
                <div key={i} style={{ fontSize: 13, color: "var(--color-ink-2)", padding: "8px 14px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 8 }}>
                  {p.family_plan?.name ?? p.family_plan?.plan?.title ?? "Family reading plan"}
                </div>
              ))}
            </div>
          )}
        </section>

        <div style={{ fontSize: 12, color: "var(--color-ink-4)", lineHeight: 1.6, padding: "14px 18px", background: "var(--color-bg-deep)", borderRadius: 10 }}>
          Everything else — Career, Health, Mental wellness, Journal, and any Finance account not listed above — stays private to you.
        </div>
      </main>
    </div>
  );
}
