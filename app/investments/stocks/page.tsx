export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import { getAlpacaStatus } from "@/lib/alpaca";
import ResearchLayout from "../_components/ResearchLayout";

export default async function InvestmentsStocksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const prefs = await getPreferences(user.id);
  if (!prefs.app_access?.includes("investments")) {
    redirect("/home");
  }

  const alpaca = await getAlpacaStatus(user.id).catch(() => ({ connected: false, isPaper: true }));

  return (
    <ResearchLayout
      watchedTickers={prefs.watched_stocks ?? []}
      brokerageConnected={alpaca.connected}
    />
  );
}
