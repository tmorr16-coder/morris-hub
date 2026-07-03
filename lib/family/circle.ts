// Shared helper for the family detail pages: the set of circle user-ids to
// scope shared data by, and a member id -> display name map ("You" + nicknames
// / full names). Uses the service-role client (untyped).

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function circleContext(service: any, userId: string): Promise<{ circleIds: string[]; nameMap: Record<string, string> }> {
  const { data: circleRows } = await service.schema("hub").from("family_members")
    .select("member_user_id, display_name, nickname").eq("user_id", userId);
  const rows = (circleRows ?? []) as any[];
  const memberIds = rows.map((m) => m.member_user_id).filter(Boolean) as string[];
  const circleIds = [userId, ...memberIds];
  const nameMap: Record<string, string> = { [userId]: "You" };
  if (memberIds.length > 0) {
    try {
      const { data: usersList } = await service.auth.admin.listUsers({ perPage: 200 });
      for (const u of (usersList?.users ?? []) as any[]) {
        const nm = u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email;
        if (nm && u.id !== userId) nameMap[u.id] = nm;
      }
    } catch { /* auth admin unavailable */ }
  }
  for (const m of rows) {
    const nm = m.display_name ?? m.nickname;
    if (nm && m.member_user_id) nameMap[m.member_user_id] = nm;
  }
  return { circleIds, nameMap };
}
