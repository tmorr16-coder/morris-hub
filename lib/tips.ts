import { createServiceClient } from "./supabase/server";

export interface ClaudeTip {
  id: string;
  title: string;
  body: string;
  category: string;
}

// Random tip per page load — gives fresh variety every visit
export async function getTodaysTip(): Promise<ClaudeTip | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data } = await service
    .schema("hub")
    .from("claude_tips")
    .select("id, title, body, category");

  const tips = (data ?? []) as ClaudeTip[];
  if (tips.length === 0) return null;

  return tips[Math.floor(Math.random() * tips.length)];
}
