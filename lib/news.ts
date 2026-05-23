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

  const prompt = `Find the top news stories for the following topics. Use web search to get current results.

${queries}

Return up to 5 stories per topic (so up to ${topics.length * 5} total). Return JSON in this exact format inside a single \`\`\`json ... \`\`\` block:
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

Sort each topic's stories with the most important first. Prefer reputable sources (AP, Reuters, WSJ, NYT, official company blogs). Skip paywalled stories. Do not invent URLs. Do NOT include <cite> tags or any HTML in your response.`;

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
    // Strip <cite index="N"> and </cite> tags injected by web_search tool
    const clean = (s: string) => (s ?? "").replace(/<\/?cite[^>]*>/gi, "").trim();
    return ((parsed.items ?? []) as NewsItem[]).map((it) => ({
      ...it,
      headline: clean(it.headline),
      summary: clean(it.summary),
      source: clean(it.source),
    }));
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
  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Find the 5 most important news stories about ${companyName} (ticker: ${ticker}) published TODAY (${today}) or in the last 48 hours. Use web search to get current results.

Prioritize stories published TODAY first, then:
1. Earnings, guidance changes, analyst rating moves
2. FDA approvals / clinical trial results / drug pipeline updates
3. Major partnerships, M&A, or executive changes
4. Stock-moving events

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

Prefer reputable sources (Reuters, Bloomberg, WSJ, FT, BioPharma Dive, Fierce Pharma, the company's own press releases). Skip rumor / speculation pieces. Do not invent URLs. Do NOT include <cite> tags or any HTML.`;

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
    const cleanStr = (s: string) => (s ?? "").replace(/<\/?cite[^>]*>/gi, "").trim();
    return ((parsed.items ?? []) as TickerNewsItem[]).map((it) => ({
      ...it,
      headline: cleanStr(it.headline),
      summary: cleanStr(it.summary),
      source: cleanStr(it.source),
    }));
  } catch (e) {
    console.error(`[ticker-news] ${ticker} fetch failed`, e);
    return [];
  }
}

const cachedTickerNews = unstable_cache(
  fetchTickerNewsRaw,
  ["ticker-news"],
  { tags: ["ticker-news"], revalidate: 1800 } // 30 min — today's news changes
);

export async function fetchTickerNews(
  ticker: string,
  companyName: string
): Promise<TickerNewsItem[]> {
  return cachedTickerNews(ticker, companyName);
}

// ── City-specific local news ─────────────────────────────────────────────
// News from specific cities (e.g., Indianapolis, Tallahassee). Cached 30 min.
export async function fetchCityNewsRaw(
  cities: string[]
): Promise<NewsItem[]> {
  if (cities.length === 0) return [];

  const queries = cities
    .map((c) => `**${c.toUpperCase()}:** Breaking local news in ${c} today`)
    .join("\n");

  const prompt = `Find the top local news stories from the following cities. Use web search to get current results.

${queries}

Return up to 5 stories per city (so up to ${cities.length * 5} total). Return JSON in this exact format inside a single \`\`\`json ... \`\`\` block:
{
  "items": [
    {
      "headline": "...",
      "source": "...",
      "url": "...",
      "summary": "1-2 sentence summary",
      "topic": "City, State"
    }
  ]
}

Sort each city's stories with the most important first. Prefer local news sources, local government websites, and regional news outlets. Skip paywalled stories. Do not invent URLs. Do NOT include <cite> tags or any HTML in your response.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      messages: [{ role: "user", content: prompt }],
    });

    const fullText = response.content
      .filter((b) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b) => (b as any).text as string)
      .join("\n");

    if (!fullText) {
      console.error("[city-news] no text content; stop_reason=", response.stop_reason);
      return [];
    }

    const fencedMatch = fullText.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    const bareMatch = fullText.match(/{[\s\S]*"items"[\s\S]*}/);
    const jsonStr = fencedMatch?.[1] ?? bareMatch?.[0];

    if (!jsonStr) {
      console.error("[city-news] no JSON found in response", fullText.slice(0, 300));
      return [];
    }

    const parsed = JSON.parse(jsonStr);
    const clean = (s: string) => (s ?? "").replace(/<\/?cite[^>]*>/gi, "").trim();
    return ((parsed.items ?? []) as NewsItem[]).map((it) => ({
      ...it,
      headline: clean(it.headline),
      summary: clean(it.summary),
      source: clean(it.source),
    }));
  } catch (e) {
    console.error("[city-news] fetch failed", e);
    return [];
  }
}

const cachedFetchCityNews = unstable_cache(
  fetchCityNewsRaw,
  ["city-news"],
  { tags: ["city-news"], revalidate: 1800 } // 30 min — local news changes frequently
);

export async function fetchCityNews(cities: string[]): Promise<NewsItem[]> {
  // Sort the city list so different orderings share the same cache entry.
  const sorted = [...cities].sort();
  return cachedFetchCityNews(sorted);
}
