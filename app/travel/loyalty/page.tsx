export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { LargeTitle } from "@/components/ios";
import type { LoyaltyProgram } from "../types";
import LoyaltyClient from "../_components/LoyaltyClient";

export default async function LoyaltyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data } = await db
    .schema("travel").from("loyalty_programs")
    .select("*").eq("user_id", user.id) // scoping-ok: user-scoped read
    .order("category", { ascending: true });

  const programs: LoyaltyProgram[] = data ?? [];

  return (
    <div className="ios-scroll">
      <LargeTitle title="Loyalty" subtitle="Programs & memberships" />
      <div style={{ padding: "0 16px" }}>
        <LoyaltyClient initial={programs} />
      </div>
      <p className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "8px 20px 0", lineHeight: 1.5 }}>
        Search results flag when a flight or hotel earns points in one of your programs.
      </p>
      <div style={{ height: 24 }} />
    </div>
  );
}
