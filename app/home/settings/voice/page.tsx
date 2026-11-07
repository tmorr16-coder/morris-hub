export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import ReadAloudSettings from "@/components/ReadAloudSettings";

export default async function VoiceSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return (
    <IOSScreen>
      <LargeTitle title="Read-aloud voice" subtitle="Text-to-speech voice & speed" />
      <div style={{ padding: "8px 16px 0" }}>
        <ReadAloudSettings />
      </div>
      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
