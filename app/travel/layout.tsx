import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { TabBar } from "@/components/ios";

export default async function TravelLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Travel is a general, always-available module (like News / Ask Morris) — no
  // per-user access gate, so it works for existing accounts without a module grant.

  return (
    <div data-ui="ios">
      {children}
      <TabBar current="more" currentUserId={user.id} sourceApp="travel" />
    </div>
  );
}
