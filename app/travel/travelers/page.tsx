export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { LargeTitle } from "@/components/ios";
import type { Traveler } from "../types";
import TravelersClient from "../_components/TravelersClient";

export interface FamilySuggestion { id: string; name: string; birthYear: number | null }

export default async function TravelersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const [{ data: travelers }, { data: fam }] = await Promise.all([
    db.schema("travel").from("travelers").select("*").eq("user_id", user.id).order("is_self", { ascending: false }), // scoping-ok: user-scoped read
    db.schema("hub").from("family_members").select("id, display_name, nickname, birth_year").eq("user_id", user.id), // scoping-ok: user-scoped read
  ]);

  const selfName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? "") as string;
  const suggestions: FamilySuggestion[] = [
    ...(selfName ? [{ id: "self", name: `${selfName} (you)`, birthYear: null }] : [{ id: "self", name: "Myself", birthYear: null }]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((fam ?? []) as any[]).map((f) => ({ id: f.id, name: f.display_name ?? f.nickname ?? "Family member", birthYear: f.birth_year ?? null })),
  ];

  return (
    <div className="ios-scroll">
      <LargeTitle title="Travelers" subtitle="Who you book for" />
      <div style={{ padding: "0 16px" }}>
        <TravelersClient initial={(travelers ?? []) as Traveler[]} suggestions={suggestions} selfName={selfName} />
      </div>
      <p className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "8px 20px 0", lineHeight: 1.5 }}>
        Used to book flights & hotels for you and your family. Passport details are only needed for international trips and
        are stored privately to your account. Nothing here charges anything — booking activates in a later step.
      </p>
      <div style={{ height: 24 }} />
    </div>
  );
}
