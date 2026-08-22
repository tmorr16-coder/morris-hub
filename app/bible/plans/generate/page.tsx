import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import PlanGenerator from "./PlanGenerator";

export default async function GeneratePlanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return (
    <div className="ios-scroll">
      <PlanGenerator userId={user.id} />
    </div>
  );
}
