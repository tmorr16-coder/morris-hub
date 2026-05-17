import { createServiceClient } from "./supabase/server";

export interface ClaudeTip {
  id: string;
  title: string;
  body: string;
  category: string;
}

// Rotate tips by day-of-year so the tip is stable for the day but changes daily
export async function getTodaysTip(): Promise<ClaudeTip | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data } = await service
    .schema("hub")
    .from("claude_tips")
    .select("id, title, body, category")
    .order("id", { ascending: true });

  const tips = (data ?? []) as ClaudeTip[];
  if (tips.length === 0) return null;

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400_000);
  return tips[dayOfYear % tips.length];
}
