import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import { TabBar } from "@/components/ios";

export default async function TravelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prefs = await getPreferences(user.id);
  const appAccess = prefs.app_access ?? null;
  if (Array.isArray(appAccess) && !appAccess.includes("travel")) {
    redirect("/home");
  }

  return (
    <div data-ui="ios">
      {children}
      <TabBar current="more" currentUserId={user.id} sourceApp="travel" />
    </div>
  );
}
