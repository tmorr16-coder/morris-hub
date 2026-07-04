export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import HubChat from "../_components/HubChat";

export default async function AskPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "there";
  const firstName = name.split(" ")[0];

  return (
    <IOSScreen>
      <LargeTitle
        brand
        title="Ask Morris"
        subtitle="Your AI across your day, family, health, finances & career"
        avatarInitial={(user.user_metadata?.full_name || user.email || "?")[0]?.toUpperCase()}
      />

      <div style={{ padding: "0 16px" }}>
        <HubChat firstName={firstName} />
      </div>

      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
