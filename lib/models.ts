// Claude model IDs for the Anthropic SDK, in one place.
//
// Every route picks a tier from this file rather than inlining a string, so a
// model upgrade is a one-line change here instead of a grep across 40 files.
// That drift is what this file exists to prevent — before it, the same tier was
// spelled three ways (`claude-haiku-4-5` and `claude-haiku-4-5-20251001`) and
// two generations of Sonnet were live at once.
//
// IDs are exact and complete as written — never append a date suffix. A dated
// snapshot pins you to a model that eventually retires; the bare ID does not.
//
// Note: lib/openrouter.ts uses a *different* namespace ("anthropic/claude-…")
// because OpenRouter prefixes every id with its vendor. Don't mix the two.

/** High-volume, latency-sensitive work: chat replies, summaries, extraction. */
export const MODEL_FAST = "claude-haiku-4-5";

/** Reasoning-heavy work where Haiku is not enough: advisors, agents, parsing. */
export const MODEL_BALANCED = "claude-sonnet-5";

/**
 * The hardest generation tasks — long structured plans, LSAT explanations.
 * `claude-opus-5` is the current top of this tier at the same $5/$25 rate;
 * moving up is a one-line edit here once we want to re-tune the prompts.
 */
export const MODEL_DEEP = "claude-opus-4-8";

/**
 * Human-readable names for the tiers above, for UI that names the model rather
 * than saying "default". Kept here so a tier change updates the label with it —
 * the label used to live next to its own copy of the id and went stale silently.
 */
export const MODEL_LABELS: Record<string, string> = {
  [MODEL_FAST]: "Claude Haiku 4.5",
  [MODEL_BALANCED]: "Claude Sonnet 5",
  [MODEL_DEEP]: "Claude Opus 4.8",
};
