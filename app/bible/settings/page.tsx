export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

  const menuUser = { email: user.email, name: user.user_metadata?.full_name ?? user.email, avatarUrl: user.user_metadata?.avatar_url ?? null };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", paddingBottom: 80 }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 20px" }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif, serif)", fontSize: 26, fontWeight: 400, margin: "0 0 6px" }}>
          Bible Settings
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 28 }}>
          Personalise your reading experience.
        </p>
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
