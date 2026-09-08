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
import { loadLearning, gradeLabelFor } from "./learning";

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
  starsWeek: number;
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
  const L = await loadLearning(db, pinnedChildId, child.birth_year, now);

  const today = now.toISOString().slice(0, 10);
  const week = L.spellingWeek;
  const nx = L.latestNewsletter?.extracted;

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
    const task = L.tasks.find((t) => t.title === label);
    items.push({ label, done: !!task?.completedAt });
  }

  for (const ex of L.exercises) {
    items.push({ label: ex.title, done: ex.doneToday });
  }

  for (const r of (nx?.parent_requests ?? []) as string[]) {
    const task = L.tasks.find((t) => t.title === r);
    items.push({ label: r, done: !!task?.completedAt });
  }

  // Anything typed in by hand that the rows above did not already cover.
  const covered = new Set(items.map((i) => i.label));
  for (const t of L.tasks) {
    if (covered.has(t.title) || t.kind === "spelling" || t.exerciseId) continue;
    items.push({ label: t.title, done: !!t.completedAt });
  }

  const done = items.filter((i) => i.done).length;
  const next = items.find((i) => !i.done)?.label ?? null;

  return {
    childId: pinnedChildId,
    name,
    first: firstName(name),
    gradeLabel: L.gradeLabel ?? gradeLabelFor(child.birth_year, now),
    done,
    total: items.length,
    next,
    testOn: week?.testOn && week.testOn >= today ? week.testOn : null,
    openTasks: L.tasks.filter((t) => !t.completedAt).length,
    starsWeek: L.stars.week,
  };
}
