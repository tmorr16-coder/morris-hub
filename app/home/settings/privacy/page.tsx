export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";

interface Row {
  category: string;
  state: "shared" | "private" | "mixed" | "not-saved";
  detail: string;
  href?: string;
  linkLabel?: string;
}

const STATE_LABEL: Record<Row["state"], string> = {
  shared: "Shared with circle",
  private: "Private to you",
  mixed: "Partially shared",
  "not-saved": "Not saved",
};
const STATE_COLOR: Record<Row["state"], string> = {
  shared: "#4A6B3A",
  private: "var(--color-accent)",
  mixed: "var(--color-amber)",
  "not-saved": "var(--color-ink-4)",
};

export default async function PrivacySettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prefs = await getPreferences(user.id);
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

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    appAccess: prefs.app_access ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="hub" user={menuUser} />
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 100px" }}>
        <Link href="/home/settings" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--color-ink-3)", textDecoration: "none", marginBottom: 20 }}>
          ← Settings
        </Link>
        <h1 className="serif" style={{ fontSize: 32, marginBottom: 6 }}>Sharing &amp; Privacy</h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 28, lineHeight: 1.6 }}>
          Every data type below has an explicit, visible sharing state. Nothing is ever assumed shared —
          {circleSize > 0 ? " your family circle only sees what's marked \"Shared\" or \"Partially shared\" here." : " you don't have anyone in your family circle yet, so everything is private regardless."}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r) => (
            <div key={r.category} style={{
              background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 10,
              padding: "14px 18px", display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>{r.category}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                    padding: "2px 7px", borderRadius: 8, background: `${STATE_COLOR[r.state]}15`, color: STATE_COLOR[r.state],
                  }}>
                    {STATE_LABEL[r.state]}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.5 }}>{r.detail}</div>
              </div>
              {r.href && (
                <Link href={r.href} style={{ fontSize: 12, fontWeight: 600, color: "var(--color-accent)", textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {r.linkLabel ?? "Open"} →
                </Link>
              )}
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 20, lineHeight: 1.5 }}>
          Never assume a spouse or family member sees more than what&apos;s listed above as &quot;Shared.&quot;
          Use <Link href="/home/family/preview" style={{ color: "var(--color-accent)" }}>Preview as a family member</Link> to see exactly what someone else sees of your data.
        </p>
      </main>
    </div>
  );
}
