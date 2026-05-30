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

// ── RSS-based News Subscriptions ──────────────────────────────────────────────

export interface RssArticle {
  title: string;
  url: string;
  summary: string;
  pubDate: string;        // ISO string
  sourceName: string;
  sourceId: string;
}

/** Lightweight RSS 2.0 / Atom parser — no external library needed */
function parseRss(xml: string, sourceName: string, sourceId: string): RssArticle[] {
  const articles: RssArticle[] = [];

  // Handle both RSS <item> and Atom <entry> elements
  const itemRe = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];

    const title = decode(tag(block, "title"));

    // Atom: prefer <link rel="alternate" href="…"/> over <link rel="self" href="…"/>
    // RSS 2.0: <link>https://…</link>
    const link = atomAlternateHref(block) || tag(block, "link") || tag(block, "guid");

    const rawDesc = tag(block, "description") || tag(block, "summary") || tag(block, "content");
    const desc  = decode(stripTags(rawDesc));
    const date  = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date");

    if (!title || !link) continue;
    articles.push({
      title: decode(title),
      url: link.trim(),
      summary: desc.slice(0, 240).trim(),
      pubDate: date ? (() => { try { return new Date(date).toISOString(); } catch { return new Date().toISOString(); } })() : new Date().toISOString(),
      sourceName,
      sourceId,
    });
    if (articles.length >= 7) break;
  }
  return articles;
}

function tag(xml: string, name: string): string {
  // Match both <tag>…</tag> and <ns:tag>…</ns:tag>
  const re = new RegExp(`<(?:[a-z]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-z]+:)?${name}>`, "i");
  const m = re.exec(xml);
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

/** Atom feeds: extract href from <link rel="alternate"> or any <link href=""> */
function atomAlternateHref(block: string): string {
  // Prefer rel="alternate" (article link) over rel="self" (feed link)
  const alternate = /<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i.exec(block)
    ?? /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']alternate["']/i.exec(block);
  if (alternate) return alternate[1];
  // Fall back to any <link href=""> that isn't rel="self" or rel="hub"
  const anyLink = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = anyLink.exec(block)) !== null) {
    const tag = match[0];
    if (!tag.includes('rel="self"') && !tag.includes("rel='self'") &&
        !tag.includes('rel="hub"')  && !tag.includes("rel='hub'")) {
      return match[1];
    }
  }
  return "";
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decode(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

async function fetchRssFeed(
  rssUrl: string,
  sourceName: string,
  sourceId: string,
): Promise<RssArticle[]> {
  try {
    const res = await fetch(rssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; morrisai-hub/1.0)" },
      next: { revalidate: 1800 }, // cache 30 min
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRss(xml, sourceName, sourceId);
  } catch {
    return [];
  }
}

export async function fetchSubscriptionFeeds(
  sources: Array<{ id: string; name: string; rss: string; enabled: boolean }>,
): Promise<RssArticle[]> {
  const enabled = sources.filter((s) => s.enabled);
  if (enabled.length === 0) return [];

  const results = await Promise.all(
    enabled.map((s) => fetchRssFeed(s.rss, s.name, s.id))
  );

  // Interleave: take up to 3 articles per source, sorted newest-first
  return results
    .flat()
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
}
