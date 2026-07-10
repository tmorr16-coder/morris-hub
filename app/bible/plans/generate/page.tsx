import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlanGenerator from "./PlanGenerator";

export default async function GeneratePlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return (
    <div className="ios-scroll">
      <PlanGenerator userId={user.id} />
    </div>
  );
}
