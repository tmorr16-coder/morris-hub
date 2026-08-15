export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { openrouterConfigured, COMPARE_MODELS, MORE_MODELS } from "@/lib/openrouter";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import CompareClient from "./CompareClient";

export type Pricing = Record<string, { prompt: number; completion: number }>;

// Live per-token pricing for our models, for the pre-run cost estimate.
async function loadPricing(): Promise<Pricing> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { next: { revalidate: 3600 } });
    const data = await res.json();
    const ids = new Set([...COMPARE_MODELS, ...MORE_MODELS].map((m) => m.id));
    const map: Pricing = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const m of (data.data ?? []) as any[]) {
      if (ids.has(m.id)) map[m.id] = { prompt: parseFloat(m.pricing?.prompt ?? "0"), completion: parseFloat(m.pricing?.completion ?? "0") };
    }
    return map;
  } catch { return {}; }
}

export default async function ComparePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const pricing = await loadPricing();

  return (
    <IOSScreen>
      <LargeTitle brand title="Compare models" subtitle="Ask once · Claude, Gemini & GPT side by side" />
      <div style={{ padding: "0 16px" }}>
        <CompareClient connected={openrouterConfigured()} pricing={pricing} />
      </div>
      <p className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "10px 20px 0", lineHeight: 1.5 }}>
        Runs your question against multiple models via OpenRouter (billed per use). Swipe between answers, or synthesize them into one.
      </p>
      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
