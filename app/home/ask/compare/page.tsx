export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { openrouterConfigured, COMPARE_MODELS, LIVE_MODELS, MORE_MODELS, newestFrom, type CatalogModel } from "@/lib/openrouter";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import CompareClient from "./CompareClient";

export type Pricing = Record<string, { prompt: number; completion: number }>;

// Live per-token pricing plus the newest models in the catalog, so the picker
// offers models released after this code shipped (and can price them).
async function loadCatalog(): Promise<{ pricing: Pricing; newest: CatalogModel[] }> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { next: { revalidate: 3600 } });
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = (data.data ?? []) as any[];
    const curated = new Set([...COMPARE_MODELS, ...LIVE_MODELS, ...MORE_MODELS].map((m) => m.id));
    const newest = newestFrom(all, curated);
    const wanted = new Set([...curated, ...newest.map((m) => m.id)]);
    const pricing: Pricing = {};
    for (const m of all) {
      if (wanted.has(m.id)) pricing[m.id] = { prompt: parseFloat(m.pricing?.prompt ?? "0"), completion: parseFloat(m.pricing?.completion ?? "0") };
    }
    return { pricing, newest };
  } catch { return { pricing: {}, newest: [] }; }
}

export default async function ComparePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { pricing, newest } = await loadCatalog();

  return (
    <IOSScreen>
      <LargeTitle brand title="Ask the panel" subtitle="One question · Claude, Gemini & GPT each weigh in" />
      <div style={{ padding: "0 16px" }}>
        <CompareClient connected={openrouterConfigured()} pricing={pricing} newest={newest} />
      </div>
      <p className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "10px 20px 0", lineHeight: 1.5 }}>
        Puts your question to a panel of models via OpenRouter (billed per use). Swipe between answers, or synthesize them into one.
      </p>
      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
