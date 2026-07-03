// Shared helper for the family detail pages: the set of circle user-ids to
// scope shared data by, a member id -> display name map, and the taggable
// member list (You + each circle member, including managed children).
// Uses the service-role client (untyped).

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface CircleMember { id: string; name: string }

export async function circleContext(service: any, userId: string): Promise<{
  circleIds: string[];
  nameMap: Record<string, string>;
  members: CircleMember[];
}> {
  const { data: circleRows } = await service.schema("hub").from("family_members")
    .select("id, member_user_id, display_name, nickname, role").eq("user_id", userId);
  const rows = (circleRows ?? []) as any[];
  const memberIds = rows.map((m) => m.member_user_id).filter(Boolean) as string[];
  const circleIds = [userId, ...memberIds];

  // Resolve auth names for account-holding members.
  const authNames = new Map<string, string>();
  if (memberIds.length > 0) {
    try {
      const { data: usersList } = await service.auth.admin.listUsers({ perPage: 200 });
      for (const u of (usersList?.users ?? []) as any[]) {
        const nm = u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email;
        if (nm) authNames.set(u.id, nm);
      }
    } catch { /* auth admin unavailable */ }
  }

  const nameMap: Record<string, string> = { [userId]: "You" };
  const members: CircleMember[] = [{ id: userId, name: "You" }];
  for (const m of rows) {
    // Adults are keyed by their auth id; managed children (no auth id) by the
    // family_members row id — both are what `assigned_to` may store.
    const id = (m.member_user_id ?? m.id) as string;
    const name = m.display_name ?? m.nickname ?? (m.member_user_id ? authNames.get(m.member_user_id) : null) ?? "Member";
    nameMap[id] = name;
    members.push({ id, name });
  }
  return { circleIds, nameMap, members };
}
