export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import SettingsForm from "../_components/SettingsForm";

export default async function VoiceSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const prefs = await getPreferences(user.id);
  return (
    <IOSScreen>
      <LargeTitle title="Read-aloud voice" subtitle="Text-to-speech voice & speed" />
      <div style={{ padding: "8px 16px 0" }}>
        <SettingsForm initialPrefs={prefs} only={["set-read-aloud-voice"]} />
      </div>
      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
