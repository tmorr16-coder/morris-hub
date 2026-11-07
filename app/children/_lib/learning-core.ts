// The part of saving a school document that does not depend on who is asking:
// the row, and turning its read into the workspace. Server actions call this
// after checking the caller; the email door calls it after checking the
// sender. It is deliberately not a "use server" file — a function that takes
// a user id as an argument must never be reachable from a browser.

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { DocumentExtraction, SchoolDate } from "./learning";
import { guardianUserIds } from "./children";

/** A date alone, at 7am UTC — early enough to be "today" in any US zone. */
function morningOf(date: string): string {
  return `${date}T11:00:00.000Z`;
}

function weekdaysBetween(start: string, endExclusive: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00Z`);
  const end = new Date(`${endExclusive}T12:00:00Z`);
  while (d < end) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Turn a saved read into the workspace: the spelling week, the assessments,
 * the adopted exercises, and — when asked — the household's to-dos and
 * reminders. Shared by the first save and by Rebuild, which runs it again
 * from the stored read without another trip through the camera.
 */
export async function materialise(
  svc: any,
  userId: string,
  child: { user_id: string; display_name: string | null },
  input: { childId: string; extraction: DocumentExtraction; exerciseIndexes: number[]; addDateReminders: boolean; addPracticeTodos: boolean },
  documentId: string,
): Promise<{ reminders: number; todos: number; error?: string }> {
  const x = input.extraction;
  const childName = child.display_name ?? "your child";

  // 2. Spelling week — one per child per week; a re-scan of the same
  //    newsletter updates rather than duplicates.
  if (x.spelling && (x.spelling.words.length > 0 || x.spelling.sight_words.length > 0)) {
    const weekStart = x.spelling.week_start ?? x.week_start ?? x.doc_date;
    if (weekStart) {
      await svc.schema("hub").from("child_spelling_weeks").upsert(
        {
          child_id: input.childId,
          document_id: documentId,
          week_start: weekStart,
          week_end: x.spelling.week_end ?? x.week_end,
          pattern: x.spelling.pattern,
          words: x.spelling.words,
          sight_words: x.spelling.sight_words,
          test_on: x.spelling.test_on,
        },
        { onConflict: "child_id,week_start" },
      );
    }
  }

  // 3. Assessments.
  if (x.assessments.length > 0) {
    const { error } = await svc.schema("hub").from("child_assessments").insert(
      x.assessments.map((a) => ({
        child_id: input.childId,
        document_id: documentId,
        subject: a.subject || "other",
        title: a.title || x.title,
        score: a.score,
        out_of: a.out_of,
        assessed_on: a.assessed_on ?? x.doc_date,
        teacher_feedback: a.teacher_feedback,
        observations: a.observations ?? [],
        items: a.items ?? [],
      })),
    );
    if (error) return { error: error.message, reminders: 0, todos: 0 };
  }

  // 4. Exercises the parent chose to adopt.
  const chosen = x.exercises.filter((_, i) => input.exerciseIndexes.includes(i));
  let todos = 0;
  if (chosen.length > 0) {
    const { data: inserted, error } = await svc.schema("hub").from("child_exercises")
      .insert(chosen.map((e) => ({
        child_id: input.childId,
        document_id: documentId,
        title: e.title,
        skill: e.skill,
        rationale: e.rationale,
        steps: e.steps,
        minutes: e.minutes,
        frequency: e.frequency,
        materials: e.materials,
        status: "active",
        created_by: userId,
      })))
      .select("id, title, minutes");
    if (error) return { error: error.message, reminders: 0, todos: 0 };

    // A to-do per adopted exercise for the coming days. Daily ones get a
    // weekday each until the spelling test or for a week; the rest get one.
    if (input.addPracticeTodos) {
      const today = new Date().toISOString().slice(0, 10);
      const horizon = x.spelling?.test_on && x.spelling.test_on > today
        ? x.spelling.test_on
        : new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      const rows: any[] = [];
      for (const [i, e] of (inserted as { id: string; title: string; minutes: number | null }[]).entries()) {
        const freq = chosen[i].frequency;
        const days = freq === "daily" ? weekdaysBetween(today, horizon) : freq === "three_a_week" ? weekdaysBetween(today, horizon).filter((_, k) => k % 2 === 0) : [today];
        for (const day of days) {
          rows.push({
            user_id: userId, child_document_id: documentId,
            title: `${e.title} — with ${childName}${e.minutes ? ` (${e.minutes} min)` : ""}`,
            due_date: day,
            priority: "medium",
            is_household: true,
            assigned_to: null,
            notes: `From ${x.title}. Open ${childName}'s workspace for the steps.`,
          });
        }
      }
      if (rows.length > 0) {
        const { error: tErr } = await svc.schema("hub").from("todos").insert(rows);
        if (!tErr) todos = rows.length;
      }
    }
  }

  // 5. Dates → household reminders. Deduplicated against what is already
  //    there, so re-scanning a newsletter does not double them.
  let reminders = 0;
  if (input.addDateReminders && x.dates.length > 0) {
    const guardians = await guardianUserIds(svc, child.user_id);
    const { data: existing } = await svc.schema("hub").from("reminders")
      .select("title, due_at")
      .in("user_id", guardians)
      .eq("is_household", true)
      .gte("due_at", morningOf(new Date().toISOString().slice(0, 10)));
    // "Already there" is judged loosely on purpose. Two reads of the same
    // newsletter titled the same day "No School – Labor Day" and "No School -
    // Labor Day", and "Noon Dismissal" and "Noon Dismissal (Teacher PD)", and
    // an exact match let all four through. Same day, same first few words,
    // same child: that is the same reminder.
    const keyOf = (date: string, title: string) => `${date}|${title.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ")}`;
    const have = new Set(((existing ?? []) as { title: string; due_at: string }[]).map((r) => keyOf(r.due_at.slice(0, 10), r.title)));
    const today = new Date().toISOString().slice(0, 10);
    const rows: any[] = [];
    for (const d of x.dates as SchoolDate[]) {
      if (!d.date || d.date < today) continue;
      const title = `${childName}: ${d.title}`;
      if (have.has(keyOf(d.date, title))) continue;
      have.add(keyOf(d.date, title));
      rows.push({
        user_id: userId, child_document_id: documentId,
        title,
        notes: d.note ?? null,
        due_at: morningOf(d.date),
        recurrence: "once",
        category: "personal",
        source_app: "hub",
        is_household: true,
        assigned_to: null,
      });
      // A no-school day is the one that bites at 7am. Warn the evening before.
      if (d.kind === "no_school" || d.kind === "early_dismissal") {
        const eve = new Date(`${d.date}T12:00:00Z`);
        eve.setUTCDate(eve.getUTCDate() - 1);
        const eveDay = eve.toISOString().slice(0, 10);
        const eveTitle = `Tomorrow — ${childName}: ${d.title}`;
        if (eveDay >= today && !have.has(keyOf(eveDay, eveTitle))) {
          have.add(keyOf(eveDay, eveTitle));
          rows.push({
            user_id: userId, child_document_id: documentId,
            title: eveTitle,
            notes: d.note ?? null,
            due_at: `${eveDay}T23:00:00.000Z`,
            recurrence: "once",
            category: "personal",
            source_app: "hub",
            is_household: true,
            assigned_to: null,
          });
        }
      }
    }
    // The spelling test is a date too — unless the newsletter already listed
    // it as one, in which case the row above covers it. The first save made
    // two reminders for one test, one of them titled with a whole paragraph.
    const testListed = x.dates.some((d) => d.date === x.spelling?.test_on && (d.kind === "test" || /spelling/i.test(d.title)));
    if (x.spelling?.test_on && x.spelling.test_on >= today && !testListed) {
      const pattern = x.spelling.pattern && x.spelling.pattern.length <= 48 ? x.spelling.pattern : null;
      const title = `${childName}: spelling test${pattern ? ` (${pattern})` : ""}`;
      if (!have.has(keyOf(x.spelling.test_on, title))) {
        rows.push({
          user_id: userId, child_document_id: documentId, title, notes: x.spelling.words.join(", ") || null,
          due_at: morningOf(x.spelling.test_on), recurrence: "once", category: "personal",
          source_app: "hub", is_household: true, assigned_to: null,
        });
      }
    }
    if (rows.length > 0) {
      const { error } = await svc.schema("hub").from("reminders").insert(rows);
      if (!error) reminders = rows.length;
    }
  }

  return { reminders, todos };
}

/**
 * Save what was read off the school's paper, and — if asked — turn it into
 * the household's week: reminders for the dates, to-dos for the practice.
 *
 * Reminders and to-dos are created as household items with no assignee, which
 * is exactly what Today lists for every adult in the circle. Both parents see
 * them; whoever gets to it first checks it off.
 */
export async function createDocumentFor(
  svc: any,
  userId: string,
  child: { user_id: string; display_name: string | null },
  input: {
    childId: string;
    extraction: DocumentExtraction;
    exerciseIndexes: number[];
    addDateReminders: boolean;
    addPracticeTodos: boolean;
    pageHashes?: string[];
    /** Where it came from, kept inside the read (no schema change): e.g. the email it arrived in. */
    provenance?: Record<string, unknown>;
  },
): Promise<{ error: string } | { documentId: string; reminders: number; todos: number; rolledOver: RollOver | null }> {
  const x = input.extraction;
  // Is this the newest week we have? Asked before inserting, so the answer is
  // about every newsletter already kept. An older one imported late never
  // takes the current week down.
  let newerWeek = false;
  if (x.kind === "newsletter" && x.week_start) {
    const latest = await currentWeekDocument(svc, input.childId);
    newerWeek = !latest || !latest.week_start || x.week_start > latest.week_start;
  }
  // 1. The document. The page fingerprints ride along when the column exists;
  //    a database that has not had that migration yet still gets the document.
  const row: Record<string, unknown> = {
    child_id: input.childId,
    kind: x.kind,
    title: x.title || "School document",
    doc_date: x.doc_date,
    week_start: x.week_start,
    week_end: x.week_end,
    summary: x.summary,
    extracted: input.provenance ? { ...x, ...input.provenance } : x,
    created_by: userId,
  };
  const hashes = (input.pageHashes ?? []).filter((h) => /^[0-9a-f]{64}$/i.test(h));
  let ins = await svc.schema("hub").from("child_documents").insert(hashes.length ? { ...row, page_hashes: hashes } : row).select("id").single();
  if (ins.error && hashes.length && /page_hashes/.test(ins.error.message)) {
    ins = await svc.schema("hub").from("child_documents").insert(row).select("id").single();
  }
  if (ins.error) return { error: ins.error.message };
  const documentId = ins.data.id as string;

  const m = await materialise(svc, userId, child, input, documentId);
  if (m.error) return { error: m.error };
  const rolledOver = newerWeek ? await rollOverWeek(svc, input.childId, documentId) : null;
  return { documentId, reminders: m.reminders, todos: m.todos, rolledOver };
}

export interface RollOver {
  /** Exercises from earlier documents, archived as done. */
  exerciseIds: string[];
  /** Jobs on the child's screen that were never finished, cleared. */
  taskIds: string[];
  /** Household to-dos made from earlier documents, checked off. */
  todoIds: string[];
}

/**
 * Put last week away so this week's content is what shows.
 *
 * Every newsletter adds practice, to-dos and jobs on the child's screen, and
 * nothing ever took the old ones down: by the fourth week the workspace had
 * a month of spelling drills for words already tested. This archives what
 * came from earlier documents and leaves everything else alone — exercises a
 * parent wrote by hand, reminders for dates still ahead, finished history.
 * Nothing is deleted; the ids come back so the caller can offer Undo.
 */
export async function rollOverWeek(svc: any, childId: string, keepDocumentId: string): Promise<RollOver> {
  const { data: ex } = await svc.schema("hub").from("child_exercises")
    .select("id").eq("child_id", childId).in("status", ["suggested", "active"])
    .not("document_id", "is", null).neq("document_id", keepDocumentId);
  const exerciseIds = ((ex ?? []) as { id: string }[]).map((r) => r.id);
  if (exerciseIds.length) await svc.schema("hub").from("child_exercises").update({ status: "done" }).in("id", exerciseIds);

  const today = new Date().toISOString().slice(0, 10);
  const { data: tasks } = await svc.schema("hub").from("child_tasks")
    .select("id").eq("child_id", childId).is("completed_at", null).lt("assigned_on", today);
  const taskIds = ((tasks ?? []) as { id: string }[]).map((r) => r.id);
  if (taskIds.length) await svc.schema("hub").from("child_tasks").update({ completed_at: new Date().toISOString(), stars: 0, child_note: "Cleared for the new week" }).in("id", taskIds);

  const { data: docs } = await svc.schema("hub").from("child_documents").select("id").eq("child_id", childId).neq("id", keepDocumentId);
  const oldDocIds = ((docs ?? []) as { id: string }[]).map((r) => r.id);
  let todoIds: string[] = [];
  if (oldDocIds.length) {
    const { data: todos } = await svc.schema("hub").from("todos")
      .select("id").eq("completed", false).in("child_document_id", oldDocIds);
    todoIds = ((todos ?? []) as { id: string }[]).map((r) => r.id);
    if (todoIds.length) await svc.schema("hub").from("todos").update({ completed: true, completed_at: new Date().toISOString() }).in("id", todoIds);
  }
  return { exerciseIds, taskIds, todoIds };
}

/** Put back what rollOverWeek took down. Scoped to the child, so ids from elsewhere do nothing. */
export async function undoRollOver(svc: any, childId: string, r: RollOver): Promise<void> {
  const ok = (ids: string[]) => ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500);
  const ex = ok(r.exerciseIds), tk = ok(r.taskIds), td = ok(r.todoIds);
  if (ex.length) await svc.schema("hub").from("child_exercises").update({ status: "active" }).eq("child_id", childId).in("id", ex);
  if (tk.length) await svc.schema("hub").from("child_tasks").update({ completed_at: null, child_note: null }).eq("child_id", childId).in("id", tk);
  if (td.length) {
    const { data: docs } = await svc.schema("hub").from("child_documents").select("id").eq("child_id", childId);
    const mine = ((docs ?? []) as { id: string }[]).map((d) => d.id);
    if (mine.length) await svc.schema("hub").from("todos").update({ completed: false, completed_at: null }).in("id", td).in("child_document_id", mine);
  }
}

/** The newest newsletter's id — the week the workspace is about. */
export async function currentWeekDocument(svc: any, childId: string): Promise<{ id: string; title: string; week_start: string | null } | null> {
  const { data } = await svc.schema("hub").from("child_documents")
    .select("id, title, week_start, created_at").eq("child_id", childId).eq("kind", "newsletter")
    .order("week_start", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(1);
  return (data?.[0] as { id: string; title: string; week_start: string | null }) ?? null;
}
