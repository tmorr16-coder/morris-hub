export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import SettingsForm from "../_components/SettingsForm";

export default async function InvestingSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const prefs = await getPreferences(user.id);
  return (
    <IOSScreen>
      <LargeTitle title="Investing" subtitle="Watchlist tickers · categories" />
      <div style={{ padding: "8px 16px 0" }}>
        <SettingsForm initialPrefs={prefs} only={["set-stocks", "set-investment-categories"]} />
      </div>
      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
