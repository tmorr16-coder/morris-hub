export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import OnboardingFlow from "./_components/OnboardingFlow";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prefs = await getPreferences(user.id);

  // Already onboarded — send to home
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((prefs as any).onboarding_completed) redirect("/home");

  const initialName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "";

  return (
    <OnboardingFlow
      initialName={initialName}
      initialLocation={prefs.location_name ?? ""}
    />
  );
}
