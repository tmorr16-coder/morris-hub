import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { childForGuardian } from "@/app/children/_lib/children";
import { synthesise, ttsConfigured, isAvailableVoice, defaultCloudVoice, voiceById, modelFor, extensionFor, contentTypeFor, VoiceError, type SynthesisResult } from "@/lib/buddy-voice";

export const runtime = "nodejs";
export const maxDuration = 30;

/* eslint-disable @typescript-eslint/no-explicit-any */

// MAI voice.
//
// Every clip is cached in storage under a hash of exactly what produced it —
// model, voice, speed, text — so the same phrase is never paid for twice. That
// matters more here than anywhere else in the app, because Buddy repeats
// himself enormously: the same twelve spelling words every evening for a week,
// the same handful of praise lines, the same task titles. After the first
// sitting almost every request is a cache hit, and a week of tutoring costs a
// few dozen short clips.
//
// The route answers with audio bytes rather than a signed URL. A URL would let
// the browser cache too, but it is a second round trip on a miss and a second
// failure mode on a bad network, and the client already keeps what it has
// played this session.

const BUCKET = "tts-cache";
const MAX_CHARS = 700;

const rateBuckets = new Map<string, number[]>();
function allow(userId: string, limit = 120, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  rateBuckets.set(userId, arr);
  return true;
}

// Created once per process, not per request.
let bucketReady = false;
async function ensureBucket(svc: any) {
  if (bucketReady) return;
  const { data } = await svc.storage.getBucket(BUCKET);
  if (!data) {
    // Private: these are clips of a named child's school work being read aloud.
    await svc.storage.createBucket(BUCKET, { public: false });
  }
  bucketReady = true;
}

export async function POST(req: NextRequest) {
  if (!ttsConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allow(user.id)) return NextResponse.json({ error: "Slow down" }, { status: 429 });

  let body: { childId?: string; text?: string; voice?: string; speed?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const text = String(body.text ?? "").trim().slice(0, MAX_CHARS);
  const childId = String(body.childId ?? "");
  // A voice this deployment can speak; otherwise the best one it has. A saved
  // OpenAI choice on a Kokoro-only deployment lands here.
  const voice = isAvailableVoice(body.voice) ? body.voice! : defaultCloudVoice();
  if (!voice) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const speed = Number.isFinite(body.speed) ? Math.max(0.5, Math.min(1.5, Number(body.speed))) : 1;
  if (!text || !childId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const svc = createServiceClient() as any;
  // Not because the audio is sensitive to a guardian in particular, but because
  // an unguarded synthesis endpoint on a signed-in session is somebody else's
  // OpenAI bill waiting to happen.
  const child = await childForGuardian(svc, childId, user.id);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Speed is in the key: the same sentence read slowly is a different clip.
  // So is the provider and model, since the same voice name on a new model
  // is a different sound.
  const digest = createHash("sha256")
    .update([modelFor(voiceById(voice)!), voice, speed.toFixed(2), text].join("\0"))
    .digest("hex");
  // Kokoro and OpenAI answer in MP3; the OpenRouter voice streams PCM and is
  // stored as WAV. The provider is already in the digest, so one lookup per
  // extension is enough.
  const ext = voiceById(voice)!.provider === "openrouter" ? "wav" : "mp3";
  const path = `${digest.slice(0, 2)}/${digest}.${ext}`;

  await ensureBucket(svc);

  const { data: cached } = await svc.storage.from(BUCKET).download(path);
  if (cached) {
    console.log(JSON.stringify({ tts: "hit", voice, chars: text.length }));
    return new NextResponse(await cached.arrayBuffer(), {
      headers: { "Content-Type": contentTypeFor(ext), "X-Cache": "hit" },
    });
  }

  let audio: Uint8Array;
  let contentType: SynthesisResult["contentType"];
  try {
    ({ audio, contentType } = await synthesise(text, voice, speed));
  } catch (e) {
    // The client falls back to the device voice on any non-200, so a provider
    // outage costs quality rather than silence. The code says which kind of
    // outage, because "out of credits" is a message for a grown-up and a
    // thirty-minute pause, where a rate limit is a three-minute one.
    const msg = e instanceof Error ? e.message : "Synthesis failed";
    const status = e instanceof VoiceError ? e.status : 0;
    const code = status === 402 || /insufficient_quota|credit_balance_exhausted|billing|insufficient (balance|funds)|out of credit/i.test(msg) ? "billing"
      : status === 429 ? "rate"
      : "provider";
    return NextResponse.json({ error: msg, code }, { status: 502 });
  }

  console.log(JSON.stringify({ tts: "miss", voice, chars: text.length, bytes: audio.byteLength }));
  // Store, but never at the cost of answering: a failed upload just means the
  // next identical request pays again.
  const storedPath = `${digest.slice(0, 2)}/${digest}.${extensionFor(contentType)}`;
  await svc.storage.from(BUCKET)
    .upload(storedPath, audio, { contentType, upsert: true })
    .catch(() => undefined);

  return new NextResponse(audio as unknown as BodyInit, {
    headers: { "Content-Type": contentType, "X-Cache": "miss" },
  });
}
