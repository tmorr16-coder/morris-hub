// Shared ranking for Web Speech (SpeechSynthesis) voices.
//
// Goal: on Apple devices (iOS / macOS / Safari), pick the best-sounding
// modern voice. Apple ships high-quality neural voices whose names look
// like "Ava (Premium)", "Samantha", "Zoe (Enhanced)", etc. These are
// on-device (`localService === true`) and vastly outclass the old
// "compact" voices. We score every voice and prefer, in order:
//   1. English, strongly favouring en-US
//   2. Known modern Apple voice names (Ava, Zoe, Evan, Nathan, Samantha…)
//   3. Voices flagged Premium (best) or Enhanced (next best)
//   4. On-device (localService) voices over remote ones
// and down-rank legacy "compact"/novelty voices.

// Modern Apple neural voices (US English personas). Kept broad so we still
// win on devices that expose only a subset.
const MODERN_APPLE_NAMES = [
  "Ava", "Zoe", "Evan", "Nathan", "Samantha", "Allison",
  "Susan", "Tom", "Nicky", "Aaron", "Joelle", "Noelle",
];

/** True for Apple's higher-quality neural variants (best audio). */
export function isEnhancedVoice(v: SpeechSynthesisVoice): boolean {
  return /\b(premium|enhanced)\b/i.test(v.name);
}

/** A single voice's desirability score. Higher = better. -1 = not usable. */
export function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name;
  const lang = (v.lang || "").replace("_", "-");

  // Must be English.
  let score: number;
  if (lang === "en-US") score = 100;
  else if (lang.startsWith("en-")) score = 60;
  else if (lang.startsWith("en")) score = 40;
  else return -1;

  // Legacy low-quality voices — push to the bottom.
  if (/\bcompact\b/i.test(name)) score -= 60;
  if (/eloquence|novelty/i.test(name)) score -= 40;

  // Modern Apple neural persona by name.
  if (MODERN_APPLE_NAMES.some((n) => new RegExp(`\\b${n}\\b`, "i").test(name))) {
    score += 50;
  }

  // Premium > Enhanced quality flags (Apple neural tiers).
  if (/\bpremium\b/i.test(name)) score += 40;
  else if (/\benhanced\b/i.test(name)) score += 30;

  // On-device voices (Apple) beat remote/cloud fallbacks.
  if (v.localService) score += 15;

  // Tiny tiebreaker toward the platform default.
  if (v.default) score += 2;

  return score;
}

/** English voices sorted best-first. Non-English voices are dropped. */
export function rankVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices
    .map((v) => ({ v, s: scoreVoice(v) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.v);
}

/** The single best available voice, or null if none. */
export function pickBestVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const ranked = rankVoices(voices);
  return ranked[0] ?? voices[0] ?? null;
}
