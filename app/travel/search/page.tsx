export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { travelConfigured } from "@/lib/travel-search";
import { LargeTitle } from "@/components/ios";
import { DEFAULT_PREFS, type TravelPreferences, type LoyaltyProgram } from "../types";
import SearchClient from "../_components/SearchClient";

export default async function TravelSearchPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const [{ data: prefsRow }, { data: loyalty }] = await Promise.all([
    db.schema("travel").from("preferences").select("*").eq("user_id", user.id).maybeSingle(), // scoping-ok: user-scoped read
    db.schema("travel").from("loyalty_programs").select("*").eq("user_id", user.id), // scoping-ok: user-scoped read
  ]);

  const prefs: TravelPreferences = prefsRow ?? { ...DEFAULT_PREFS };
  const programs: LoyaltyProgram[] = loyalty ?? [];

  return (
    <div className="ios-scroll">
      <LargeTitle title="Search" subtitle="Flights & hotels" />
      <div style={{ padding: "0 16px" }}>
        <SearchClient prefs={prefs} loyalty={programs} connected={travelConfigured()} />
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}
