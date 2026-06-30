import PlatformMenu from "@/components/PlatformMenu";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import BibleNav from "./_components/BibleNav";

export default async function BibleLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const [prefs, profileResult] = await Promise.all([
    getPreferences(user.id),
    service.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const isAdmin = (profileResult.data as { role?: string } | null)?.role === "admin";
  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    isAdmin,
    appAccess: prefs.app_access ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="bible" user={menuUser} />
      <BibleNav />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 20px 100px" }}>
        {children}
      </main>
    </div>
  );
}
