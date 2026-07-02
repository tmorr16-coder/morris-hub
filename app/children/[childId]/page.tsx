export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";
import { getChildWorkspace } from "../_lib/children";
import ParentVisibilityNotice from "../_components/ParentVisibilityNotice";
import ElementaryWorkspace from "../_components/ElementaryWorkspace";
import TeenWorkspace from "../_components/TeenWorkspace";
import CollegeWorkspace from "../_components/CollegeWorkspace";

export default async function ChildWorkspacePage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prefs = await getPreferences(user.id);
  const workspace = await getChildWorkspace(childId, user.id, new Date());
  if (!workspace) notFound();

  const isSelf = workspace.memberUserId === user.id;

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    appAccess: prefs.app_access ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="children" user={menuUser} />
      {isSelf && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 0" }}>
          <ParentVisibilityNotice childId={childId} />
        </div>
      )}
      {!isSelf && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 0" }}>
          <Link href="/children" style={{ fontSize: 12, color: "var(--color-ink-3)", textDecoration: "none" }}>← All children</Link>
        </div>
      )}
      {workspace.ageTier === "elementary" && <ElementaryWorkspace data={workspace} />}
      {workspace.ageTier === "teen" && <TeenWorkspace data={workspace} />}
      {workspace.ageTier === "college" && <CollegeWorkspace data={workspace} />}
    </div>
  );
}
