// Claude-curated news using the web_search server tool.
// The Anthropic SDK doesn't go through Next's fetch cache, so we wrap
// the fetcher in unstable_cache for a real TTL keyed by the topic set.

import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";

const client = new Anthropic();

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  summary: string;
  topic: string;
}

const TOPIC_QUERIES: Record<string, string> = {
  politics: "Top US political news today",
  ai: "Latest AI and machine learning news this week",
  claude: "Anthropic Claude news, updates, or announcements this week",
};

async function fetchNewsRaw(topics: string[]): Promise<NewsItem[]> {
  if (topics.length === 0) return [];

  const queries = topics
    .filter((t) => TOPIC_QUERIES[t])
    .map((t) => `**${t.toUpperCase()}:** ${TOPIC_QUERIES[t]}`)
    .join("\n");

  const prompt = `Find 5 top news stories for the following topics. Use web search to get current results.

${queries}

For each story, return JSON in this exact format inside a single \`\`\`json ... \`\`\` block:
{
  "items": [
    {
      "headline": "...",
      "source": "...",
      "url": "...",
      "summary": "1-2 sentence summary",
      "topic": "politics" | "ai" | "claude"
    }
  ]
}

Pick at most 2 per topic. Prefer reputable sources (AP, Reuters, WSJ, NYT, official company blogs for AI/Claude topics). Skip paywalled stories where possible. Do not invent URLs — only include URLs returned by web search.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      messages: [{ role: "user", content: prompt }],
    });

    // Pull all text blocks (the model may emit multiple after tool use)
    const fullText = response.content
      .filter((b) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b) => (b as any).text as string)
      .join("\n");

    if (!fullText) {
      console.error("[news] no text content; stop_reason=", response.stop_reason);
      return [];
    }

    // Extract the JSON block — may be in markdown fences or bare
    const fencedMatch = fullText.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    const bareMatch = fullText.match(/{[\s\S]*"items"[\s\S]*}/);
    const jsonStr = fencedMatch?.[1] ?? bareMatch?.[0];

    if (!jsonStr) {
      console.error("[news] no JSON found in response", fullText.slice(0, 300));
      return [];
    }

    const parsed = JSON.parse(jsonStr);
    return (parsed.items ?? []) as NewsItem[];
  } catch (e) {
    console.error("[news] fetch failed", e);
    return [];
  }
}

// Cache the Claude+web_search call for 30 minutes per sorted-topic key.
// First load takes ~5-10s; subsequent loads from any user with the same
// topic set are served instantly until revalidation.
const cachedFetchNews = unstable_cache(
  fetchNewsRaw,
  ["news"],
  { tags: ["news"], revalidate: 1800 }
);

export async function fetchNews(topics: string[]): Promise<NewsItem[]> {
  // Sort the topic list so different orderings share the same cache entry.
  const sorted = [...topics].sort();
  return cachedFetchNews(sorted);
}

// ── Ticker-focused news ─────────────────────────────────────────────
// Curated news about a single public company / ticker. Cached 1h —
// pharma + biotech news doesn't move minute-to-minute.
export interface TickerNewsItem extends NewsItem {
  publishedAt?: string;
}

async function fetchTickerNewsRaw(
  ticker: string,
  companyName: string
): Promise<TickerNewsItem[]> {
  const prompt = `Find the 5 most important recent news stories about ${companyName} (ticker: ${ticker}). Use web search to get current results.

Prioritize, in order:
1. Earnings, guidance changes, analyst rating moves
2. FDA approvals / clinical trial results / drug pipeline updates
3. Major partnerships, M&A, or executive changes
4. Stock-moving events from the last 1-2 weeks

Return JSON in this exact format inside a single \`\`\`json ... \`\`\` block:
{
  "items": [
    {
      "headline": "...",
      "source": "...",
      "url": "...",
      "summary": "1-2 sentence summary of what happened and why it matters",
      "topic": "${ticker}",
      "publishedAt": "YYYY-MM-DD or null"
    }
  ]
}

Prefer reputable sources (Reuters, Bloomberg, WSJ, FT, BioPharma Dive, Fierce Pharma, the company's own press releases). Skip rumor / speculation pieces. Do not invent URLs — only include URLs returned by web search.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages: [{ role: "user", content: prompt }],
    });

    const fullText = response.content
      .filter((b) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b) => (b as any).text as string)
      .join("\n");

    if (!fullText) {
      console.error(`[ticker-news] ${ticker} no text; stop_reason=`, response.stop_reason);
      return [];
    }

    const fencedMatch = fullText.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    const bareMatch = fullText.match(/{[\s\S]*"items"[\s\S]*}/);
    const jsonStr = fencedMatch?.[1] ?? bareMatch?.[0];

    if (!jsonStr) {
      console.error(`[ticker-news] ${ticker} no JSON in response`, fullText.slice(0, 300));
      return [];
    }

    const parsed = JSON.parse(jsonStr);
    return (parsed.items ?? []) as TickerNewsItem[];
  } catch (e) {
    console.error(`[ticker-news] ${ticker} fetch failed`, e);
    return [];
  }
}

const cachedTickerNews = unstable_cache(
  fetchTickerNewsRaw,
  ["ticker-news"],
  { tags: ["ticker-news"], revalidate: 3600 }
);

export async function fetchTickerNews(
  ticker: string,
  companyName: string
): Promise<TickerNewsItem[]> {
  return cachedTickerNews(ticker, companyName);
}
