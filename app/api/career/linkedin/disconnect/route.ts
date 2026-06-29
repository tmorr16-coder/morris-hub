import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  await service.schema("career").from("career_profile")
    .update({ linkedin_connected: false, linkedin_connected_at: null, linkedin_name: null, linkedin_picture_url: null })
    .eq("user_id", userId);

  return Response.json({ ok: true });
}
