export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { serpapiConfigured } from "@/lib/serpapi-travel";
import { LargeTitle } from "@/components/ios";
import PlanClient from "../_components/PlanClient";

export default async function TravelPlanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  return (
    <div className="ios-scroll">
      <LargeTitle title="Trip Planner" subtitle="Your AI travel agent" />
      <div style={{ padding: "0 16px" }}>
        <PlanClient connected={serpapiConfigured()} />
      </div>
      <p className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "8px 20px 0", lineHeight: 1.5 }}>
        Plans with real flight, hotel, activity and event data, personalized to your saved preferences & loyalty programs.
        Educational planning aid — confirm prices and availability before booking.
      </p>
      <div style={{ height: 24 }} />
    </div>
  );
}
