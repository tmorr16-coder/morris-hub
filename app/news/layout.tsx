import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { TabBar } from "@/components/ios";

export default async function NewsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div data-ui="ios">
      {children}
      <TabBar current="more" currentUserId={user.id} sourceApp="news" />
    </div>
  );
}
