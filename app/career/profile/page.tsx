export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { LargeTitle } from "@/components/ios";
import CareerProfileClient from "./_components/CareerProfileClient";

export default async function CareerProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: profile } = await db
    .schema("career")
    .from("career_profile")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="ios-scroll">      <LargeTitle title="Profile" subtitle="Your resume, title & career assessment" />
      <CareerProfileClient profile={profile} />
    </div>
  );
}
