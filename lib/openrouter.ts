// OpenRouter client — one key, many models (Claude, Gemini, GPT, …).
// OpenAI-compatible REST, so plain fetch. Reads OPENROUTER_API_KEY.
// Docs: https://openrouter.ai/docs

export function openrouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export interface CompareModel {
  id: string;      // OpenRouter model id
  label: string;   // short display name
  vendor: string;  // Claude | Gemini | GPT | …
  color: string;   // accent
}

// Model id used to synthesize/merge answers. Kept here so it stays current.
export const SYNTH_MODEL = "anthropic/claude-sonnet-5";
// Model that structures prose into slide JSON (fast, good at JSON).
export const SLIDE_MODEL = "google/gemini-3.5-flash";
// Image-generation model (returns an image in the message).
export const IMAGE_MODEL = "google/gemini-2.5-flash-image";

// Curated default line-up (current frontier models). Ids are editable; the route
// degrades gracefully if an id goes stale (that column shows an error, the
// others still answer).
export const COMPARE_MODELS: CompareModel[] = [
  { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5", vendor: "Claude", color: "var(--ios-morris)" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", vendor: "Gemini", color: "#2A8390" },
  { id: "openai/gpt-5.1", label: "GPT-5.1", vendor: "GPT", color: "#2E7D6B" },
];

// Live/news models — Perplexity Sonar searches the web natively (cited, current).
export const LIVE_MODELS: CompareModel[] = [
  { id: "perplexity/sonar", label: "Sonar", vendor: "Perplexity", color: "#20808D" },
  { id: "perplexity/sonar-pro", label: "Sonar Pro", vendor: "Perplexity", color: "#20808D" },
  { id: "perplexity/sonar-reasoning-pro", label: "Sonar Reasoning", vendor: "Perplexity", color: "#20808D" },
];

// OpenRouter's Auto Router picks the model it judges best for each prompt, so
// the panel can include a "let OpenRouter decide" column. Its price is whatever
// the chosen model charges, which is why estimates for it read as "varies".
export const AUTO_MODEL = "openrouter/auto";
export const AUTO_MODEL_META: CompareModel = {
  id: AUTO_MODEL, label: "Auto · best fit", vendor: "OpenRouter", color: "#6366F1",
};

// Extra models the user can add in the picker.
export const MORE_MODELS: CompareModel[] = [
  { id: "anthropic/claude-opus-4.5", label: "Claude Opus 4.5", vendor: "Claude", color: "var(--ios-morris)" },
  { id: "openai/gpt-5", label: "GPT-5", vendor: "GPT", color: "#2E7D6B" },
  { id: "openai/gpt-5-mini", label: "GPT-5 mini", vendor: "GPT", color: "#2E7D6B" },
  { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", vendor: "Gemini", color: "#2A8390" },
  { id: "x-ai/grok-4.6", label: "Grok 4.6", vendor: "Grok", color: "#444" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek", vendor: "DeepSeek", color: "#7B5EA8" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", vendor: "Llama", color: "#B04A34" },
];

// ── Live catalog ────────────────────────────────────────────────────────
// The newest models on OpenRouter, read from its catalog rather than pinned
// here, so a model released today is selectable today. Anything above
// PREMIUM_PER_M costs enough that the panel asks before spending it.

export interface CatalogModel extends CompareModel {
  prompt: number;      // $ per token in
  completion: number;  // $ per token out
  created: number;     // epoch seconds
}

/**
 * Output $/1M above which a model counts as a higher-rate pick and needs an
 * explicit tap before it runs. Set above the standard frontier line-up (Sonnet
 * ~$15/M, GPT-5.1 ~$10/M) so ordinary runs are never interrupted — it's the
 * genuinely expensive picks (Opus-class and new premium releases) that ask.
 */
export const PREMIUM_PER_M = 20;

export function perMillion(rate: number | undefined): number {
  return (rate ?? 0) * 1_000_000;
}

export function isPremiumRate(p?: { completion: number }): boolean {
  return perMillion(p?.completion) >= PREMIUM_PER_M;
}

const VENDOR_COLORS: [prefix: string, vendor: string, color: string][] = [
  ["anthropic/", "Claude", "var(--ios-morris)"],
  ["google/", "Gemini", "#2A8390"],
  ["openai/", "GPT", "#2E7D6B"],
  ["x-ai/", "Grok", "#444"],
  ["deepseek/", "DeepSeek", "#7B5EA8"],
  ["meta-llama/", "Llama", "#B04A34"],
  ["perplexity/", "Perplexity", "#20808D"],
  ["mistralai/", "Mistral", "#C9611F"],
  ["qwen/", "Qwen", "#5B6B9E"],
  ["moonshotai/", "Moonshot", "#8A5AA8"],
];

export function vendorOf(id: string): { vendor: string; color: string } {
  const hit = VENDOR_COLORS.find(([p]) => id.startsWith(p));
  if (hit) return { vendor: hit[1], color: hit[2] };
  return { vendor: id.split("/")[0] || "Model", color: "var(--ios-label-2)" };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toCatalogModel(m: any): CatalogModel {
  const { vendor, color } = vendorOf(m.id);
  const name = String(m.name ?? m.id);
  return {
    id: m.id,
    label: (name.includes(": ") ? name.slice(name.indexOf(": ") + 2) : name).slice(0, 28),
    vendor, color,
    prompt: parseFloat(m.pricing?.prompt ?? "0"),
    completion: parseFloat(m.pricing?.completion ?? "0"),
    created: m.created ?? 0,
  };
}

/** Text models that can answer a prompt — anything else can't join a panel. */
function answerable(m: any): boolean {
  if (!m?.id) return false;
  const out = m.architecture?.output_modalities;
  return !Array.isArray(out) || out.includes("text");
}

/** Newest chat models in the catalog, most recent first. */
export function newestFrom(models: any[], exclude: Set<string>, limit = 12): CatalogModel[] {
  return models
    .filter((m) => answerable(m) && !exclude.has(m.id) && !m.id.includes(":free") && parseFloat(m.pricing?.completion ?? "0") > 0)
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    .slice(0, limit)
    .map(toCatalogModel);
}

/**
 * Free-text search over the whole catalog, so any model on OpenRouter can be
 * put on the panel — not just the curated line-up. Matches on id and name,
 * ranks whole-word and prefix hits first, then by recency.
 */
export function searchCatalog(models: any[], query: string, limit = 40): CatalogModel[] {
  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const scored: { m: any; score: number }[] = [];

  for (const m of models) {
    if (!answerable(m)) continue;
    const hay = `${m.id} ${m.name ?? ""}`.toLowerCase();
    if (!terms.every((t) => hay.includes(t))) continue;
    let score = 0;
    if (!q) score = 0;
    else if (m.id.toLowerCase() === q) score = 100;
    else if (hay.startsWith(q)) score = 60;
    else if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(hay)) score = 40;
    else score = 10;
    if (m.id.includes(":free")) score -= 5;
    scored.push({ m, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || (b.m.created ?? 0) - (a.m.created ?? 0))
    .slice(0, limit)
    .map(({ m }) => toCatalogModel(m));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * A slice of a multimodal message. OpenRouter speaks the OpenAI content-parts
 * shape, so an image rides along as an `image_url` part next to the text —
 * `url` may be an https link or a `data:image/...;base64,...` URI.
 */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface ChatMessage { role: "system" | "user" | "assistant"; content: string | ContentPart[] }

/**
 * Which catalog models can actually read an image.
 *
 * Sending image parts to a text-only model is not a soft failure — most
 * providers reject the whole request, so one attached screenshot would take out
 * that column of the panel. The route asks this first and sends those models a
 * text-only version of the turn instead.
 *
 * Falls open (empty set → nobody gets images) if the catalog can't be read,
 * which degrades to today's text-only behaviour rather than to an error.
 */
export async function fetchVisionModels(): Promise<Set<string>> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { next: { revalidate: 3600 } });
    if (!res.ok) return new Set();
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = (data.data ?? []) as any[];
    return new Set(
      all
        .filter((m) => (m?.architecture?.input_modalities ?? []).includes("image"))
        .map((m) => m.id as string)
    );
  } catch {
    return new Set();
  }
}

export interface Citation { url: string; title: string }
export interface ModelResult { content: string; cost: number | null; citations: Citation[]; served: string | null }

/**
 * Ask a single model. `web` grounds it in live search results (with citations);
 * `json` asks for a JSON object back (used by the slide structurer).
 */
export async function askModel(model: string, messages: ChatMessage[], maxTokens = 1200, opts?: { web?: boolean; json?: boolean }): Promise<ModelResult> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://morrisai.family",
      "X-Title": "morrisai.family",
    },
    body: JSON.stringify({
      model, messages, max_tokens: maxTokens, usage: { include: true },
      ...(opts?.web ? { plugins: [{ id: "web" }] } : {}),
      ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    // Surface a short, useful reason (bad model id, rate limit, credit, etc.)
    let reason = `${res.status}`;
    try { const j = JSON.parse(t); reason = j.error?.message ?? reason; } catch { /* keep status */ }
    throw new Error(reason);
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message ?? {};
  // Citations come back either as message.annotations (url_citation) or a
  // top-level citations array (Perplexity Sonar).
  const citations: Citation[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of (msg.annotations ?? []) as any[]) {
    const c = a?.url_citation;
    if (c?.url) citations.push({ url: c.url, title: c.title || c.url });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const u of (data.citations ?? []) as any[]) {
    const url = typeof u === "string" ? u : u?.url;
    if (url && !citations.some((c) => c.url === url)) citations.push({ url, title: (typeof u === "object" && u?.title) || url });
  }
  // With the Auto Router the id that actually answered is worth surfacing.
  const served = typeof data.model === "string" ? data.model : null;
  return { content: msg.content ?? "", cost: data.usage?.cost ?? null, citations, served };
}

/** Generate an image from a prompt. Returns a data/https image URL + cost. */
export async function generateImage(prompt: string, model: string = IMAGE_MODEL): Promise<{ url: string; cost: number | null }> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://morrisai.family",
      "X-Title": "morrisai.family",
    },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], modalities: ["image", "text"], usage: { include: true } }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    let reason = `${res.status}`;
    try { const j = JSON.parse(t); reason = j.error?.message ?? reason; } catch { /* keep status */ }
    throw new Error(reason);
  }
  const data = await res.json();
  const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
  if (!url) throw new Error("This model returned no image — try a different image model.");
  return { url, cost: data.usage?.cost ?? null };
}
