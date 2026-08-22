export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { LargeTitle } from "@/components/ios";
import TripDetailClient from "../../_components/TripDetailClient";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data: trip } = await db
    .schema("travel").from("trips")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id) // scoping-ok: user-scoped read
    .maybeSingle();
  if (!trip) notFound();

  const [{ data: segments }, { data: alerts }] = await Promise.all([
    db.schema("travel").from("trip_segments").select("*").eq("trip_id", id).eq("user_id", user.id).order("start_at", { ascending: true }), // scoping-ok: user-scoped read
    db.schema("travel").from("trip_alerts").select("*").eq("trip_id", id).eq("user_id", user.id).order("send_at", { ascending: true }), // scoping-ok: user-scoped read
  ]);

  return (
    <div className="ios-scroll">
      <LargeTitle brand title={trip.name} subtitle={trip.destination ?? "Itinerary"} />
      <div style={{ padding: "0 16px" }}>
        <TripDetailClient trip={trip} segments={segments ?? []} alerts={alerts ?? []} />
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}
