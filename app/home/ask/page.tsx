export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";
import HubChat from "../_components/HubChat";

export default async function AskPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const [prefs, profileResult] = await Promise.all([
    getPreferences(user.id),
    service.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const isAdmin = (profileResult.data as { role?: string } | null)?.role === "admin";
  const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "there";
  const firstName = name.split(" ")[0];

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    isAdmin,
    appAccess: prefs.app_access ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="ask" user={menuUser} />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 100px" }}>
        <h1 className="serif" style={{ fontSize: 36, marginBottom: 8 }}>
          Ask <span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>Morris</span>
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 28, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          Ask anything about your day, your family, your health, finances, or career.
        </p>
        <HubChat firstName={firstName} />
      </main>
    </div>
  );
}
