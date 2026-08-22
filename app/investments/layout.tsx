import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { hasModuleAccess } from "@/lib/module-access";
import { TabBar } from "@/components/ios";

export default async function InvestmentsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!(await hasModuleAccess(user.id, "investments"))) redirect("/home");

  return (
    <div data-ui="ios">
      {children}
      <TabBar current="more" currentUserId={user.id} sourceApp="investments" />
    </div>
  );
}
