export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { LargeTitle } from "@/components/ios";
import TripsClient from "../_components/TripsClient";

export default async function TripsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data: trips } = await db
    .schema("travel").from("trips")
    .select("*")
    .eq("user_id", user.id) // scoping-ok: user-scoped read
    .order("depart_date", { ascending: true });

  const ids = (trips ?? []).map((t: { id: string }) => t.id);
  let segments: unknown[] = [];
  if (ids.length) {
    const { data } = await db
      .schema("travel").from("trip_segments")
      .select("*")
      .eq("user_id", user.id) // scoping-ok: user-scoped read
      .in("trip_id", ids)
      .order("start_at", { ascending: true });
    segments = data ?? [];
  }

  return (
    <div className="ios-scroll">
      <LargeTitle brand title="Trips" subtitle="Upcoming and active travel" />
      <div style={{ padding: "0 16px" }}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <TripsClient trips={(trips ?? []) as any} segments={segments as any} />
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}
