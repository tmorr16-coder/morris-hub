// Buddy's voice: text to speech for the child's screen.
//
// The browser's own speechSynthesis is still there and still the fallback: it
// is free, instant and works on a plane. But on an iPad that has not had the
// Premium voices downloaded it sounds like a 2005 satnav, and a six-year-old
// being read to notices.
//
// Two providers, chosen by which key is set:
//
//   Kokoro (hexgrad/Kokoro-82M), hosted on DeepInfra — DEEPINFRA_API_KEY.
//   The same open model the `kokoro-tts` command-line tool runs. That tool is
//   a Python program that loads a 300 MB ONNX file, which is not something a
//   Vercel function can do between a tap and a reply, so the model is called
//   where it is already loaded. Under a dollar per million characters, and
//   every clip is cached (see app/api/children/tts), so a week of tutoring
//   costs cents.
//
//   OpenAI gpt-4o-mini-tts — OPENAI_API_KEY. The earlier voice. Kept as the
//   second choice; it takes plain-English direction, which Kokoro does not.
//
// With neither key there are no cloud voices and the child's screen goes on
// using the device voice exactly as before.

import { recordFailure, clearFailures } from "@/lib/system-events";

export type Provider = "kokoro" | "openai";

export interface CloudVoice {
  id: string;
  label: string;
  /** How it sounds, for the grown-up choosing it. */
  note: string;
  provider: Provider;
}

/**
 * Kokoro's American English voices worth offering a child, best first. The
 * grades are the model author's own (VOICES.md): Heart and Bella are the two
 * A-grade voices and sound like a real person reading; the rest are a step
 * down but still natural. Voices graded D and below are left out.
 */
const KOKORO_VOICES: CloudVoice[] = [
  { id: "af_heart", label: "Heart", note: "Warm and natural. The best voice Kokoro has — start here.", provider: "kokoro" },
  { id: "af_bella", label: "Bella", note: "Bright and expressive. A close second.", provider: "kokoro" },
  { id: "af_nicole", label: "Nicole", note: "Soft and close, like a story at bedtime.", provider: "kokoro" },
  { id: "af_sarah", label: "Sarah", note: "Clear and steady. Easy to follow letter by letter.", provider: "kokoro" },
  { id: "af_kore", label: "Kore", note: "Calm and even.", provider: "kokoro" },
  { id: "af_aoede", label: "Aoede", note: "Light and friendly.", provider: "kokoro" },
  { id: "am_michael", label: "Michael", note: "A warm male voice.", provider: "kokoro" },
  { id: "am_fenrir", label: "Fenrir", note: "A deeper male voice.", provider: "kokoro" },
  { id: "am_puck", label: "Puck", note: "A lively male voice.", provider: "kokoro" },
];

/**
 * OpenAI's voices worth offering a child, warmest first. Several of the
 * catalogue are built for narration or a newsreader's authority, and read to
 * a first grader they land as stern. These sound like someone who likes the
 * child.
 */
const OPENAI_VOICES: CloudVoice[] = [
  { id: "coral", label: "Coral", note: "Warm and bright. The closest to a favourite teacher.", provider: "openai" },
  { id: "nova", label: "Nova", note: "Friendly and lively. Good for a child who tunes out.", provider: "openai" },
  { id: "shimmer", label: "Shimmer", note: "Gentle and soft-spoken. Good at bedtime.", provider: "openai" },
  { id: "sage", label: "Sage", note: "Calm and even. Easiest to follow letter by letter.", provider: "openai" },
  { id: "alloy", label: "Alloy", note: "Neutral and clear. The plainest of them.", provider: "openai" },
  { id: "ballad", label: "Ballad", note: "Slower and expressive. Good for reading aloud.", provider: "openai" },
  { id: "ash", label: "Ash", note: "A warm male voice.", provider: "openai" },
  { id: "echo", label: "Echo", note: "A steady male voice.", provider: "openai" },
  { id: "onyx", label: "Onyx", note: "A deep male voice.", provider: "openai" },
  { id: "verse", label: "Verse", note: "Animated and playful.", provider: "openai" },
];

/** Every voice either provider could speak, whether or not it is configured. */
export const CLOUD_VOICES: CloudVoice[] = [...KOKORO_VOICES, ...OPENAI_VOICES];

export const KOKORO_MODEL = process.env.KOKORO_MODEL ?? "hexgrad/Kokoro-82M";
/** OpenAI-compatible speech endpoint. Overridable for another Kokoro host. */
export const KOKORO_API_URL = process.env.KOKORO_API_URL ?? "https://api.deepinfra.com/v1/openai/audio/speech";
export const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";

export function kokoroConfigured(): boolean {
  return Boolean(process.env.DEEPINFRA_API_KEY);
}
export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
export function ttsConfigured(): boolean {
  return kokoroConfigured() || openaiConfigured();
}

/** The voices the grown-up can actually choose on this deployment, best first. */
export function availableCloudVoices(): CloudVoice[] {
  return [
    ...(kokoroConfigured() ? KOKORO_VOICES : []),
    ...(openaiConfigured() ? OPENAI_VOICES : []),
  ];
}

export function defaultCloudVoice(): string | null {
  return availableCloudVoices()[0]?.id ?? null;
}

export function voiceById(id: string | null | undefined): CloudVoice | null {
  if (!id) return null;
  return CLOUD_VOICES.find((v) => v.id === id) ?? null;
}

/** A voice this deployment can speak right now. */
export function isAvailableVoice(id: string | null | undefined): boolean {
  const v = voiceById(id);
  return !!v && (v.provider === "kokoro" ? kokoroConfigured() : openaiConfigured());
}

/** What goes in the cache key: the thing that would change the sound. */
export function modelFor(voice: CloudVoice): string {
  return voice.provider === "kokoro" ? `kokoro:${KOKORO_MODEL}` : `openai:${OPENAI_TTS_MODEL}`;
}

/**
 * How Buddy should sound, independent of which voice is chosen. OpenAI's
 * model takes direction in plain English; Kokoro does not, so for Kokoro the
 * same intent is applied to the text itself (see prepareForKokoro).
 */
const OPENAI_INSTRUCTIONS = [
  "You are reading aloud to a six-year-old American child who is learning to read.",
  "Standard American English, the way a first-grade teacher in Georgia speaks: every word fully and clearly pronounced, no British vowels, no mumbled endings.",
  "Warm, patient and encouraging. Never stern, never rushed, never syrupy.",
  "Speak slowly — noticeably slower than you would to an adult — with real pauses at full stops.",
  "When letters are separated by dashes, say each letter on its own with a short gap — do not run them together into a word.",
].join(" ");

/**
 * Kokoro reads what it is given, so the spelling convention has to be spelled
 * out for it: "B-E-A-R" would come out as "B dash E dash…" or be sounded as a
 * word. Each letter becomes its own short utterance with a pause after it.
 */
export function prepareForKokoro(text: string): string {
  return text
    .replace(/\b([A-Za-z])((?:-[A-Za-z])+)\b/g, (_m, first: string, rest: string, offset: number, whole: string) => {
      const letters = [first, ...rest.split("-").filter(Boolean)].map((l) => l.toUpperCase()).join(", ");
      // A pause before whatever word follows, but never a comma on top of the
      // sentence's own punctuation ("B, E, A, R." not "B, E, A, R,.").
      const after = whole.slice(offset + _m.length);
      return /^\s+[A-Za-z]/.test(after) ? `${letters},` : letters;
    })
    // Kokoro rushes past 400 tokens or so and a six-year-old needs the pauses;
    // a full stop followed by a space already gets one, so make sure line
    // breaks count as one too.
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\.\s*\./g, ".");
}

/**
 * Kokoro is best on a sentence or two at a time and rushes long passages.
 * Longer text is split at sentence ends into pieces under ~280 characters and
 * the clips are joined; MP3 frames concatenate cleanly enough for a browser.
 */
function chunk(text: string, max = 280): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let cur = "";
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    if ((cur + " " + s).trim().length > max && cur) { out.push(cur.trim()); cur = s; }
    else cur = (cur + " " + s).trim();
  }
  if (cur) out.push(cur.trim());
  return out;
}

export interface SynthesisResult {
  audio: Uint8Array;
  contentType: "audio/mpeg";
}

export class VoiceError extends Error {
  constructor(message: string, public status: number, public provider: Provider) { super(message); }
}

async function kokoroOnce(text: string, voice: string, speed: number, key: string): Promise<Uint8Array> {
  const res = await fetch(KOKORO_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: KOKORO_MODEL, input: text, voice, response_format: "mp3", speed }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(JSON.stringify({ tts: "kokoro-failed", status: res.status, model: KOKORO_MODEL, voice, detail: detail.slice(0, 400) }));
    throw new VoiceError(`Kokoro ${res.status}: ${detail.slice(0, 300)}`, res.status, "kokoro");
  }
  // The OpenAI-compatible endpoint answers with audio bytes. DeepInfra's own
  // inference endpoint, should KOKORO_API_URL point at it, answers with JSON
  // carrying a base64 data URI — accept either so a URL change is only a URL change.
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const j = (await res.json()) as { audio?: string };
    const m = /^data:audio\/[a-z0-9.+-]+;base64,(.+)$/i.exec(j.audio ?? "");
    if (!m) throw new VoiceError("Kokoro: no audio in response", 502, "kokoro");
    return new Uint8Array(Buffer.from(m[1], "base64"));
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function synthesiseKokoro(text: string, voice: string, speed: number): Promise<SynthesisResult> {
  const key = process.env.DEEPINFRA_API_KEY;
  if (!key) throw new VoiceError("DEEPINFRA_API_KEY is not set", 503, "kokoro");
  // A touch slower than adult pace by default; the client asks slower still
  // for spelling. Kokoro accepts 0.25–4 but under 0.7 it starts to drawl.
  const pace = Math.max(0.7, Math.min(1.3, speed));
  const parts = chunk(prepareForKokoro(text));
  const clips: Uint8Array[] = [];
  for (const p of parts) clips.push(await kokoroOnce(p, voice, pace, key));
  if (clips.length === 1) return { audio: clips[0], contentType: "audio/mpeg" };
  const total = clips.reduce((s, c) => s + c.byteLength, 0);
  const joined = new Uint8Array(total);
  let at = 0;
  for (const c of clips) { joined.set(c, at); at += c.byteLength; }
  return { audio: joined, contentType: "audio/mpeg" };
}

async function synthesiseOpenAI(text: string, voice: string, speed: number): Promise<SynthesisResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new VoiceError("OPENAI_API_KEY is not set", 503, "openai");
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      input: text,
      voice,
      instructions: OPENAI_INSTRUCTIONS,
      response_format: "mp3",
      // `speed` is a tts-1 parameter; gpt-4o-mini-tts paces itself from the
      // instructions and rejects it.
      ...(OPENAI_TTS_MODEL.startsWith("gpt-4o-mini-tts") ? {} : { speed: Math.max(0.5, Math.min(1.5, speed)) }),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(JSON.stringify({ tts: "openai-failed", status: res.status, model: OPENAI_TTS_MODEL, voice, detail: detail.slice(0, 400) }));
    throw new VoiceError(`OpenAI TTS ${res.status}: ${detail.slice(0, 300)}`, res.status, "openai");
  }
  return { audio: new Uint8Array(await res.arrayBuffer()), contentType: "audio/mpeg" };
}

/**
 * One phrase, spoken by the provider that owns the voice. Throws on any
 * provider error so the caller can fall back to the device voice rather than
 * leaving a child in silence; the failure is also written to the platform
 * status log, because the child's screen says nothing about it.
 */
export async function synthesise(text: string, voiceId: string, speed = 1): Promise<SynthesisResult> {
  const voice = voiceById(voiceId);
  if (!voice) throw new VoiceError(`Unknown voice ${voiceId}`, 400, "kokoro");
  try {
    const out = voice.provider === "kokoro"
      ? await synthesiseKokoro(text, voice.id, speed)
      : await synthesiseOpenAI(text, voice.id, speed);
    await clearFailures("children", `buddy-voice-${voice.provider}`).catch(() => undefined);
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordFailure({
      source: "children",
      subject: `buddy-voice-${voice.provider}`,
      severity: "warning",
      message: `Buddy's voice (${voice.provider}) failed: ${msg.slice(0, 300)}`,
      detail: { voice: voice.id, chars: text.length },
    }).catch(() => undefined);
    throw e;
  }
}
