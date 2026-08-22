import { getCurrentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TabBar } from "@/components/ios";

export default async function BibleLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div data-ui="ios">
      {children}
      <TabBar current="more" currentUserId={user.id} sourceApp="bible" />
    </div>
  );
}
