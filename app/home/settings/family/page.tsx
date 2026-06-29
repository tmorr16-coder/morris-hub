export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import PlatformMenu from "@/components/PlatformMenu";
import FamilyCircleClient from "./_components/FamilyCircleClient";

export default async function FamilySettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Fetch current family circle and all platform users in parallel
  const [{ data: members }, { data: profiles }] = await Promise.all([
    service.schema("hub").from("family_members")
      .select("id, member_user_id, nickname")
      .eq("user_id", user.id),
    service.from("profiles")
      .select("id, full_name, email, avatar_url")
      .neq("id", user.id)
      .order("full_name", { ascending: true }),
  ]);

  const circleIds = new Set(
    ((members ?? []) as { member_user_id: string }[]).map((m) => m.member_user_id)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const everyone = ((profiles ?? []) as any[]).map((p) => ({
    ...p,
    in_circle: circleIds.has(p.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    circle_id: ((members ?? []) as any[]).find((m) => m.member_user_id === p.id)?.id ?? null,
  }));

  const menuUser = {
    name: user.user_metadata?.full_name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="hub" user={menuUser} />
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "32px 28px 80px" }}>
        <Link href="/home/settings" style={{ fontSize: 12, color: "var(--color-ink-3)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 24 }}>
          ← Settings
        </Link>
        <h1 style={{ fontSize: 32, fontWeight: 400, fontFamily: "var(--font-display)", marginBottom: 6, color: "var(--color-ink)" }}>
          Family Circle
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 32, lineHeight: 1.6 }}>
          People in your family circle can share financial accounts, health data, and other information with you — and you with them. Each person you add must also add you back for two-way sharing.
        </p>
        <FamilyCircleClient initialEveryone={everyone} />
      </main>
    </div>
  );
}
