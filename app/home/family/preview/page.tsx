export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";

export default async function PreviewPickerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prefs = await getPreferences(user.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data: circleData } = await service.schema("hub").from("family_members")
    .select("member_user_id, display_name, nickname")
    .eq("user_id", user.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleRows = (circleData ?? []) as any[];

  const memberIds = circleRows.map((m) => m.member_user_id as string);
  const userMap = new Map<string, { full_name: string | null; email: string | null }>();
  if (memberIds.length > 0) {
    const { data: users } = await service.auth.admin.listUsers({ perPage: 200 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const u of (users?.users ?? []) as any[]) {
      userMap.set(u.id, {
        full_name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
        email: u.email ?? null,
      });
    }
  }

  const members = circleRows.map((m) => ({
    id: m.member_user_id as string,
    label: (m.display_name
      ?? m.nickname
      ?? userMap.get(m.member_user_id)?.full_name
      ?? userMap.get(m.member_user_id)?.email
      ?? "Member") as string,
  }));

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    appAccess: prefs.app_access ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="family" user={menuUser} />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 100px" }}>
        <Link href="/home/family" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--color-ink-3)", textDecoration: "none", marginBottom: 20 }}>
          ← Family
        </Link>
        <h1 className="serif" style={{ fontSize: 30, marginBottom: 6 }}>Preview as a family member</h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 28, lineHeight: 1.6 }}>
          See exactly what someone else in your circle can see about you — computed entirely from your own
          sharing settings, no access to their account required.
        </p>

        {members.length === 0 ? (
          <div style={{ fontSize: 14, color: "var(--color-ink-4)" }}>No one in your family circle yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {members.map((m) => (
              <Link key={m.id} href={`/home/family/preview/${m.id}`} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
                borderRadius: 10, textDecoration: "none", color: "var(--color-ink)",
              }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{m.label}</span>
                <span style={{ fontSize: 18, color: "var(--color-ink-4)" }}>›</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
