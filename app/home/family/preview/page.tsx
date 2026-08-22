export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { IOSScreen, LargeTitle, Group, Cell, IconBadge, TabBar, Icons } from "@/components/ios";

export default async function PreviewPickerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data: circleData } = await service.schema("hub").from("family_members")
    .select("id, member_user_id, display_name, nickname")
    .eq("user_id", user.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleRows = (circleData ?? []) as any[];

  // Resolve names for account-holding members (managed children have no auth id).
  const authIds = circleRows.map((m) => m.member_user_id).filter(Boolean) as string[];
  const userMap = new Map<string, { full_name: string | null; email: string | null }>();
  if (authIds.length > 0) {
    const { data: users } = await service.auth.admin.listUsers({ perPage: 200 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const u of (users?.users ?? []) as any[]) {
      userMap.set(u.id, {
        full_name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
        email: u.email ?? null,
      });
    }
  }

  // Key on the family_members primary key — always present, unlike member_user_id.
  const members = circleRows.map((m) => ({
    id: m.id as string,
    label: (m.display_name
      ?? m.nickname
      ?? userMap.get(m.member_user_id)?.full_name
      ?? userMap.get(m.member_user_id)?.email
      ?? "Member") as string,
  }));

  return (
    <IOSScreen>      <LargeTitle title="Preview as" subtitle="See exactly what someone in your circle can see about you" />

      {members.length === 0 ? (
        <Group header="Your circle" footer="No one in your family circle yet. Add family members to preview what they can see.">
          <Cell lead={<IconBadge color="#8E8E93"><Icons.PeopleIcon /></IconBadge>} title="Manage family & sharing" href="/home/settings/family" />
        </Group>
      ) : (
        <Group header="Choose someone" footer="Computed entirely from your own sharing settings — no access to their account required.">
          {members.map((m) => (
            <Cell
              key={m.id}
              href={`/home/family/preview/${m.id}`}
              lead={<IconBadge color="var(--ios-tint)"><Icons.PersonIcon /></IconBadge>}
              title={m.label}
            />
          ))}
        </Group>
      )}

      <div style={{ height: 12 }} />
      <TabBar current="family" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
