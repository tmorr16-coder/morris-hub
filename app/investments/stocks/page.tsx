export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import ResearchLayout from "../_components/ResearchLayout";

export default async function InvestmentsStocksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const prefs = await getPreferences(user.id);
  if (!prefs.app_access?.includes("investments")) {
    redirect("/home");
  }

  return <ResearchLayout watchedTickers={prefs.watched_stocks ?? []} />;
}
