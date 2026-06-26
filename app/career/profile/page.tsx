export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

  return <CareerProfileClient profile={profile} />;
}
