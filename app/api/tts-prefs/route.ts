import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ tts_voice: null, tts_speed: 1.0 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data } = await service.schema("hub").from("preferences")
    .select("tts_voice, tts_speed").eq("user_id", userId).maybeSingle();

  return Response.json({
    tts_voice: data?.tts_voice ?? null,
    tts_speed: data?.tts_speed ?? 1.0,
  }, {
    headers: { "Access-Control-Allow-Origin": "https://bible.morrisai.family" },
  });
}
