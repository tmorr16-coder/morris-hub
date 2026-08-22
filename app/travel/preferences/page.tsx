export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { LargeTitle } from "@/components/ios";
import { DEFAULT_PREFS, type TravelPreferences } from "../types";
import PreferencesClient from "../_components/PreferencesClient";

export default async function TravelPreferencesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data } = await db
    .schema("travel").from("preferences")
    .select("*").eq("user_id", user.id).maybeSingle(); // scoping-ok: user-scoped read

  const prefs: TravelPreferences = data ?? { ...DEFAULT_PREFS };

  return (
    <div className="ios-scroll">
      <LargeTitle title="Preferences" subtitle="How you like to travel" />
      <div style={{ padding: "0 16px" }}>
        <PreferencesClient initial={prefs} />
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}
