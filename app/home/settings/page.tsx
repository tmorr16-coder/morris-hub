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

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 28px 100px" }}>
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

        {/* Family Circle */}
        <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid var(--color-rule)" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 8 }}>
            Sharing
          </div>
          <Link
            href="/home/settings/family"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 18px", background: "var(--color-bg-card)",
              border: "1px solid var(--color-rule)", borderRadius: 10,
              textDecoration: "none", color: "var(--color-ink)", transition: "background 0.15s",
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Family Circle</div>
              <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 2 }}>
                Manage who you can share accounts and data with
              </div>
            </div>
            <span style={{ fontSize: 18, color: "var(--color-ink-4)" }}>›</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
