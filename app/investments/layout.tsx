import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";
import MoneySubNav from "../finance/_components/MoneySubNav";
import PinGate from "../finance/_components/PinGate";

export default async function InvestmentsLayout({ children }: { children: React.ReactNode }) {
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

  if (!prefs.app_access?.includes("investments")) redirect("/home");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const financePin: string | null = (pinResult.data as any)?.finance_pin ?? null;

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    appAccess: prefs.app_access ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="investments" user={menuUser} />
      <MoneySubNav />
      <PinGate enabled={!!financePin} correctPin={financePin ?? ""}>
        <div style={{ paddingBottom: 100 }}>
          {children}
        </div>
      </PinGate>
    </div>
  );
}
