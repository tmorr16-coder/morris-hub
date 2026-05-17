// Claude-curated news using the web_search server tool.
// One call per refresh — cached for 4 hours by Next.js fetch cache.

import Anthropic from "@anthropic-ai/sdk";

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

export async function fetchNews(topics: string[]): Promise<NewsItem[]> {
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
