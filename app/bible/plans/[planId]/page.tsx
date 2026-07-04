import { redirect, notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import PlanProgress from "./PlanProgress";

/* eslint-disable @typescript-eslint/no-explicit-any */

const BUILT_IN_PLAN_IDS = ["bible-in-a-year", "nt-in-90-days", "psalms-30-days", "gospels-40-days", "proverbs-31-days", "sermon-on-mount"];

export default async function PlanDetailPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const db = createServiceClient() as any;

  // Load plan — could be user plan or built-in
  let plan: any = null;
  const isBuiltIn = BUILT_IN_PLAN_IDS.includes(planId);

  if (!isBuiltIn) {
    const { data } = await db.schema("bible").from("reading_plans").select("*").eq("id", planId).single();
    plan = data;
    if (!plan) redirect("/bible/plans");
    // Don't let the RLS-bypassing service client leak another user's private plan.
    if (plan && plan.user_id && !plan.is_public && plan.user_id !== user.id) notFound();
  }

  // Load enrollment
  let userPlan: any = null;
  if (!isBuiltIn && plan) {
    const { data } = await db.schema("bible").from("user_plans").select("*")
      .eq("user_id", user.id).eq("plan_id", planId).maybeSingle();
    userPlan = data;
  }

  // Load completions
  const { data: completions } = isBuiltIn ? { data: [] } : await db.schema("bible").from("reading_completions")
    .select("*").eq("user_id", user.id).eq("plan_id", planId);

  return (
    <div className="ios-scroll">
      <PlanProgress
        planId={planId}
        plan={plan}
        isBuiltIn={isBuiltIn}
        userPlan={userPlan}
        completions={completions ?? []}
        userId={user.id}
      />
    </div>
  );
}
