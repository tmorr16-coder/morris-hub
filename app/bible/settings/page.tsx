export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { LargeTitle } from "@/components/ios";
import SettingsClient from "./_components/SettingsClient";
import { KNOWN_VERSIONS } from "@/lib/bible-api";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Graceful fallback if user_preferences table not yet migrated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prefs: any = null;
  try {
    const { data } = await db.schema("bible").from("user_preferences")
      .select("preferred_bible_id, reminder_time, font_size")
      .eq("user_id", user.id).maybeSingle();
    prefs = data;
  } catch { /* table not yet created */ }

  return (
    <div className="ios-scroll">
      <LargeTitle title="Settings" subtitle="Personalize your reading experience" />
      <div style={{ padding: "0 16px 16px" }}>
        <SettingsClient
          versions={KNOWN_VERSIONS}
          initialPrefs={{
            preferredBibleId: prefs?.preferred_bible_id ?? "de4e12af7f28f599-02",
            reminderTime: prefs?.reminder_time ?? "",
            fontSize: prefs?.font_size ?? "md",
          }}
        />
      </div>
    </div>
  );
}
