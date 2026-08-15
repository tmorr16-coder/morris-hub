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

// Curated default line-up. Ids are editable; the route degrades gracefully if a
// model id is stale (that column shows an error, the others still answer).
export const COMPARE_MODELS: CompareModel[] = [
  { id: "anthropic/claude-3.7-sonnet", label: "Claude 3.7 Sonnet", vendor: "Claude", color: "var(--ios-morris)" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash", vendor: "Gemini", color: "#2A8390" },
  { id: "openai/gpt-4o", label: "GPT-4o", vendor: "GPT", color: "#2E7D6B" },
];

// Extra models the user can add in the picker.
export const MORE_MODELS: CompareModel[] = [
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", vendor: "Claude", color: "var(--ios-morris)" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini", vendor: "GPT", color: "#2E7D6B" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", vendor: "Gemini", color: "#2A8390" },
  { id: "x-ai/grok-2-1212", label: "Grok 2", vendor: "Grok", color: "#444" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek V3", vendor: "DeepSeek", color: "#7B5EA8" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", vendor: "Llama", color: "#B04A34" },
];

interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

/** Ask a single model. Returns its text or throws. */
export async function askModel(model: string, messages: ChatMessage[], maxTokens = 1200): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://morrisai.family",
      "X-Title": "morrisai.family",
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    // Surface a short, useful reason (bad model id, rate limit, credit, etc.)
    let reason = `${res.status}`;
    try { const j = JSON.parse(t); reason = j.error?.message ?? reason; } catch { /* keep status */ }
    throw new Error(reason);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
