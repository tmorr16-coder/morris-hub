export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";
import { listChildrenForParent } from "./_lib/children";
import ChildrenPickerClient from "./_components/ChildrenPickerClient";

export default async function ChildrenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prefs = await getPreferences(user.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    appAccess: prefs.app_access ?? null,
  };

  const { data: ownedChildren } = await service.schema("hub").from("family_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "child");

  if (ownedChildren?.length) {
    const cards = await listChildrenForParent(user.id, new Date());
    return (
      <div>
        <PlatformMenu currentApp="children" user={menuUser} />
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 100px" }}>
          <h1 className="serif" style={{ fontSize: 36, marginBottom: 8, margin: "0 0 8px" }}>Children</h1>
          <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 28, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            Manage and support each of your kids.
          </p>
          <ChildrenPickerClient cards={cards} />
        </main>
      </div>
    );
  }

  const { data: selfAsChild } = await service.schema("hub").from("family_members")
    .select("id")
    .eq("member_user_id", user.id)
    .eq("role", "child")
    .maybeSingle();

  if (selfAsChild) {
    redirect(`/children/${selfAsChild.id}`);
  }

  return (
    <div>
      <PlatformMenu currentApp="children" user={menuUser} />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 100px" }}>
        <h1 className="serif" style={{ fontSize: 32, marginBottom: 8 }}>Children</h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 20, lineHeight: 1.6 }}>
          You don&apos;t have any children in your circle yet. Add a managed profile (no login required — great for
          younger kids) or invite an older child by email from Family Settings.
        </p>
        <a href="/home/settings/family" style={{
          display: "inline-block", padding: "9px 20px", borderRadius: 10, border: "none",
          background: "var(--color-accent)", color: "#FFFDF8", fontSize: 13, fontWeight: 600, textDecoration: "none",
        }}>
          Go to Family Settings →
        </a>
      </main>
    </div>
  );
}
