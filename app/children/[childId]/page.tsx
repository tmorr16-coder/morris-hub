export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TabBar } from "@/components/ios";
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

  const workspace = await getChildWorkspace(childId, user.id, new Date());
  if (!workspace) notFound();

  const isSelf = workspace.memberUserId === user.id;

  return (
    <div data-ui="ios">
      <div className="ios-scroll">
        {isSelf && (
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 16px 0" }}>
            <ParentVisibilityNotice childId={childId} />
          </div>
        )}

        {workspace.ageTier === "elementary" && <ElementaryWorkspace data={workspace} viewerUserId={user.id} />}
        {workspace.ageTier === "teen" && <TeenWorkspace data={workspace} viewerUserId={user.id} />}
        {workspace.ageTier === "college" && <CollegeWorkspace data={workspace} viewerUserId={user.id} />}
      </div>
      <TabBar current="more" currentUserId={user.id} sourceApp="children" />
    </div>
  );
}
