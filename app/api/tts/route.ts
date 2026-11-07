import { createHash } from "node:crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { synthesise, defaultCloudVoice, isAvailableVoice, voiceById, modelFor, extensionFor, contentTypeFor } from "@/lib/buddy-voice";

export const runtime = "nodejs";
export const maxDuration = 30;
const BUCKET = "tts-cache";
const recent = new Map<string, number[]>();

/** The same voice engine as Buddy, with verbatim adult narration and no child requirement. */
export async function POST(request: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to listen." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.text !== "string" || !body.text.trim() || body.text.length > 600)
    return Response.json({ error: "Provide up to 600 characters." }, { status: 400 });
  const voiceId = isAvailableVoice(body.voice) ? body.voice : defaultCloudVoice();
  const voice = voiceById(voiceId);
  if (!voice) return Response.json({ error: "The voice is not available yet." }, { status: 503 });
  const now = Date.now();
  for (const [id, times] of recent) if (times.at(-1)! < now - 600_000) recent.delete(id);
  const times = (recent.get(user.id) ?? []).filter((t) => t > now - 600_000);
  if (times.length >= 240) return Response.json({ error: "Please wait before listening again." }, { status: 429 });
  recent.set(user.id, [...times, now]);

  const digest = createHash("sha256").update([user.id, "narration-v1", modelFor(voice), voice.id, body.text].join("\0")).digest("hex");
  const ext = voice.provider === "openrouter" ? "wav" : "mp3";
  const path = `narration/${digest.slice(0, 2)}/${digest}.${ext}`;
  const headers = { "Content-Type": contentTypeFor(ext), "Cache-Control": "private, no-store" };
  // Audio caching is optional: a storage outage must not prevent narration.
  const svc = createServiceClient();
  try {
    const { data } = await svc.storage.from(BUCKET).download(path);
    if (data) return new Response(await data.arrayBuffer(), { headers });
  } catch { /* speak without the cache */ }
  try {
    const result = await synthesise(body.text, voice.id, 1, "narration");
    try {
      const { data: bucket } = await svc.storage.getBucket(BUCKET);
      if (!bucket) await svc.storage.createBucket(BUCKET, { public: false });
      await svc.storage.from(BUCKET).upload(
        `narration/${digest.slice(0, 2)}/${digest}.${extensionFor(result.contentType)}`,
        result.audio, { contentType: result.contentType, upsert: true },
      );
    } catch { /* the next request can synthesise again */ }
    return new Response(result.audio as unknown as BodyInit, { headers: { ...headers, "Content-Type": result.contentType } });
  } catch {
    return Response.json({ error: "The voice is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
