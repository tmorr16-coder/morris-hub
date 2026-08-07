import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasModuleAccess } from "@/lib/module-access";
import { TabBar } from "@/components/ios";

export default async function CareerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await hasModuleAccess(user.id, "career"))) redirect("/home");

  return (
    <div data-ui="ios">
      {children}
      <TabBar current="more" currentUserId={user.id} sourceApp="career" />
    </div>
  );
}
