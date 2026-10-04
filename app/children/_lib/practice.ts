// Tonight's practice, picked from everything on file.
//
// The plan had 81 active exercises, 78 of them under a different free-text
// "skill", and nothing had been practised in a fortnight. A list that long is
// not a plan; it is a backlog, and a parent with twenty minutes after dinner
// closes it. This decides what tonight is — a few things, mixed across
// subjects, worth about twenty minutes — and leaves the rest browsable.
//
// Pure. The workspace and the Today card both use it, so "3 of 4 tonight"
// means the same thing in both places.

export type Cadence = "daily" | "three_a_week" | "weekly" | "once";

export type Subject =
  | "Reading" | "Spelling & words" | "Writing" | "Math"
  | "Memory & scripture" | "Science & world" | "Life skills" | "Other";

export const SUBJECT_ORDER: Subject[] = ["Reading", "Spelling & words", "Writing", "Math", "Memory & scripture", "Science & world", "Life skills", "Other"];

export interface PlanExercise {
  id: string;
  title: string;
  skill: string | null;
  frequency: Cadence;
  minutes: number | null;
  /** Most recent first. */
  doneDates: string[];
  doneToday: boolean;
  createdAt: string;
}

/**
 * The subject an exercise belongs to, from the reader's free-text skill.
 *
 * Order matters: "sight word spelling" is words, not writing; "number
 * formation" is writing, not math; "scripture memorization" is memory before
 * anything else. Checked against the real skill strings on file.
 */
export function subjectOf(skill: string | null | undefined, title = ""): Subject {
  const s = `${skill ?? ""} ${title}`.toLowerCase();
  if (/scripture|memoriz|recitation|memory and|bible|verse|pledge/.test(s)) return "Memory & scripture";
  if (/shoe|fine motor|tying|zipper|independence/.test(s)) return "Life skills";
  if (/science|geography|narration|map|animal habit|weather|plant/.test(s)) return "Science & world";
  if (/letter formation|handwriting|number formation|casing|stroke|penmanship|tall, short|ascender|descender|capital height/.test(s)) return "Writing";
  if (/sight word|high-frequency|spelling|silent e|_e pattern|c\/k|using .* in a sentence|word list/.test(s)) return "Spelling & words";
  if (/addition|subtract|doubles|count|number|shape|math|compos|decompos|sides|equation|sum|word problem|conservation|quantity|making 10|making 6|half|quarter|2-d|3-d/.test(s)) return "Math";
  if (/read|decod|cvc|vowel|blend|phonem|comprehension|sentence|fluen|adjective|vocabulary|story|illustration/.test(s)) return "Reading";
  return "Other";
}

const DAY = 86_400_000;
function daysAgo(today: string, iso: string): number {
  return Math.round((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${iso}T12:00:00Z`).getTime()) / DAY);
}

/** Whether an exercise is owed tonight, from its cadence and its log. */
export function isDue(ex: PlanExercise, today: string): boolean {
  if (ex.doneToday) return false;
  const week = ex.doneDates.filter((d) => daysAgo(today, d) >= 0 && daysAgo(today, d) < 7).length;
  switch (ex.frequency) {
    case "daily": return true;
    case "three_a_week": return week < 3;
    case "weekly": return week === 0;
    case "once": return ex.doneDates.length === 0;
  }
}

const CADENCE_RANK: Record<Cadence, number> = { daily: 0, three_a_week: 1, weekly: 2, once: 3 };

export interface Plan<T extends PlanExercise> {
  /** What to do tonight: anything already done today, then the pick. */
  tonight: T[];
  /** Due as well, but not picked — tonight is a plan, not a backlog. */
  alsoDue: T[];
  /** Not owed tonight. */
  later: T[];
  minutes: number;
  doneTonight: number;
}

/**
 * Tonight.
 *
 * Due exercises are ordered by how often they are owed (daily first) and then
 * by the newest paper, then dealt out one subject at a time so four math
 * drills never make a whole evening. Anything already done today stays on the
 * list, so the plan reads "2 of 4" rather than shrinking as it is done.
 */
export function planTonight<T extends PlanExercise>(exercises: T[], today: string, cap = 4): Plan<T> {
  const done = exercises.filter((e) => e.doneToday);
  const due = exercises.filter((e) => isDue(e, today))
    .sort((a, b) => CADENCE_RANK[a.frequency] - CADENCE_RANK[b.frequency] || b.createdAt.localeCompare(a.createdAt));
  const later = exercises.filter((e) => !e.doneToday && !isDue(e, today));

  // Deal across subjects: one from each in turn, until the cap.
  const bySubject = new Map<Subject, T[]>();
  for (const e of due) {
    const s = subjectOf(e.skill, e.title);
    bySubject.set(s, [...(bySubject.get(s) ?? []), e]);
  }
  const subjects = SUBJECT_ORDER.filter((s) => bySubject.has(s));
  const picked: T[] = [];
  const room = Math.max(0, cap - done.length);
  let round = 0;
  while (picked.length < room && subjects.some((s) => (bySubject.get(s)?.length ?? 0) > round)) {
    for (const s of subjects) {
      const e = bySubject.get(s)?.[round];
      if (e && picked.length < room) picked.push(e);
    }
    round++;
  }
  const pickedIds = new Set(picked.map((e) => e.id));
  const tonight = [...done, ...picked];
  return {
    tonight,
    alsoDue: due.filter((e) => !pickedIds.has(e.id)),
    later,
    minutes: tonight.reduce((n, e) => n + (e.minutes ?? 5), 0),
    doneTonight: done.length,
  };
}

/** Exercises worth archiving: never practised, and older than `days`. */
export function stale<T extends PlanExercise>(exercises: T[], today: string, days = 21): T[] {
  return exercises.filter((e) => e.doneDates.length === 0 && daysAgo(today, e.createdAt.slice(0, 10)) > days);
}
