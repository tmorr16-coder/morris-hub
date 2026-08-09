export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import { LargeTitle } from "@/components/ios";
import WeatherWidget from "../_components/WeatherWidget";

export default async function WeatherPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const prefs = await getPreferences(user.id);
  const hasLocation = prefs.latitude != null && prefs.longitude != null;

  return (
    <div className="ios-scroll" data-ui="ios">
      <LargeTitle title="Weather" subtitle={prefs.location_name ?? "Your location"} />
      <div style={{ padding: "0 16px" }}>
        {hasLocation ? (
          <WeatherWidget lat={prefs.latitude as number} lon={prefs.longitude as number} locationName={prefs.location_name ?? ""} />
        ) : (
          <div className="ios-list" style={{ margin: 0, padding: 18 }}>
            <div className="ios-subhead" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
              Set your location in <a href="/settings" style={{ color: "var(--ios-tint)" }}>Settings</a> to see the local forecast.
            </div>
          </div>
        )}
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}
