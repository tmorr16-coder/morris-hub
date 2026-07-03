export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { LargeTitle, Icons } from "@/components/ios";
import CareerAdvisorClient from "./_components/CareerAdvisorClient";

export default async function CareerAdvisorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const [profileRes, goalsRes, learningRes] = await Promise.all([
    db
      .schema("career")
      .from("career_profile")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    db
      .schema("career")
      .from("career_goals")
      .select("id, title, horizon, status, progress_pct")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .schema("career")
      .from("career_learning")
      .select("id, title, status, notes")
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const profile = profileRes.data ?? null;
  const goals = goalsRes.data ?? [];
  const learningItems = learningRes.data ?? [];

  const hasProfile =
    profile !== null &&
    (profile.current_title ||
      profile.resume_text ||
      profile.assessment_completed);

  return (
    <div className="ios-scroll">
      <Link href="/career" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-tint)", padding: "6px 16px 0", fontWeight: 500 }} className="ios-subhead">
        <Icons.ChevronLeft style={{ width: 16, height: 16 }} /> Career
      </Link>
      <LargeTitle title="Advisor" subtitle="AI coaching on your goals & resume" />
      <CareerAdvisorClient
        profile={profile}
        goals={goals}
        learningItems={learningItems}
        hasProfile={!!hasProfile}
      />
    </div>
  );
}
