export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { LargeTitle, Icons } from "@/components/ios";
import CareerProfileClient from "./_components/CareerProfileClient";

export default async function CareerProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    <div className="ios-scroll">
      <Link href="/career" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-tint)", padding: "6px 16px 0", fontWeight: 500 }} className="ios-subhead">
        <Icons.ChevronLeft style={{ width: 16, height: 16 }} /> Career
      </Link>
      <LargeTitle title="Profile" subtitle="Your resume, title & career assessment" />
      <CareerProfileClient profile={profile} />
    </div>
  );
}
