import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";
import InvestmentsNav from "./_components/InvestmentsNav";

export default async function InvestmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Check if user has access to investments module
  const prefs = await getPreferences(user.id);
  if (!prefs.app_access?.includes("investments")) {
    redirect("/home");
  }

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="investments" user={menuUser} />
      <InvestmentsNav />
      {children}
    </div>
  );
}
