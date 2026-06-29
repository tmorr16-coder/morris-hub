import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PlatformMenu from "@/components/PlatformMenu";
import FinanceSubNav from "./_components/FinanceSubNav";

export const metadata: Metadata = { title: "Finance · morrisai.family" };

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const menuUser = user ? {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    isAdmin: false,
  } : null;

  return (
    <>
      <PlatformMenu currentApp="finance" user={menuUser} />
      <FinanceSubNav />
      <div data-section="finance">
        {children}
      </div>
    </>
  );
}
