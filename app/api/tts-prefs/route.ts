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

// Save the platform read-aloud voice + speed (the single source of truth the
// scripture readers use). Set from Bible → Settings.
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { user_id: userId };
  if (typeof body.tts_voice === "string") updates.tts_voice = body.tts_voice;
  if (body.tts_voice === null) updates.tts_voice = null;
  if (typeof body.tts_speed === "number" && body.tts_speed >= 0.5 && body.tts_speed <= 2)
    updates.tts_speed = body.tts_speed;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service.schema("hub").from("preferences")
    .upsert(updates, { onConflict: "user_id" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
