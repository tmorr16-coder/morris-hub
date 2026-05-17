import { createServiceClient } from "./supabase/server";

export interface ClaudeTip {
  id: string;
  title: string;
  body: string;
  category: string;
}

// Pick `count` distinct tips at random — used by the home page to fill
// the tip card with multiple entries (matches the news card's density).
export async function getRandomTips(count: number): Promise<ClaudeTip[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data } = await service
    .schema("hub")
    .from("claude_tips")
    .select("id, title, body, category");

  const tips = (data ?? []) as ClaudeTip[];
  if (tips.length === 0) return [];

  // Fisher-Yates shuffle, then take first `count`.
  const shuffled = [...tips];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
