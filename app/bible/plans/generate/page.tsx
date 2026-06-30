import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlanGenerator from "./PlanGenerator";

export default async function GeneratePlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const menuUser = { email: user.email, name: user.user_metadata?.full_name ?? user.email, avatarUrl: user.user_metadata?.avatar_url ?? null };
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", paddingBottom: 80 }}>
      <PlanGenerator userId={user.id} />
    </div>
  );
}
