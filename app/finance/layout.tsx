import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";
import PrivateIndicator from "@/components/PrivateIndicator";
import MoneySubNav from "./_components/MoneySubNav";
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

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    isAdmin: false,
    appAccess: prefs.app_access ?? null,
  };

  return (
    <>
      <PlatformMenu currentApp="finance" user={menuUser} />
      <MoneySubNav />
      <PinGate enabled={!!financePin} correctPin={financePin ?? ""}>
        <div data-section="finance" style={{ paddingBottom: 100 }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 20px 0" }}><PrivateIndicator /></div>
          {children}
        </div>
      </PinGate>
    </>
  );
}
