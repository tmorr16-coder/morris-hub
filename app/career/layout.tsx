import PlatformMenu from "@/components/PlatformMenu";
import { createClient } from "@/lib/supabase/server";
import CareerSubNav from "./_components/CareerSubNav";

export default async function CareerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const menuUser = user
    ? {
        email: user.email,
        name: user.user_metadata?.full_name ?? null,
        avatarUrl: user.user_metadata?.avatar_url ?? null,
      }
    : null;

  return (
    <>
      <PlatformMenu currentApp="career" user={menuUser} />
      <CareerSubNav />
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "24px 28px 80px",
        }}
      >
        {children}
      </div>
    </>
  );
}
