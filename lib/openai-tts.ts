// Text to speech for Buddy, via OpenAI.
//
// The browser's own speechSynthesis is still there and still the fallback: it
// is free, instant and works on a plane. But on an iPad that has not had the
// Premium voices downloaded it sounds like a 2005 satnav, and a six-year-old
// being read to notices. This is the better option.
//
// Everything here degrades to nothing without OPENAI_API_KEY. No key, no
// route, and the child's screen goes on using the device voice exactly as
// before — see app/children/_components/KidClient.tsx.

/** Model id, overridable without a deploy in case the default is retired. */
export const TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";

export function ttsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export interface CloudVoice {
  id: string;
  label: string;
  /** How it sounds, for the grown-up choosing it. */
  note: string;
}

/**
 * The voices worth offering a child, warmest first.
 *
 * Not the whole catalogue. Several of OpenAI's voices are built for narration
 * or for a newsreader's authority, and read to a first grader they land as
 * stern. These are the ones that sound like someone who likes the child.
 */
export const CLOUD_VOICES: CloudVoice[] = [
  { id: "coral", label: "Coral", note: "Warm and bright. The closest to a favourite teacher." },
  { id: "nova", label: "Nova", note: "Friendly and lively. Good for a child who tunes out." },
  { id: "shimmer", label: "Shimmer", note: "Gentle and soft-spoken. Good at bedtime." },
  { id: "fable", label: "Fable", note: "A storyteller, lightly British. Suits the owl." },
  { id: "sage", label: "Sage", note: "Calm and even. Easiest to follow letter by letter." },
  { id: "alloy", label: "Alloy", note: "Neutral and clear. The plainest of them." },
  { id: "ballad", label: "Ballad", note: "Slower and expressive. Good for reading aloud." },
  { id: "ash", label: "Ash", note: "A warm male voice." },
  { id: "echo", label: "Echo", note: "A steady male voice." },
  { id: "onyx", label: "Onyx", note: "A deep male voice." },
  { id: "verse", label: "Verse", note: "Animated and playful." },
];

export const DEFAULT_CLOUD_VOICE = "coral";

export function isCloudVoice(id: string | null | undefined): boolean {
  return !!id && CLOUD_VOICES.some((v) => v.id === id);
}

/**
 * How Buddy should sound, independent of which voice is chosen.
 *
 * gpt-4o-mini-tts takes direction in plain English, which is the reason to
 * prefer it here over a fixed-voice API: the same voice can be told to slow
 * down for spelling without changing pitch the way a speed multiplier does.
 */
const INSTRUCTIONS = [
  "You are reading aloud to a six-year-old child who is learning to read.",
  "Warm, patient and encouraging, like a favourite teacher. Never stern, never rushed, never syrupy.",
  "Speak clearly and a little slowly, with real pauses at full stops.",
  "When letters are separated by dashes, say each letter on its own with a short gap — do not run them together into a word.",
].join(" ");

export interface SynthesisResult {
  audio: Uint8Array;
  contentType: "audio/mpeg";
}

/**
 * One phrase, spoken. Throws on any provider error so the caller can fall
 * back to the device voice rather than leaving a child in silence.
 */
export async function synthesise(text: string, voice: string, speed = 1): Promise<SynthesisResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: text,
      voice: isCloudVoice(voice) ? voice : DEFAULT_CLOUD_VOICE,
      instructions: INSTRUCTIONS,
      response_format: "mp3",
      // The API clamps to 0.25–4; Buddy never wants either end of that.
      speed: Math.max(0.5, Math.min(1.5, speed)),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI TTS ${res.status}: ${detail.slice(0, 300)}`);
  }
  return { audio: new Uint8Array(await res.arrayBuffer()), contentType: "audio/mpeg" };
}
