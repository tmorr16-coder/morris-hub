import { redirect } from "next/navigation";
import PlatformMenu from "@/components/PlatformMenu";
import PrivateIndicator from "@/components/PrivateIndicator";
import { createClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import CareerSubNav from "./_components/CareerSubNav";

export default async function CareerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prefs = await getPreferences(user.id);
  const appAccess = prefs.app_access ?? null;

  // Access gate — matches the pattern used by health, finance, investments, student-success
  if (Array.isArray(appAccess) && !appAccess.includes("career")) {
    redirect("/home");
  }

  const menuUser = {
    email: user.email,
    name: user.user_metadata?.full_name ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
    appAccess,
  };

  return (
    <>
      <PlatformMenu currentApp="career" user={menuUser} />
      <CareerSubNav />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 28px 100px" }}>
        <div style={{ marginBottom: 16 }}><PrivateIndicator /></div>
        {children}
      </div>
    </>
  );
}
