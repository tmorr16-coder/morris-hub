export const dynamic = "force-dynamic";

// The child's own screen. Opened on a parent's phone and handed over: big
// type, few words, one thing at a time, and the app reads aloud. It shows the
// tasks the parents sent, lets the child do them and earn stars, and has a
// tutor that only knows about this week's school work.

import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { getChildWorkspace } from "../../_lib/children";
import KidClient from "../../_components/KidClient";

export default async function KidScreenPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ws = await getChildWorkspace(childId, user.id, new Date());
  if (!ws) notFound();
  const L = ws.learning;

  return (
    <div data-ui="ios">
      <KidClient
        childId={childId}
        name={ws.name}
        gradeLabel={L?.gradeLabel ?? null}
        tasks={L?.tasks ?? []}
        exercises={(L?.exercises ?? []).map((e) => ({ id: e.id, title: e.title, steps: e.steps, minutes: e.minutes }))}
        spelling={L?.spellingWeek ? { weekId: L.spellingWeek.id, words: L.spellingWeek.words, sightWords: L.spellingWeek.sightWords, pattern: L.spellingWeek.pattern } : null}
        stars={L?.stars ?? { total: 0, week: 0 }}
      />
    </div>
  );
}
