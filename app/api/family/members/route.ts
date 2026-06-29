import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";

export interface FamilyMember {
  id: string;
  member_user_id: string;
  nickname: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface PlatformUser {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  in_circle: boolean;
}

// GET — family circle + all platform users for the picker
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const [{ data: members }, { data: profiles }] = await Promise.all([
    service.schema("hub").from("family_members")
      .select("id, member_user_id, nickname")
      .eq("user_id", userId),
    service.from("profiles")
      .select("id, full_name, email, avatar_url")
      .neq("id", userId)
      .order("full_name", { ascending: true }),
  ]);

  const circleIds = new Set(((members ?? []) as { member_user_id: string }[]).map((m) => m.member_user_id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circle: FamilyMember[] = ((members ?? []) as any[]).map((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = ((profiles ?? []) as any[]).find((p) => p.id === m.member_user_id);
    return { ...m, ...profile };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const everyone: PlatformUser[] = ((profiles ?? []) as any[]).map((p) => ({
    ...p,
    in_circle: circleIds.has(p.id),
  }));

  return Response.json({ circle, everyone });
}

// POST — add someone to your family circle
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { member_user_id, nickname } = await request.json();
  if (!member_user_id) return Response.json({ error: "member_user_id required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service.schema("hub").from("family_members")
    .upsert({ user_id: userId, member_user_id, nickname: nickname ?? null }, { onConflict: "user_id,member_user_id" });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

// DELETE — remove someone from your family circle
export async function DELETE(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { member_user_id } = await request.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  await service.schema("hub").from("family_members")
    .delete().eq("user_id", userId).eq("member_user_id", member_user_id);

  return Response.json({ ok: true });
}
