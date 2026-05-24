// Claude-curated sports scores using the web_search server tool.
// Fetches latest game results, upcoming games, and standings for multiple teams/leagues.

import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";

const client = new Anthropic();

export interface SportsGame {
  opponent: string;
  score?: string;
  date: string;
  won?: boolean;
}

export interface SportsScore {
  teamId: string;
  league: string;
  teamName: string;
  latestGame?: SportsGame;
  nextGame?: SportsGame;
  record: string;
  standing?: string;
}

async function fetchSportsRaw(teams: string[]): Promise<SportsScore[]> {
  if (teams.length === 0) return [];

  // Format teams for the prompt (e.g., "MLB:ATL" -> "Atlanta Braves (MLB)")
  const teamQueries = teams
    .map((t) => {
      const [league, code] = t.split(":");
      return `**${league}:${code}**`;
    })
    .join(", ");

  const prompt = `Find the current sports scores and standings for these teams: ${teamQueries}

For each team, find:
1. Latest game result (opponent, final score, date, win/loss)
2. Next scheduled game (opponent, date/time)
3. Current record (wins-losses)
4. Current standing in league/division if available

Use web search to get the most current information from official sources (ESPN, team websites, league sites).

Return JSON in this exact format inside a single \`\`\`json ... \`\`\` block:
{
  "scores": [
    {
      "teamId": "MLB:ATL",
      "league": "MLB",
      "teamName": "Atlanta Braves",
      "latestGame": {
        "opponent": "New York Mets",
        "score": "3-2",
        "date": "2026-05-23",
        "won": true
      },
      "nextGame": {
        "opponent": "Philadelphia Phillies",
        "date": "2026-05-24",
        "time": "7:05 PM ET"
      },
      "record": "25-18",
      "standing": "1st NL East"
    }
  ]
}

Ensure all dates are formatted consistently. For upcoming games without times, omit the time field. Do NOT include <cite> tags or any HTML in your response.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
      messages: [{ role: "user", content: prompt }],
    });

    // Pull all text blocks (the model may emit multiple after tool use)
    const fullText = response.content
      .filter((b) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b) => (b as any).text as string)
      .join("\n");

    if (!fullText) {
      console.error("[sports] no text content; stop_reason=", response.stop_reason);
      return [];
    }

    // Extract the JSON block — may be in markdown fences or bare
    const fencedMatch = fullText.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    const bareMatch = fullText.match(/{[\s\S]*"scores"[\s\S]*}/);
    const jsonStr = fencedMatch?.[1] ?? bareMatch?.[0];

    if (!jsonStr) {
      console.error("[sports] no JSON found in response", fullText.slice(0, 300));
      return [];
    }

    const parsed = JSON.parse(jsonStr);
    // Strip <cite> tags if any
    const clean = (s: string | undefined) =>
      (s ?? "").replace(/<\/?cite[^>]*>/gi, "").trim();

    return ((parsed.scores ?? []) as SportsScore[]).map((score) => ({
      ...score,
      teamName: clean(score.teamName),
      record: clean(score.record),
      standing: score.standing ? clean(score.standing) : undefined,
      latestGame: score.latestGame
        ? {
            ...score.latestGame,
            opponent: clean(score.latestGame.opponent),
          }
        : undefined,
      nextGame: score.nextGame
        ? {
            ...score.nextGame,
            opponent: clean(score.nextGame.opponent),
          }
        : undefined,
    }));
  } catch (e) {
    console.error("[sports] fetch failed", e);
    return [];
  }
}

// Cache the Claude+web_search call for 30 minutes per sorted-team key.
// First load takes ~5-10s; subsequent loads from any user with the same
// team set are served instantly until revalidation.
const cachedFetchSports = unstable_cache(
  fetchSportsRaw,
  ["sports"],
  { tags: ["sports"], revalidate: 1800 } // 30 min — sports scores update daily
);

export async function fetchSportsData(teams: string[]): Promise<SportsScore[]> {
  // Sort the team list so different orderings share the same cache entry.
  const sorted = [...teams].sort();
  return cachedFetchSports(sorted);
}
