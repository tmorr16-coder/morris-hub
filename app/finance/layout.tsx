import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import { TabBar } from "@/components/ios";
import PinGate from "./_components/PinGate";

export const metadata: Metadata = { title: "Money · morrisai.family" };

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [prefs, pinResult] = await Promise.all([
    getPreferences(user.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createServiceClient() as any)
      .schema("hub")
      .from("preferences")
      .select("finance_pin")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!prefs.app_access?.includes("finance")) redirect("/home");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const financePin: string | null = (pinResult.data as any)?.finance_pin ?? null;

  return (
    <div data-ui="ios">
      <PinGate enabled={!!financePin} correctPin={financePin ?? ""}>
        {children}
      </PinGate>
      <TabBar current="more" currentUserId={user.id} sourceApp="finance" />
    </div>
  );
}
