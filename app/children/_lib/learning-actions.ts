"use server";

// Writes for a child's learning workspace. Every action re-checks that the
// caller may act for the child — the owning parent, a co-parent in the same
// circle, or the child — before touching anything.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { childForGuardian, guardianUserIds } from "./children";
import type { DocumentExtraction, SchoolDate } from "./learning";

const BUCKET = "child-documents";

function db() {
  return createServiceClient() as any;
}

async function requireGuardian(childId: string) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" as const };
  const child = await childForGuardian(db(), childId, userId);
  if (!child) return { error: "Not found" as const };
  return { userId, child };
}

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
 * Save what was read off the school's paper, and — if asked — turn it into
 * the household's week: reminders for the dates, to-dos for the practice.
 *
 * Reminders and to-dos are created as household items with no assignee, which
 * is exactly what Today lists for every adult in the circle. Both parents see
 * them; whoever gets to it first checks it off.
 */
export async function saveChildDocument(input: {
  childId: string;
  extraction: DocumentExtraction;
  exerciseIndexes: number[];        // which of the proposed exercises to adopt
  addDateReminders: boolean;
  addPracticeTodos: boolean;
}): Promise<{ error?: string; documentId?: string; reminders?: number; todos?: number }> {
  const g = await requireGuardian(input.childId);
  if ("error" in g) return { error: g.error };
  const { userId, child } = g;
  const svc = db();
  const x = input.extraction;
  const childName = child.display_name ?? "your child";

  // 1. The document.
  const { data: doc, error: docErr } = await svc.schema("hub").from("child_documents")
    .insert({
      child_id: input.childId,
      kind: x.kind,
      title: x.title || "School document",
      doc_date: x.doc_date,
      week_start: x.week_start,
      week_end: x.week_end,
      summary: x.summary,
      extracted: x,
      created_by: userId,
    })
    .select("id")
    .single();
  if (docErr) return { error: docErr.message };
  const documentId = doc.id as string;

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
    if (error) return { error: error.message };
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
    if (error) return { error: error.message };

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
            user_id: userId,
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
        user_id: userId,
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
            user_id: userId,
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
          user_id: userId, title, notes: x.spelling.words.join(", ") || null,
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

  revalidatePath(`/children/${input.childId}`);
  revalidatePath("/children");
  revalidatePath("/home");
  return { documentId, reminders, todos };
}

// Page uploads go through app/api/children/documents/upload, a route handler:
// a server action's body is capped at 1 MB and phone photos exceed it.

/** Short-lived links to the pages of a document, for viewing. */
export async function childDocumentUrls(childId: string, documentId: string): Promise<{ error?: string; urls?: string[] }> {
  const g = await requireGuardian(childId);
  if ("error" in g) return { error: g.error };
  const svc = db();
  const { data: doc } = await svc.schema("hub").from("child_documents").select("file_paths").eq("id", documentId).eq("child_id", childId).maybeSingle();
  const paths: string[] = doc?.file_paths ?? [];
  if (paths.length === 0) return { urls: [] };
  const { data, error } = await svc.storage.from(BUCKET).createSignedUrls(paths, 600);
  if (error) return { error: error.message };
  return { urls: ((data ?? []) as { signedUrl: string }[]).map((d) => d.signedUrl) };
}

/** Mark an exercise done for a day (today by default). Idempotent per day. */
export async function logPractice(childId: string, exerciseId: string, note?: string): Promise<{ error?: string }> {
  const g = await requireGuardian(childId);
  if ("error" in g) return { error: g.error };
  const svc = db();
  const { error } = await svc.schema("hub").from("child_practice_log").upsert(
    { exercise_id: exerciseId, child_id: childId, done_on: new Date().toISOString().slice(0, 10), logged_by: g.userId, note: note ?? null },
    { onConflict: "exercise_id,done_on" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/children/${childId}`);
  return {};
}

export async function setExerciseStatus(childId: string, exerciseId: string, status: "active" | "done" | "dismissed"): Promise<{ error?: string }> {
  const g = await requireGuardian(childId);
  if ("error" in g) return { error: g.error };
  const { error } = await db().schema("hub").from("child_exercises").update({ status }).eq("id", exerciseId).eq("child_id", childId);
  if (error) return { error: error.message };
  revalidatePath(`/children/${childId}`);
  return {};
}

/** Tap a spelling word: one more practice of it this week. */
export async function markWordPracticed(childId: string, weekId: string, word: string): Promise<{ error?: string; count?: number }> {
  const g = await requireGuardian(childId);
  if ("error" in g) return { error: g.error };
  const svc = db();
  const { data: row } = await svc.schema("hub").from("child_spelling_weeks").select("practiced").eq("id", weekId).eq("child_id", childId).maybeSingle();
  if (!row) return { error: "Not found" };
  const practiced = { ...(row.practiced ?? {}) } as Record<string, number>;
  practiced[word] = (practiced[word] ?? 0) + 1;
  const { error } = await svc.schema("hub").from("child_spelling_weeks").update({ practiced }).eq("id", weekId);
  if (error) return { error: error.message };
  return { count: practiced[word] };
}

export async function deleteChildDocument(childId: string, documentId: string): Promise<{ error?: string }> {
  const g = await requireGuardian(childId);
  if ("error" in g) return { error: g.error };
  const svc = db();
  const { data: doc } = await svc.schema("hub").from("child_documents").select("file_paths").eq("id", documentId).eq("child_id", childId).maybeSingle();
  if (doc?.file_paths?.length) await svc.storage.from(BUCKET).remove(doc.file_paths);
  const { error } = await svc.schema("hub").from("child_documents").delete().eq("id", documentId).eq("child_id", childId);
  if (error) return { error: error.message };
  revalidatePath(`/children/${childId}`);
  return {};
}
