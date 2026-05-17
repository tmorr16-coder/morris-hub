export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";
import SettingsForm from "./_components/SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const prefs = await getPreferences(user.id);

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="hub" user={menuUser} />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 28px 80px" }}>
        <Link
          href="/home"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "var(--color-ink-3)",
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          ← Home
        </Link>

        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 8 }}>
          Settings
        </div>
        <h1 className="serif" style={{ fontSize: 36, lineHeight: 1.05, marginBottom: 32 }}>
          Preferences<span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>.</span>
        </h1>

        <SettingsForm initialPrefs={prefs} />
      </main>
    </div>
  );
}
