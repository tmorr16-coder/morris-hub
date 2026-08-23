export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { openrouterConfigured } from "@/lib/openrouter";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import ImageClient from "./ImageClient";

export default async function ImagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  return (
    <IOSScreen>
      <LargeTitle brand title="Make an image" subtitle="Describe it · Gemini draws it" />
      <div style={{ padding: "0 16px" }}>
        <ImageClient connected={openrouterConfigured()} />
      </div>
      <p className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "10px 20px 0", lineHeight: 1.5 }}>
        Generates an image from a description via OpenRouter (billed per use). The exact cost is shown once it&rsquo;s drawn.
      </p>
      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
