import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { hasModuleAccess } from "@/lib/module-access";
import { TabBar } from "@/components/ios";
import PinGate from "./_components/PinGate";

export const metadata: Metadata = { title: "Money · morrisai.family" };

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const [hasFinance, pinResult] = await Promise.all([
    hasModuleAccess(user.id, "finance"),
    service.schema("hub").from("preferences").select("finance_pin").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!hasFinance) redirect("/home");

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
