// The learning side of a child's workspace: what the school sent home, the
// practice plan built from it, and the record of how it went. Pure types and
// loaders; the writes live in learning-actions.ts.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type DocumentKind = "newsletter" | "graded_work" | "word_list" | "other";
export type ExerciseFrequency = "daily" | "three_a_week" | "weekly" | "once";
export type ExerciseStatus = "suggested" | "active" | "done" | "dismissed";

/** A date the newsletter told us about. */
export interface SchoolDate {
  date: string;              // YYYY-MM-DD
  title: string;
  kind: "no_school" | "early_dismissal" | "field_trip" | "test" | "event" | "other";
  note?: string | null;
}

/** What the model reads off a page, in the shape the save action expects. */
export interface DocumentExtraction {
  kind: DocumentKind;
  title: string;
  doc_date: string | null;
  week_start: string | null;
  week_end: string | null;
  summary: string;
  dates: SchoolDate[];
  spelling: {
    week_start: string | null;
    week_end: string | null;
    pattern: string | null;
    words: string[];
    sight_words: string[];
    test_on: string | null;
  } | null;
  academics: { subject: string; topics: string[] }[];
  read_aloud: string | null;
  memory_verse: string | null;
  recitation: string | null;
  parent_requests: string[];     // things the teacher asked families to do at home
  birthdays: { name: string; date: string | null }[];
  assessments: {
    subject: string;
    title: string;
    score: number | null;
    out_of: number | null;
    assessed_on: string | null;
    teacher_feedback: string | null;
    observations: string[];
    items: { prompt: string; written: string | null; correct: boolean | null }[];
  }[];
  exercises: {
    title: string;
    skill: string;
    rationale: string;
    steps: string;
    minutes: number | null;
    frequency: ExerciseFrequency;
    materials: string | null;
  }[];
}

/**
 * Fold a second page's read into the first's.
 *
 * A newsletter is three photos. Each is read on its own, and the second and
 * third used to be thrown away as "another newsletter for the same week". The
 * read of page one is the base; anything page two adds is kept — a verse, a
 * date, the rest of the word list — and anything page one already had wins
 * where they disagree, since page one was read first and in full.
 */
export function mergeExtractions(base: Partial<DocumentExtraction>, extra: DocumentExtraction): DocumentExtraction {
  const text = (a?: string | null, b?: string | null) => (a && a.trim() ? a : b ?? null);
  const union = <T,>(a: T[] | undefined, b: T[] | undefined, key: (t: T) => string): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const t of [...(a ?? []), ...(b ?? [])]) {
      const k = key(t).toLowerCase().replace(/\s+/g, " ").trim();
      if (!k || seen.has(k)) continue;
      seen.add(k); out.push(t);
    }
    return out;
  };
  const baseWords = base.spelling?.words?.length ? base.spelling : null;
  const spelling = baseWords
    ? {
        ...baseWords,
        words: union(baseWords.words, extra.spelling?.words, (w) => w),
        sight_words: union(baseWords.sight_words, extra.spelling?.sight_words, (w) => w),
        pattern: text(baseWords.pattern, extra.spelling?.pattern),
        test_on: baseWords.test_on ?? extra.spelling?.test_on ?? null,
        week_start: baseWords.week_start ?? extra.spelling?.week_start ?? null,
        week_end: baseWords.week_end ?? extra.spelling?.week_end ?? null,
      }
    : (extra.spelling ?? base.spelling ?? null);
  return {
    kind: base.kind ?? extra.kind,
    title: text(base.title, extra.title) ?? "School document",
    doc_date: base.doc_date ?? extra.doc_date ?? null,
    week_start: base.week_start ?? extra.week_start ?? null,
    week_end: base.week_end ?? extra.week_end ?? null,
    summary: [base.summary, extra.summary].filter((x) => x && x.trim()).join(" ") || "",
    dates: union(base.dates as SchoolDate[] | undefined, extra.dates, (d) => `${d.date}|${d.title}`),
    spelling,
    academics: union(base.academics, extra.academics, (a) => a.subject),
    read_aloud: text(base.read_aloud, extra.read_aloud),
    memory_verse: text(base.memory_verse, extra.memory_verse),
    recitation: text(base.recitation, extra.recitation),
    parent_requests: union(base.parent_requests, extra.parent_requests, (r) => r),
    birthdays: union(base.birthdays, extra.birthdays, (b) => b.name),
    assessments: union(base.assessments, extra.assessments, (a) => `${a.subject}|${a.title}`),
    exercises: union(base.exercises, extra.exercises, (e) => e.title),
  };
}

export interface ChildDocument {
  id: string;
  kind: DocumentKind;
  title: string;
  docDate: string | null;
  weekStart: string | null;
  weekEnd: string | null;
  summary: string | null;
  extracted: Partial<DocumentExtraction>;
  filePaths: string[];
  createdAt: string;
}

export interface SpellingWeek {
  id: string;
  documentId: string | null;
  weekStart: string;
  weekEnd: string | null;
  pattern: string | null;
  words: string[];
  sightWords: string[];
  testOn: string | null;
  practiced: Record<string, number>;
}

export interface Assessment {
  id: string;
  documentId: string | null;
  subject: string;
  title: string;
  score: number | null;
  outOf: number | null;
  assessedOn: string | null;
  teacherFeedback: string | null;
  observations: string[];
  items: { prompt: string; written: string | null; correct: boolean | null }[];
}

export interface Exercise {
  id: string;
  documentId: string | null;
  title: string;
  skill: string | null;
  rationale: string | null;
  steps: string | null;
  minutes: number | null;
  frequency: ExerciseFrequency;
  materials: string | null;
  status: ExerciseStatus;
  dueOn: string | null;
  doneDates: string[];       // most recent first
  doneToday: boolean;
  streak: number;            // consecutive days ending today or yesterday
}

export type TaskKind = "exercise" | "spelling" | "reading" | "custom";

/** Something a parent sent to the child's own screen. */
export interface ChildTask {
  id: string;
  kind: TaskKind;
  exerciseId: string | null;
  title: string;
  instructions: string | null;
  payload: { words?: string[]; steps?: string | null; minutes?: number | null };
  assignedOn: string;
  dueOn: string | null;
  completedAt: string | null;
  stars: number;
  childNote: string | null;
}

export interface TutorMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface LearningData {
  gradeLabel: string | null;
  /** The last few Buddy exchanges, newest first, for the parents' review. */
  tutorRecent: TutorMessage[];
  /** Open tasks plus anything completed today, newest first. */
  tasks: ChildTask[];
  /** Stars earned in total, and this week. */
  stars: { total: number; week: number };
  spellingWeek: SpellingWeek | null;
  /** Every week on file, newest first, for looking back. */
  spellingWeeks: SpellingWeek[];
  latestNewsletter: ChildDocument | null;
  upcomingDates: SchoolDate[];
  assessments: Assessment[];
  exercises: Exercise[];
  documents: ChildDocument[];
  practiceDaysThisWeek: number;
}

/** US grade from age at the start of the school year; null when unknown. */
export function gradeLabelFor(birthYear: number | null, now: Date): string | null {
  if (!birthYear) return null;
  // School years start in August; a child born in 2020 is 6 for the 2026–27
  // year and in first grade. Age at the start of the current school year minus
  // five, floored at kindergarten.
  const schoolYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const grade = schoolYear - birthYear - 5;
  if (grade < 0) return "Preschool";
  if (grade === 0) return "Kindergarten";
  const suffix = grade === 1 ? "st" : grade === 2 ? "nd" : grade === 3 ? "rd" : "th";
  return `${grade}${suffix} grade`;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function streakFrom(doneDates: string[], today: string): number {
  if (doneDates.length === 0) return 0;
  const set = new Set(doneDates);
  const cursor = new Date(`${today}T12:00:00Z`);
  // A streak may end yesterday and still count: today's practice has not
  // happened yet, and a zero on the screen at breakfast is discouraging.
  if (!set.has(isoDay(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let n = 0;
  while (set.has(isoDay(cursor))) {
    n++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return n;
}

export async function loadLearning(db: any, childId: string, birthYear: number | null, now: Date): Promise<LearningData> {
  const today = isoDay(now);
  const [{ data: docRows }, { data: weekRows }, { data: assessRows }, { data: exRows }, { data: logRows }, { data: taskRows }, { data: starRows }, { data: tutorRows }] = await Promise.all([
    db.schema("hub").from("child_documents")
      .select("id, kind, title, doc_date, week_start, week_end, summary, extracted, file_paths, created_at")
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .limit(40),
    db.schema("hub").from("child_spelling_weeks")
      .select("id, document_id, week_start, week_end, pattern, words, sight_words, test_on, practiced")
      .eq("child_id", childId)
      .order("week_start", { ascending: false })
      .limit(16),
    db.schema("hub").from("child_assessments")
      .select("id, document_id, subject, title, score, out_of, assessed_on, teacher_feedback, observations, items")
      .eq("child_id", childId)
      .order("assessed_on", { ascending: false, nullsFirst: false })
      .limit(30),
    db.schema("hub").from("child_exercises")
      .select("id, document_id, title, skill, rationale, steps, minutes, frequency, materials, status, due_on, created_at")
      .eq("child_id", childId)
      .in("status", ["suggested", "active"])
      .order("created_at", { ascending: false }),
    db.schema("hub").from("child_practice_log")
      .select("exercise_id, done_on")
      .eq("child_id", childId)
      .gte("done_on", isoDay(new Date(now.getTime() - 60 * 86_400_000)))
      .order("done_on", { ascending: false }),
    db.schema("hub").from("child_tasks")
      .select("id, kind, exercise_id, title, instructions, payload, assigned_on, due_on, completed_at, stars, child_note")
      .eq("child_id", childId)
      .or(`completed_at.is.null,completed_at.gte.${today}T00:00:00Z`)
      .order("created_at", { ascending: false })
      .limit(30),
    db.schema("hub").from("child_tasks")
      .select("stars, completed_at")
      .eq("child_id", childId)
      .not("completed_at", "is", null),
    db.schema("hub").from("child_tutor_messages")
      .select("id, session_id, role, content, created_at")
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  const tutorRecent: TutorMessage[] = ((tutorRows ?? []) as any[]).map((m) => ({ id: m.id, sessionId: m.session_id, role: m.role, content: m.content, createdAt: m.created_at }));

  const tasks: ChildTask[] = ((taskRows ?? []) as any[]).map((t) => ({
    id: t.id,
    kind: t.kind,
    exerciseId: t.exercise_id,
    title: t.title,
    instructions: t.instructions,
    payload: (t.payload ?? {}) as ChildTask["payload"],
    assignedOn: t.assigned_on,
    dueOn: t.due_on,
    completedAt: t.completed_at,
    stars: t.stars ?? 0,
    childNote: t.child_note,
  }));
  const weekAgoIso = isoDay(new Date(now.getTime() - 6 * 86_400_000));
  const stars = ((starRows ?? []) as { stars: number; completed_at: string }[]).reduce(
    (acc, r) => ({ total: acc.total + (r.stars ?? 0), week: acc.week + (r.completed_at >= weekAgoIso ? (r.stars ?? 0) : 0) }),
    { total: 0, week: 0 },
  );

  const documents: ChildDocument[] = ((docRows ?? []) as any[]).map((d) => ({
    id: d.id,
    kind: d.kind,
    title: d.title,
    docDate: d.doc_date,
    weekStart: d.week_start,
    weekEnd: d.week_end,
    summary: d.summary,
    extracted: (d.extracted ?? {}) as Partial<DocumentExtraction>,
    filePaths: d.file_paths ?? [],
    createdAt: d.created_at,
  }));

  const latestNewsletter = documents.find((d) => d.kind === "newsletter") ?? null;

  const spellingWeeks: SpellingWeek[] = ((weekRows ?? []) as any[]).map((week) => ({
    id: week.id,
    documentId: week.document_id ?? null,
    weekStart: week.week_start,
    weekEnd: week.week_end,
    pattern: week.pattern,
    words: week.words ?? [],
    sightWords: week.sight_words ?? [],
    testOn: week.test_on,
    practiced: (week.practiced ?? {}) as Record<string, number>,
  }));
  const spellingWeek: SpellingWeek | null = spellingWeeks[0] ?? null;

  // Dates come from every newsletter on file, deduplicated, future only.
  const seen = new Set<string>();
  const upcomingDates: SchoolDate[] = [];
  for (const d of documents) {
    for (const sd of (d.extracted.dates ?? []) as SchoolDate[]) {
      if (!sd?.date || sd.date < today) continue;
      const key = `${sd.date}|${sd.title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      upcomingDates.push(sd);
    }
  }
  upcomingDates.sort((a, b) => a.date.localeCompare(b.date));

  const assessments: Assessment[] = ((assessRows ?? []) as any[]).map((a) => ({
    id: a.id,
    documentId: a.document_id ?? null,
    subject: a.subject,
    title: a.title,
    score: a.score != null ? Number(a.score) : null,
    outOf: a.out_of != null ? Number(a.out_of) : null,
    assessedOn: a.assessed_on,
    teacherFeedback: a.teacher_feedback,
    observations: (a.observations ?? []) as string[],
    items: (a.items ?? []) as Assessment["items"],
  }));

  const logByExercise = new Map<string, string[]>();
  for (const l of (logRows ?? []) as { exercise_id: string; done_on: string }[]) {
    const arr = logByExercise.get(l.exercise_id) ?? [];
    arr.push(l.done_on);
    logByExercise.set(l.exercise_id, arr);
  }

  const exercises: Exercise[] = ((exRows ?? []) as any[]).map((e) => {
    const doneDates = logByExercise.get(e.id) ?? [];
    return {
      id: e.id,
      documentId: e.document_id ?? null,
      title: e.title,
      skill: e.skill,
      rationale: e.rationale,
      steps: e.steps,
      minutes: e.minutes,
      frequency: e.frequency,
      materials: e.materials,
      status: e.status,
      dueOn: e.due_on,
      doneDates,
      doneToday: doneDates.includes(today),
      streak: streakFrom(doneDates, today),
    };
  });

  // Distinct days with any practice logged in the last seven.
  const weekAgo = isoDay(new Date(now.getTime() - 6 * 86_400_000));
  const practiceDays = new Set(((logRows ?? []) as { done_on: string }[]).filter((l) => l.done_on >= weekAgo).map((l) => l.done_on));

  return {
    gradeLabel: gradeLabelFor(birthYear, now),
    tutorRecent,
    tasks,
    stars,
    spellingWeek,
    spellingWeeks,
    latestNewsletter,
    upcomingDates: upcomingDates.slice(0, 8),
    assessments,
    exercises,
    documents,
    practiceDaysThisWeek: practiceDays.size,
  };
}
