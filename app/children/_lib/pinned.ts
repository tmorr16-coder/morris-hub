// The child pinned to Today, reduced to what fits on one card.
//
// Today already answers "what is on for me". A pinned child adds "and how is
// theirs going" without making anyone open the workspace to find out. It is a
// summary and nothing more: the week's progress, the one next thing, and two
// ways in.
//
// The pin is a per-user preference holding a family_members id. That id is not
// trusted here — guardianship is re-checked on every read, so a pin left over
// from a child who has moved out, or an id someone wrote into their own
// preferences by hand, resolves to null rather than to somebody else's family.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { childForGuardian } from "./children";
import { gradeLabelFor } from "./learning";

export interface PinnedChildSummary {
  childId: string;
  name: string;
  first: string;
  gradeLabel: string | null;
  /** Week items finished and total — the same count the workspace shows. */
  done: number;
  total: number;
  /** The one thing to do next, already phrased for display. */
  next: string | null;
  /** Spelling test day, ISO, when there is one ahead. */
  testOn: string | null;
  openTasks: number;
  /** Stars earned today. The task query is today-scoped, to stay in step
      with the workspace, so a week's worth is not available here cheaply. */
  starsToday: number;
}

function firstName(name: string): string {
  return name.split(" ")[0] || name;
}

/**
 * The pinned child's week, or null if there is no pin, the pin no longer
 * resolves, or the viewer may not act for that child.
 *
 * The week is counted the way ElementaryWorkspace counts it — spelling, then
 * scripture, then the practice plan, then anything sent by hand — so the "3 of
 * 7" here and the "3 of 7" there are the same number. Keep them in step: the
 * card losing agreement with the screen it summarises is worse than no card.
 */
export async function loadPinnedChild(
  db: any,
  pinnedChildId: string | null | undefined,
  viewerUserId: string,
  now: Date,
): Promise<PinnedChildSummary | null> {
  if (!pinnedChildId) return null;

  const child = await childForGuardian(db, pinnedChildId, viewerUserId);
  if (!child) return null;

  const name = child.display_name ?? "Child";
  const today = now.toISOString().slice(0, 10);

  // Four small queries rather than loadLearning.
  //
  // loadLearning is the workspace's loader and it is right for the workspace:
  // forty documents, thirty graded papers, sixty days of practice log, the
  // tutor transcript. Calling it from Today meant dragging all of that across
  // the wire, on the critical path of the app's front screen, to draw a
  // progress bar and one line of text. This asks for what the card shows and
  // stops.
  const [{ data: taskRows }, { data: weekRows }, { data: exRows }, { data: docRows }] = await Promise.all([
    db.schema("hub").from("child_tasks")
      .select("title, completed_at, kind, exercise_id, stars")
      .eq("child_id", pinnedChildId)
      .or(`completed_at.is.null,completed_at.gte.${today}T00:00:00Z`)
      .limit(30),
    db.schema("hub").from("child_spelling_weeks")
      .select("words, sight_words, test_on, practiced")
      .eq("child_id", pinnedChildId)
      .order("week_start", { ascending: false })
      .limit(1),
    db.schema("hub").from("child_exercises")
      .select("id, title")
      .eq("child_id", pinnedChildId)
      .in("status", ["suggested", "active"])
      .limit(20),
    db.schema("hub").from("child_documents")
      .select("extracted")
      .eq("child_id", pinnedChildId)
      .eq("kind", "newsletter")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  // Only today's practice matters for "done", so only today is asked for.
  const exercises = ((exRows ?? []) as { id: string; title: string }[]);
  let doneToday = new Set<string>();
  if (exercises.length > 0) {
    const { data: logRows } = await db.schema("hub").from("child_practice_log")
      .select("exercise_id")
      .eq("child_id", pinnedChildId)
      .eq("done_on", today);
    doneToday = new Set(((logRows ?? []) as { exercise_id: string }[]).map((l) => l.exercise_id));
  }

  const tasks = ((taskRows ?? []) as { title: string; completed_at: string | null; kind: string; exercise_id: string | null; stars: number | null }[]);
  const w = (weekRows ?? [])[0] as { words: string[] | null; sight_words: string[] | null; test_on: string | null; practiced: Record<string, number> | null } | undefined;
  const week = w
    ? { words: w.words ?? [], sightWords: w.sight_words ?? [], testOn: w.test_on, practiced: w.practiced ?? {} }
    : null;
  const nx = ((docRows ?? [])[0] as { extracted: Record<string, unknown> | null } | undefined)?.extracted as
    | { memory_verse?: string | null; recitation?: string | null; read_aloud?: string | null; parent_requests?: string[] }
    | undefined;

  // Mirrors the checklist on the workspace, in the same order, so "next" is
  // genuinely the next row a parent would work down to.
  const items: { label: string; done: boolean }[] = [];

  if (week) {
    const words = [...week.words, ...week.sightWords];
    if (words.length > 0) {
      const practised = words.filter((w) => (week.practiced[w] ?? 0) > 0).length;
      items.push({ label: "Practise the spelling words", done: practised === words.length });
    }
  }

  for (const [label, text] of [
    ["Memory verse", nx?.memory_verse],
    ["Recitation", nx?.recitation],
    ["Read aloud", nx?.read_aloud],
  ] as const) {
    if (!text) continue;
    const task = tasks.find((t) => t.title === label);
    items.push({ label, done: !!task?.completed_at });
  }

  for (const ex of exercises) {
    items.push({ label: ex.title, done: doneToday.has(ex.id) });
  }

  for (const r of (nx?.parent_requests ?? []) as string[]) {
    const task = tasks.find((t) => t.title === r);
    items.push({ label: r, done: !!task?.completed_at });
  }

  // Anything typed in by hand that the rows above did not already cover.
  const covered = new Set(items.map((i) => i.label));
  for (const t of tasks) {
    if (covered.has(t.title) || t.kind === "spelling" || t.exercise_id) continue;
    items.push({ label: t.title, done: !!t.completed_at });
  }

  const done = items.filter((i) => i.done).length;
  const next = items.find((i) => !i.done)?.label ?? null;

  return {
    childId: pinnedChildId,
    name,
    first: firstName(name),
    gradeLabel: gradeLabelFor(child.birth_year, now),
    done,
    total: items.length,
    next,
    testOn: week?.testOn && week.testOn >= today ? week.testOn : null,
    openTasks: tasks.filter((t) => !t.completed_at).length,
    starsToday: tasks.reduce((n, t) => n + (t.completed_at ? (t.stars ?? 0) : 0), 0),
  };
}
