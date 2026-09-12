export const dynamic = "force-dynamic";

// Buddy, without needing to know whose Buddy.
//
// The tutor lives at /children/<id>/kid?open=buddy, which is fine for a link
// built from data and useless for a shortcut: a quick action on Today, or an
// icon saved to an iPad's home screen, has no child id to put in it. This
// resolves one and gets out of the way.
//
// It never guesses between children. The pin is an explicit choice and is
// honoured first; a household with exactly one young child has no ambiguity to
// resolve; anything else goes to the list and lets a person pick, because
// opening the wrong child's tutor in front of the right child is worse than one
// extra tap.

import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { childForGuardian, listChildrenForParent } from "../_lib/children";

export default async function BuddyShortcutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any;

  // The pinned child first — it is the one explicit statement of "this is the
  // child I am carrying". Guardianship is re-checked, as everywhere the pin is
  // read, so a stale id falls through to the rest of this rather than resolving.
  const { data: prefRow } = await svc.schema("hub").from("preferences")
    .select("pinned_child_id")
    .eq("user_id", user.id)
    .maybeSingle()
    .then((r: { data: unknown }) => r, () => ({ data: null }));
  const pinned = (prefRow as { pinned_child_id: string | null } | null)?.pinned_child_id ?? null;
  if (pinned && (await childForGuardian(svc, pinned, user.id))) {
    redirect(`/children/${pinned}/kid?open=buddy`);
  }

  // Otherwise: the only young child, if there is exactly one. Buddy is built
  // for a child who is learning to read, so the teen and college workspaces are
  // not candidates however few of them there are.
  const cards = await listChildrenForParent(user.id, new Date());
  const young = cards.filter((c) => c.ageTier === "elementary");
  if (young.length === 1) redirect(`/children/${young[0].childId}/kid?open=buddy`);

  // None, or several with no pin. The list is the honest answer.
  redirect("/children");
}
