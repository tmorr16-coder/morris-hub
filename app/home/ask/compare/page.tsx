export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { openrouterConfigured } from "@/lib/openrouter";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import CompareClient from "./CompareClient";

export default async function ComparePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <IOSScreen>
      <LargeTitle brand title="Compare models" subtitle="Ask once · Claude, Gemini & GPT side by side" />
      <div style={{ padding: "0 16px" }}>
        <CompareClient connected={openrouterConfigured()} />
      </div>
      <p className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "10px 20px 0", lineHeight: 1.5 }}>
        Runs your question against multiple models via OpenRouter (billed per use). Swipe between answers, or synthesize them into one.
      </p>
      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
