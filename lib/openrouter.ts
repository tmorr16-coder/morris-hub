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

interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

export interface Citation { url: string; title: string }
export interface ModelResult { content: string; cost: number | null; citations: Citation[] }

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
  return { content: msg.content ?? "", cost: data.usage?.cost ?? null, citations };
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
  if (!url) throw new Error("This model returned no image — try a different image model.");
  return { url, cost: data.usage?.cost ?? null };
}
