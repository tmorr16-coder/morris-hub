import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";
import { availableCloudVoices, isAvailableVoice } from "@/lib/buddy-voice";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Sign in to manage your voice." }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data } = await service.schema("hub").from("preferences")
    .select("tts_voice, tts_speed").eq("user_id", userId).maybeSingle();

  return Response.json({
    // Older device-only selections upgrade to Buddy's natural voice. Explicit
    // cloud selections remain available across devices and feature subdomains.
    tts_voice: isAvailableVoice(data?.tts_voice) ? data.tts_voice : "buddy",
    tts_speed: data?.tts_speed ?? 1.0,
    voices: availableCloudVoices().map(({ id, label }) => ({ id, label })),
  }, {
    headers: {
      "Access-Control-Allow-Origin": "https://bible.morrisai.family",
      "Cache-Control": "private, no-store",
    },
  });
}

// Save the platform read-aloud voice + speed (the single source of truth the
// scripture readers use). Set from Bible → Settings.
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid preferences." }, { status: 400 });
  if (body.tts_voice != null && body.tts_voice !== "buddy" && !isAvailableVoice(body.tts_voice))
    return Response.json({ error: "Choose an available voice." }, { status: 400 });
  if (body.tts_speed != null && (typeof body.tts_speed !== "number" || !Number.isFinite(body.tts_speed) || body.tts_speed < 0.5 || body.tts_speed > 2))
    return Response.json({ error: "Choose a speed between 0.5 and 2." }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { user_id: userId };
  if (body.tts_voice === "buddy" || isAvailableVoice(body.tts_voice)) updates.tts_voice = body.tts_voice;
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
