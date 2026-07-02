export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";
import FamilyManagementClient from "./_components/FamilyManagementClient";

export default async function FamilySettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const prefs = await getPreferences(user.id);

  // Fetch everything in parallel
  const [circleResult, sentResult, pendingResult, usersResult] = await Promise.all([
    // My family members (who accepted my invites)
    service.schema("hub").from("family_members")
      .select("id, member_user_id, role, display_name, nickname, birth_year")
      .eq("user_id", user.id),
    // Invitations I sent
    service.schema("hub").from("family_invitations")
      .select("id, invite_email, display_name, role, birth_year, status, created_at, responded_at")
      .eq("inviter_id", user.id)
      .order("created_at", { ascending: false }),
    // Invitations pending for me
    service.schema("hub").from("family_invitations")
      .select("id, inviter_id, display_name, role, birth_year, created_at")
      .eq("invite_email", user.email?.toLowerCase() ?? "")
      .eq("status", "pending"),
    // All platform users for name/email lookup
    service.auth.admin.listUsers({ perPage: 200 }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authUsers: any[] = usersResult?.data?.users ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMap = new Map(authUsers.map((u: any) => [u.id, {
    full_name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
    email: u.email ?? null,
  }]));

  // Fetch app_access for child members so the parent can edit it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const childIds = ((circleResult.data ?? []) as any[])
    .filter((m) => m.role === "child")
    .map((m) => m.member_user_id as string);
  const childAccessMap = new Map<string, string[]>();
  if (childIds.length > 0) {
    const { data: childPrefs } = await service.schema("hub").from("preferences")
      .select("user_id, app_access")
      .in("user_id", childIds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (childPrefs ?? []) as any[]) {
      childAccessMap.set(p.user_id, p.app_access ?? []);
    }
  }

  // Enrich circle members with auth user data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circle = ((circleResult.data ?? []) as any[]).map((m) => ({
    id: m.id,
    member_user_id: m.member_user_id,
    role: m.role ?? "adult",
    display_name: m.display_name ?? m.nickname ?? null,
    full_name: userMap.get(m.member_user_id)?.full_name ?? null,
    email: userMap.get(m.member_user_id)?.email ?? null,
    birth_year: m.birth_year ?? null,
    appAccess: m.role === "child" ? (childAccessMap.get(m.member_user_id) ?? []) : null,
  }));

  // Sent invitations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sentInvites = (sentResult.data ?? []) as any[];

  // Pending invitations addressed to this user — enrich with inviter info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingInvites = ((pendingResult.data ?? []) as any[]).map((inv) => ({
    id: inv.id,
    inviter_email: userMap.get(inv.inviter_id)?.email ?? "Unknown",
    inviter_name: userMap.get(inv.inviter_id)?.full_name ?? null,
    display_name: inv.display_name,
    role: inv.role,
    birth_year: inv.birth_year ?? null,
  }));

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    appAccess: prefs.app_access ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="hub" user={menuUser} />
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "32px 20px 100px" }}>
        <h1 className="serif" style={{ fontSize: 32, marginBottom: 6 }}>
          Family Circle
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 32, lineHeight: 1.6, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          Invite family members, assign roles, and control what shared features are available to each person.
        </p>

        <FamilyManagementClient
          circle={circle}
          sentInvites={sentInvites}
          pendingInvites={pendingInvites}
          userId={user.id}
        />
      </main>
    </div>
  );
}
