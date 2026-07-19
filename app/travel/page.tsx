export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { travelConfigured } from "@/lib/travel-search";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";
import WatchList from "./_components/WatchList";

export default async function TravelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const [{ data: prefs }, { count: loyaltyCount }] = await Promise.all([
    db.schema("travel").from("preferences").select("home_airport").eq("user_id", user.id).maybeSingle(), // scoping-ok: user-scoped read
    db.schema("travel").from("loyalty_programs").select("id", { count: "exact", head: true }).eq("user_id", user.id), // scoping-ok: user-scoped read
  ]);

  const connected = travelConfigured();
  const home = prefs?.home_airport as string | undefined;

  return (
    <div className="ios-scroll">
      <LargeTitle brand title="Travel" subtitle={home ? `Home base · ${home}` : "Flights · hotels · rewards"} />

      {!connected && (
        <div className="ios-list" style={{ margin: "0 16px 8px", padding: 14 }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            ✈️ Live flight &amp; hotel search activates once a search provider token (SerpApi or Duffel) is added. Preferences,
            loyalty programs, and price alerts all work now.
          </div>
        </div>
      )}

      <div style={{ padding: "0 16px" }}>
        <a href="/travel/search" className="ios-list" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "0 0 12px", padding: 18, textDecoration: "none" }}>
          <div>
            <div className="ios-headline" style={{ color: "var(--ios-label)", fontSize: 19 }}>Search flights &amp; hotels →</div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 3 }}>
              Filtered by your preferences · watch prices for alerts
            </div>
          </div>
          <IconBadge color="#2A7B8C"><Icons.PlaneIcon /></IconBadge>
        </a>
      </div>

      <Group header="Plan">
        <Cell lead={<IconBadge color="#8E44AD"><Icons.SparkleIcon /></IconBadge>} title="Loyalty programs" subtitle={loyaltyCount ? `${loyaltyCount} saved` : "Add airlines, hotels, cards"} href="/travel/loyalty" />
        <Cell lead={<IconBadge color="#8E8E93"><Icons.GearIcon /></IconBadge>} title="Travel preferences" subtitle="Home airport · cabin · airlines · alerts" href="/travel/preferences" />
      </Group>

      <WatchList />

      <div style={{ height: 24 }} />
    </div>
  );
}
