export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { IOSScreen, LargeTitle, Group, Cell, IconBadge, TabBar, Icons } from "@/components/ios";
import { listChildrenForParent } from "./_lib/children";

const TIER_LABEL: Record<string, string> = {
  elementary: "Elementary",
  teen: "Teen",
  college: "College",
};

const KID_COLORS = ["var(--ios-tint)", "#B565A7", "#E8607A", "#34A56F", "#C97A3A", "#5E5CE6"];

function Avatar({ color, initial }: { color: string; initial: string }) {
  return (
    <span aria-hidden style={{ width: 30, height: 30, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
      {initial}
    </span>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ChildrenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data: ownedChildren } = await service.schema("hub").from("family_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "child");

  if (ownedChildren?.length) {
    const cards = await listChildrenForParent(user.id, new Date());
    return (
      <IOSScreen>
        <LargeTitle brand title="Children" subtitle="Support each of your kids" avatarInitial={(user.user_metadata?.full_name ?? "T")[0]?.toUpperCase()} />

        <Group header={`Kids · ${cards.length}`} footer="Tap a child to open their workspace.">
          {cards.map((c, i) => (
            <Cell
              key={c.childId}
              href={`/children/${c.childId}`}
              lead={<Avatar color={KID_COLORS[i % KID_COLORS.length]} initial={c.initial} />}
              title={c.name}
              subtitle={
                <>
                  {TIER_LABEL[c.ageTier]}{c.age !== null ? ` · Age ${c.age}` : ""}
                  {c.todaysScheduleItem && <span style={{ display: "block" }}>Today: {c.todaysScheduleItem}</span>}
                  {c.upcomingDeadline && <span style={{ display: "block" }}>Due {fmtDate(c.upcomingDeadline.dueDate)}: {c.upcomingDeadline.title}</span>}
                  {c.attentionItem && <span style={{ display: "block", color: "var(--ios-orange)" }}>{c.attentionItem}</span>}
                </>
              }
            />
          ))}
        </Group>

        <Group header="Manage">
          <Cell lead={<IconBadge color="#8E8E93"><Icons.PeopleIcon /></IconBadge>} title="Add a child" subtitle="Managed profile or invite by email" href="/home/settings/family" />
        </Group>

        <div style={{ height: 12 }} />
        <TabBar current="more" currentUserId={user.id} sourceApp="children" />
      </IOSScreen>
    );
  }

  const { data: selfAsChild } = await service.schema("hub").from("family_members")
    .select("id")
    .eq("member_user_id", user.id)
    .eq("role", "child")
    .maybeSingle();

  if (selfAsChild) {
    redirect(`/children/${selfAsChild.id}`);
  }

  return (
    <IOSScreen>
      <LargeTitle brand title="Children" avatarInitial={(user.user_metadata?.full_name ?? "T")[0]?.toUpperCase()} />

      <Group
        header="No children yet"
        footer="Add a managed profile (no login required — great for younger kids) or invite an older child by email from Family Settings."
      >
        <Cell lead={<IconBadge color="#8E8E93"><Icons.PeopleIcon /></IconBadge>} title="Go to Family Settings" subtitle="Add or invite a child" href="/home/settings/family" />
      </Group>

      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="children" />
    </IOSScreen>
  );
}
