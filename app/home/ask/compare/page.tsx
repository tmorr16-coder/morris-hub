export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { openrouterConfigured, COMPARE_MODELS, LIVE_MODELS, MORE_MODELS, newestFrom, type CatalogModel } from "@/lib/openrouter";
import { TabBar } from "@/components/ios";
import CompareClient from "./CompareClient";
import "./panel.css";

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
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const { pricing, newest } = await loadCatalog();

  // Hand-rolled rather than wrapped in IOSScreen, because this screen wanted a
  // reading column of its own width. That is also why it missed the tab-bar
  // fix: IOSScreen lifts <TabBar/> out of the scrolling area, and a page that
  // builds its own scope has to do the same by hand. The bar is a sibling of
  // <main>, not a child, so it cannot scroll with the conversation.
  return (
    <div data-ui="ios" className="pc">
      <main className="ios-scroll" style={{ background: "transparent" }}>
        <div className="pc-col pc-col--wide" style={{ padding: "0 18px" }}>
          <header className="pc-head">
            <h1 className="pc-title">Ask the panel</h1>
            <p className="pc-sub">
              One question. Claude, Gemini and GPT each answer, and you read them side by side.
            </p>
          </header>

          <CompareClient connected={openrouterConfigured()} pricing={pricing} newest={newest} />

          <p className="pc-note" style={{ color: "var(--pc-text-3)", padding: "14px 2px 0" }}>
            Runs through OpenRouter and is billed per use. Attach files or images for the models to work
            from, keep asking follow-ups in the same conversation, and let them respond to each other or
            merge into a single answer.
          </p>
        </div>
      </main>
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </div>
  );
}
