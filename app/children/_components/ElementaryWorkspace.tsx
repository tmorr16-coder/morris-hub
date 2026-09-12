"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

// A first grader's workspace, for the parents who run it.
//
// The school's week comes home on paper; this is where it lives once it has
// been photographed.
//
// The screen is in two halves. Above the line is this week: one checklist of
// everything owed — words, scripture, the practice the graded papers argued
// for, anything sent by hand — then the four places a parent goes over and
// over, in a row that never changes order. Below the line is the record: the
// dates, the scores, the newsletters, the tutor transcript. That half only
// grows, so it stays folded.
//
// It used to be one flat stack of thirteen open sections in the order the
// data arrived. That was fine for a week. By the third newsletter and the
// tenth graded paper the record was most of the screen's height and none of
// its purpose, and the two things asked for every single evening — the
// spelling words and the memory verse — were the fourth section and a
// subtitle line in the eighth.
//
// Every tap here can be taken back: a word tapped by mistake, a "Did it",
// a dismissed exercise, a whole scanned document with everything it created.

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LargeTitle, Group, Cell, IconBadge, Icons, Chip, Sparkline } from "@/components/ios";
import type { ChildWorkspaceData, ChildActivity, ChildHealthNote } from "../_lib/children";
import type { Exercise, SchoolDate, ChildTask } from "../_lib/learning";
import { resourcesFor, STAPLES, KIND_LABEL } from "../_lib/resources";
import { Fold } from "./Fold";
import { TopicGroup } from "./TopicGroup";
import { WeekProgress, WeekRows, type WeekItem } from "./WeekBoard";
import { useSectionOrder, writeLocal } from "../_lib/ui-state";
import {
  logPractice, unlogPractice, setExerciseStatus, markWordPracticed, childDocumentUrls,
  deleteChildDocument, documentImpact, assignTask, deleteTask, reopenTask, rebuildFromDocument, resetWeekPractice,
  setPinnedChild,
} from "../_lib/learning-actions";
import AddActivityForm from "./AddActivityForm";
import AddHealthNoteForm from "./AddHealthNoteForm";

const CATEGORY_META: Record<string, { color: string; icon: React.ReactNode }> = {
  school: { color: "var(--ios-tint)", icon: <Icons.BookIcon /> },
  sports: { color: "var(--ios-green)", icon: <Icons.DumbbellIcon /> },
  church: { color: "#B565A7", icon: <Icons.HeartIcon /> },
  other: { color: "var(--ios-orange)", icon: <Icons.SparkleIcon /> },
};
const DATE_KIND_LABEL: Record<SchoolDate["kind"], string> = { no_school: "No school", early_dismissal: "Early dismissal", field_trip: "Field trip", test: "Test", event: "Event", other: "" };
const FREQ_LABEL: Record<string, string> = { daily: "daily", three_a_week: "3× a week", weekly: "weekly", once: "once" };
const SUBJECT_COLOR: Record<string, string> = { spelling: "var(--ios-tint)", handwriting: "#B565A7", reading: "#5B6B9E", decoding: "#5B6B9E", math: "var(--ios-orange)", science: "var(--ios-green)", bible: "#8FA3DC", other: "#8E8E93" };
const TASK_EMOJI: Record<string, string> = { exercise: "✏️", spelling: "🔤", reading: "📖", custom: "⭐" };

function fmtDate(iso: string, weekday = true): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", weekday ? { weekday: "short", month: "short", day: "numeric" } : { month: "short", day: "numeric" });
}
function daysUntil(iso: string): number {
  const today = new Date(); today.setHours(12, 0, 0, 0);
  return Math.round((new Date(`${iso}T12:00:00`).getTime() - today.getTime()) / 86_400_000);
}
function soon(iso: string): string {
  const d = daysUntil(iso);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d < 7) return fmtDate(iso).split(",")[0];
  return fmtDate(iso, false);
}
function firstName(name: string): string {
  return name.split(" ")[0] || name;
}

/**
 * One findable thing. `text` is the haystack — everything worth matching on,
 * including words that never appear on screen (a subject key, a document's
 * summary), because a parent searching "math" should find the exercise whose
 * title only says "Count on from a number".
 */
interface Hit {
  key: string;
  title: string;
  sub?: string;
  /** Where the answer is. Absent means "open the section it lives in". */
  href?: string;
  text: string;
}

function hit(key: string, title: string, sub?: string | null, extra?: string | null, href?: string): Hit {
  return { key, title, sub: sub ?? undefined, href, text: [title, sub, extra].filter(Boolean).join(" ").toLowerCase() };
}

/**
 * Every word of the query has to appear somewhere in the haystack, in any
 * order. Substring rather than whole-word: a first grader's spelling list is
 * full of stems, and "spell" should find "spelling".
 */
function matches(hay: string, terms: string[]): boolean {
  return terms.every((t) => hay.includes(t));
}

const SUBJECT_LABEL: Record<string, string> = { spelling: "Spelling", handwriting: "Handwriting", reading: "Reading", decoding: "Decoding", math: "Math", science: "Science", bible: "Bible", other: "Other" };

interface SubjectTrend {
  subject: string;
  label: string;
  series: number[];       // percentages, oldest first
  latest: number;         // percentage
  latestText: string;     // "9/10"
  delta: number | null;   // vs the previous paper, in points
  count: number;
  lastOn: string | null;
}

/**
 * One line per subject, across every graded paper: the shape of the thing,
 * not the last number. A 9/10 in spelling and a 22/24 in decoding say nothing
 * next to each other; three spelling tests in a row say a great deal.
 */
function trendsBySubject(assessments: { subject: string; score: number | null; outOf: number | null; assessedOn: string | null }[]): SubjectTrend[] {
  const by = new Map<string, { pct: number; text: string; on: string }[]>();
  for (const a of assessments) {
    if (a.score == null || !a.outOf) continue;
    const arr = by.get(a.subject) ?? [];
    arr.push({ pct: Math.round((a.score / a.outOf) * 100), text: `${a.score}/${a.outOf}`, on: a.assessedOn ?? "" });
    by.set(a.subject, arr);
  }
  const out: SubjectTrend[] = [];
  for (const [subject, rows] of by) {
    rows.sort((x, y) => x.on.localeCompare(y.on));
    const last = rows[rows.length - 1];
    const prev = rows.length > 1 ? rows[rows.length - 2] : null;
    out.push({
      subject, label: SUBJECT_LABEL[subject] ?? subject, series: rows.map((r) => r.pct), latest: last.pct, latestText: last.text,
      delta: prev ? last.pct - prev.pct : null, count: rows.length, lastOn: last.on || null,
    });
  }
  // Weakest first: that is the one to look at.
  return out.sort((a, b) => a.latest - b.latest || (a.delta ?? 0) - (b.delta ?? 0));
}
function arrow(delta: number | null): { glyph: string; color: string } {
  if (delta == null) return { glyph: "", color: "var(--ios-label-3)" };
  if (delta > 2) return { glyph: "▲", color: "var(--ios-green)" };
  if (delta < -2) return { glyph: "▼", color: "var(--ios-red)" };
  return { glyph: "▶", color: "var(--ios-label-3)" };
}
function pctColor(p: number): string {
  return p >= 90 ? "var(--ios-green)" : p >= 75 ? "var(--ios-orange)" : "var(--ios-red)";
}

export default function ElementaryWorkspace({ data, viewerUserId }: { data: ChildWorkspaceData; viewerUserId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const justSaved = params.get("saved") === "1";
  const [activities, setActivities] = useState<ChildActivity[]>(data.activities);
  const [healthNotes, setHealthNotes] = useState<ChildHealthNote[]>(data.healthNotes);
  const [exercises, setExercises] = useState<Exercise[]>(data.learning?.exercises ?? []);
  const [tasks, setTasks] = useState<ChildTask[]>(data.learning?.tasks ?? []);
  const [practiced, setPracticed] = useState<Record<string, number>>(data.learning?.spellingWeek?.practiced ?? {});
  const [tapStack, setTapStack] = useState<string[]>([]);
  const [openExercise, setOpenExercise] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [customTask, setCustomTask] = useState("");
  const [notice, setNotice] = useState<{ text: string; undo?: () => void; ms: number; at: number } | null>(null);
  const [viewer, setViewer] = useState<{ title: string; urls: string[] } | null>(null);
  const [arranging, setArranging] = useState(false);
  const [query, setQuery] = useState("");
  const [jump, setJump] = useState<{ id: string; n: number } | null>(null);
  const [pinned, setPinned] = useState(data.pinnedToToday);
  const [pending, start] = useTransition();
  const db = createClient() as any;
  const L = data.learning;
  const week = L?.spellingWeek ?? null;
  const kid = firstName(data.name);

  useEffect(() => {
    if (!jump) return;
    document.getElementById(jump.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [jump]);

  // Each notice owns its own timeout: a new one replaces the old because the
  // effect's cleanup runs first. `at` makes every call a distinct value, so
  // saying the same thing twice still restarts the clock.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), notice.ms);
    return () => clearTimeout(t);
  }, [notice]);
  const say = useCallback((text: string, undo?: () => void, ms = 8000) => {
    setNotice({ text, undo, ms, at: Date.now() });
  }, []);

  async function complete(id: string) {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, completed: true } : a)));
    await db.schema("hub").from("child_activities").update({ completed: true }).eq("id", id);
  }
  async function resolveNote(id: string) {
    setHealthNotes((prev) => prev.map((h) => (h.id === id ? { ...h, resolved: true } : h)));
    await db.schema("hub").from("child_health_notes").update({ resolved: true }).eq("id", id);
  }

  // ── Practice, with undo ─────────────────────────────────────────────────
  function toggleDone(ex: Exercise) {
    if (ex.doneToday) {
      setExercises((prev) => prev.map((e) => (e.id === ex.id ? { ...e, doneToday: false, streak: Math.max(0, e.streak - 1) } : e)));
      start(async () => { await unlogPractice(data.childId, ex.id); });
    } else {
      setExercises((prev) => prev.map((e) => (e.id === ex.id ? { ...e, doneToday: true, streak: e.streak + 1 } : e)));
      start(async () => { await logPractice(data.childId, ex.id); });
    }
  }
  function dismiss(ex: Exercise, status: "done" | "dismissed") {
    setExercises((prev) => prev.filter((e) => e.id !== ex.id));
    setOpenExercise(null);
    start(async () => { await setExerciseStatus(data.childId, ex.id, status); });
    say(status === "done" ? `“${ex.title}” retired as mastered.` : `“${ex.title}” removed.`, () => {
      setExercises((prev) => [ex, ...prev]);
      start(async () => { await setExerciseStatus(data.childId, ex.id, "active"); });
    });
  }
  function tapWord(word: string) {
    if (!week) return;
    setPracticed((p) => ({ ...p, [word]: (p[word] ?? 0) + 1 }));
    setTapStack((s) => [...s, word]);
    start(async () => { await markWordPracticed(data.childId, week.id, word, 1); });
  }
  function undoTap() {
    if (!week || tapStack.length === 0) return;
    const word = tapStack[tapStack.length - 1];
    setTapStack((s) => s.slice(0, -1));
    setPracticed((p) => { const n = { ...p }; if ((n[word] ?? 0) <= 1) delete n[word]; else n[word] -= 1; return n; });
    start(async () => { await markWordPracticed(data.childId, week.id, word, -1); });
  }

  // ── Sending things to the child's screen ────────────────────────────────
  function sendExercise(ex: Exercise) {
    start(async () => {
      const r = await assignTask({
        childId: data.childId, kind: "exercise", exerciseId: ex.id, title: ex.title,
        instructions: ex.steps, payload: { steps: ex.steps, minutes: ex.minutes },
      });
      if (r.error) { say(`Couldn't send: ${r.error}`); return; }
      if (r.id) {
        setSent((s) => new Set(s).add(ex.id));
        setTasks((t) => [{ id: r.id!, kind: "exercise", exerciseId: ex.id, title: ex.title, instructions: ex.steps, payload: { steps: ex.steps, minutes: ex.minutes }, assignedOn: new Date().toISOString().slice(0, 10), dueOn: null, completedAt: null, stars: 0, childNote: null }, ...t]);
        say(`Sent “${ex.title}” to ${kid}'s screen.`);
      }
    });
  }
  function sendWords() {
    if (!week) return;
    const words = [...week.words, ...week.sightWords];
    start(async () => {
      const r = await assignTask({
        childId: data.childId, kind: "spelling", title: `Practise this week's words${week.pattern ? ` — ${week.pattern}` : ""}`,
        instructions: "Listen to each word, then spell it.", payload: { words },
      });
      if (r.error) { say(`Couldn't send: ${r.error}`); return; }
      if (r.id) {
        setSent((s) => new Set(s).add("words"));
        setTasks((t) => [{ id: r.id!, kind: "spelling", exerciseId: null, title: "Practise this week's words", instructions: null, payload: { words }, assignedOn: new Date().toISOString().slice(0, 10), dueOn: null, completedAt: null, stars: 0, childNote: null }, ...t]);
        say(`Sent ${words.length} words to ${kid}'s screen.`);
      }
    });
  }
  function sendCustom() {
    const title = customTask.trim();
    if (!title) return;
    setCustomTask("");
    start(async () => {
      const r = await assignTask({ childId: data.childId, kind: "custom", title });
      if (r.error) { say(`Couldn't send: ${r.error}`); setCustomTask(title); return; }
      if (r.id) {
        setTasks((t) => [{ id: r.id!, kind: "custom", exerciseId: null, title, instructions: null, payload: {}, assignedOn: new Date().toISOString().slice(0, 10), dueOn: null, completedAt: null, stars: 0, childNote: null }, ...t]);
        say(`Sent “${title}” to ${kid}'s screen.`);
      }
    });
  }
  function removeTask(t: ChildTask) {
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    start(async () => { await deleteTask(data.childId, t.id); });
  }
  function reopen(t: ChildTask) {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completedAt: null, stars: 0 } : x)));
    start(async () => { await reopenTask(data.childId, t.id); });
  }

  // ── Documents ───────────────────────────────────────────────────────────
  // Every page, stacked, in the app. The first version opened only the first
  // page's link in a new tab.
  async function openDocument(id: string, title: string) {
    const r = await childDocumentUrls(data.childId, id);
    if (r.error) { say(r.error); return; }
    if (!r.urls || r.urls.length === 0) { say("No pages are attached to this document."); return; }
    setViewer({ title, urls: r.urls });
  }
  async function rebuildDocument(id: string, title: string, kind: string) {
    const ok = window.confirm(`Rebuild the plan from “${title}” without re-reading it?\n\nEverything it created is removed and made again from the stored read, with every recommended exercise back in${kind === "newsletter" ? ", and its dates and the spelling test back on Today" : ""}. Practice taps and “Did it” logs for its exercises start over.`);
    if (!ok) return;
    const r = await rebuildFromDocument(data.childId, id);
    if (r.error) { say(r.error); return; }
    say(`Rebuilt from “${title}”: ${r.exercises} exercise${r.exercises === 1 ? "" : "s"}${r.todos ? `, ${r.todos} to-dos` : ""}${r.reminders ? `, ${r.reminders} reminders` : ""}.`);
    router.refresh();
  }
  async function resetPractice() {
    const ok = window.confirm("Reset this week's practice? Word taps go back to zero and “Did it” marks from the last seven days are cleared. Documents and exercises stay.");
    if (!ok) return;
    const r = await resetWeekPractice(data.childId);
    if (r.error) { say(r.error); return; }
    setPracticed({}); setTapStack([]);
    setExercises((prev) => prev.map((e) => ({ ...e, doneToday: false, streak: 0, doneDates: [] })));
    say("Practice reset for the week.");
    router.refresh();
  }
  async function removeDocument(id: string, title: string) {
    const im = await documentImpact(data.childId, id);
    const parts = [
      im.exercises ? `${im.exercises} exercise${im.exercises === 1 ? "" : "s"}` : null,
      im.assessments ? `${im.assessments} score${im.assessments === 1 ? "" : "s"}` : null,
      im.spellingWeeks ? "this week's spelling list" : null,
      im.todos ? `${im.todos} to-do${im.todos === 1 ? "" : "s"}` : null,
      im.reminders ? `${im.reminders} reminder${im.reminders === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    const ok = window.confirm(`Delete “${title}”?${parts.length ? `\n\nThis also removes everything it created: ${parts.join(", ")}.` : ""}`);
    if (!ok) return;
    const r = await deleteChildDocument(data.childId, id);
    if (r.error) { say(r.error); return; }
    say(`Deleted “${title}” and what it created.`);
    router.refresh();
  }

  const today = activities.filter((a) => !a.completed);
  const done = activities.filter((a) => a.completed);
  const openNotes = healthNotes.filter((h) => !h.resolved);
  const openTasks = tasks.filter((t) => !t.completedAt);

  const trends = trendsBySubject(L?.assessments ?? []);
  const watch = trends[0] ?? null;
  const wordsPracticed = week ? week.words.filter((w) => (practiced[w] ?? 0) > 0).length : 0;
  const totalWords = week ? week.words.length + week.sightWords.length : 0;
  const allWordsPractised = week ? [...week.words, ...week.sightWords].every((w) => (practiced[w] ?? 0) > 0) : false;
  const newsletter = L?.latestNewsletter;
  const nx = newsletter?.extracted;
  const isGuardian = data.viewerIsGuardian;

  // ── The week's standing work ────────────────────────────────────────────
  // Scripture and memory work come home every week in the same three shapes.
  // They used to be three subtitle lines inside "This week at school", eight
  // sections down; they are the most repeated thing the school asks for, so
  // they get a section and a place in the checklist.
  const scripture = [
    nx?.memory_verse ? { key: "verse", label: "Memory verse", glyph: "\u{1F4D6}", text: nx.memory_verse } : null,
    nx?.recitation ? { key: "recitation", label: "Recitation", glyph: "\u{1F5E3}️", text: nx.recitation } : null,
    nx?.read_aloud ? { key: "readaloud", label: "Read aloud", glyph: "\u{1F4DA}", text: nx.read_aloud } : null,
  ].filter(Boolean) as { key: string; label: string; glyph: string; text: string }[];

  const requests = (nx?.parent_requests ?? []) as string[];

  /** The task a titled item was sent as, if it was. Titles are fixed strings. */
  const taskByTitle = (title: string) => tasks.find((t) => t.title === title) ?? null;

  function sendTitled(title: string, text: string | null, kind: "reading" | "custom") {
    start(async () => {
      const r = await assignTask({ childId: data.childId, kind, title, instructions: text });
      if (r.error) { say(`Couldn't send: ${r.error}`); return; }
      if (r.id) {
        setTasks((t) => [{ id: r.id!, kind, exerciseId: null, title, instructions: text, payload: {}, assignedOn: new Date().toISOString().slice(0, 10), dueOn: null, completedAt: null, stars: 0, childNote: null }, ...t]);
        say(`Sent “${title}” to ${kid}'s screen.`);
      }
    });
  }

  // ── The checklist ───────────────────────────────────────────────────────
  // Everything owed this week, from four tables, in the order a parent works
  // through it: words, scripture, the practice the papers argued for, then
  // whatever was sent by hand.
  const weekItems: WeekItem[] = [];
  const claimedTaskIds = new Set<string>();

  if (week && totalWords > 0) {
    const wordTask = tasks.find((t) => t.kind === "spelling");
    if (wordTask) claimedTaskIds.add(wordTask.id);
    weekItems.push({
      key: "spelling",
      group: "Words",
      glyph: "\u{1F524}",
      label: "Spelling words",
      detail: [week.pattern, week.testOn ? `test ${soon(week.testOn)}` : null].filter(Boolean).join(" · ") || null,
      progress: { done: wordsPracticed + week.sightWords.filter((w) => (practiced[w] ?? 0) > 0).length, total: totalWords },
      done: allWordsPractised,
      href: "#spelling",
      action: isGuardian ? { label: sent.has("words") || wordTask ? "Sent" : "Send", run: sendWords, disabled: sent.has("words") || !!wordTask, muted: sent.has("words") || !!wordTask } : null,
    });
  }

  for (const sc of scripture) {
    const t = taskByTitle(sc.label);
    if (t) claimedTaskIds.add(t.id);
    weekItems.push({
      key: sc.key,
      group: "Scripture and memory",
      glyph: sc.glyph,
      label: sc.label,
      detail: sc.text,
      done: !!t?.completedAt,
      href: "#scripture",
      action: isGuardian ? { label: t ? (t.completedAt ? "Done ✓" : "Sent") : "Send", run: () => sendTitled(sc.label, sc.text, "reading"), disabled: !!t, muted: !!t } : null,
    });
  }

  for (const ex of exercises) {
    const t = tasks.find((x) => x.exerciseId === ex.id);
    if (t) claimedTaskIds.add(t.id);
    weekItems.push({
      key: `ex-${ex.id}`,
      group: "Practice",
      glyph: "✏️",
      label: ex.title,
      detail: [ex.minutes ? `${ex.minutes} min` : null, FREQ_LABEL[ex.frequency], ex.streak > 0 ? `${ex.streak}-day streak` : null].filter(Boolean).join(" · "),
      done: ex.doneToday,
      href: "#practice",
      action: { label: ex.doneToday ? "Done ✓" : "Did it", run: () => toggleDone(ex), disabled: pending, muted: ex.doneToday },
    });
  }

  for (const r of requests) {
    const t = taskByTitle(r);
    if (t) claimedTaskIds.add(t.id);
    weekItems.push({
      key: `req-${r}`,
      group: "Asked by the teacher",
      glyph: "\u{1F514}",
      label: r,
      detail: "Asked for in the newsletter",
      done: !!t?.completedAt,
      action: isGuardian ? { label: t ? (t.completedAt ? "Done ✓" : "Sent") : "Send", run: () => sendTitled(r, null, "custom"), disabled: !!t, muted: !!t } : null,
    });
  }

  // Anything a parent typed in by hand, and anything sent that the sections
  // above did not already account for.
  for (const t of tasks) {
    if (claimedTaskIds.has(t.id)) continue;
    weekItems.push({
      key: `task-${t.id}`,
      group: "Sent by hand",
      glyph: TASK_EMOJI[t.kind] ?? "⭐",
      label: t.title,
      detail: t.completedAt ? `Done · ${"⭐".repeat(Math.max(1, t.stars))}` : `On ${kid}'s screen`,
      done: !!t.completedAt,
      action: isGuardian
        ? t.completedAt
          ? { label: "Undo", run: () => reopen(t), muted: true }
          : { label: "Remove", run: () => removeTask(t), muted: true }
        : null,
    });
  }

  // ── Practice, by skill ──────────────────────────────────────────────────
  // Undone first inside each group, so the evening's remaining work is at the
  // top of every heading rather than hunted for among the ticks. Groups keep
  // the order their first exercise arrived in, which is newest paper first.
  const exerciseGroups: [string, Exercise[]][] = (() => {
    const by = new Map<string, Exercise[]>();
    for (const ex of exercises) {
      const key = (ex.skill ?? "Practice").trim() || "Practice";
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      const arr = by.get(label) ?? [];
      arr.push(ex);
      by.set(label, arr);
    }
    for (const arr of by.values()) {
      arr.sort((a, b) => Number(a.doneToday) - Number(b.doneToday));
    }
    return [...by.entries()];
  })();

  // ── Resources ───────────────────────────────────────────────────────────
  const resourceSections = resourcesFor([
    ...exercises.map((e) => `${e.skill ?? ""} ${e.title}`),
    ...trends.map((t) => t.subject),
    week?.pattern,
    week ? "spelling" : null,
    scripture.length > 0 ? "scripture memory verse" : null,
    ...(nx?.academics ?? []).map((a) => `${a.subject} ${a.topics.join(" ")}`),
  ]);

  const kidHref = `/children/${data.childId}/kid`;

  // ── The sections ────────────────────────────────────────────────────────
  // Built as data rather than written straight into the tree, because the
  // order is the reader's to choose. What one parent checks nightly the other
  // never opens, and the useful order in September is not the useful order in
  // May. Everything below the four tiles is a fold, and every fold can move.
  interface Section {
    id: string;
    title: string;
    count?: number | string;
    summary?: string;
    defaultOpen?: boolean;
    accessory?: React.ReactNode;
    body: React.ReactNode;
    /** Plain text for Find. A section with none is simply never a result. */
    search?: Hit[];
  }
  const sections: Section[] = [];

  sections.push({
    id: "week",
    title: "This week",
    defaultOpen: true,
    accessory: <WeekProgress items={weekItems} weekLabel={week?.weekStart ? `Week of ${fmtDate(week.weekStart, false)}${week.testOn ? ` · spelling test ${soon(week.testOn)}` : ""}` : "Everything owed this week"} />,
    summary: weekItems.length === 0 ? undefined : `${weekItems.filter((i) => !i.done).length} still to do.`,
    search: weekItems.map((it) => hit(`w-${it.key}`, it.label, it.detail, `${it.group} ${it.done ? "done" : "to do"}`)),
    body: <WeekRows items={weekItems} keyPrefix={`ch-topic-week-${data.childId}`} emptyNote="Nothing set for this week yet. Photograph the newsletter or a graded paper and the week fills itself in." />,
  });

  if (week) {
    const practisedCount = wordsPracticed + week.sightWords.filter((w) => (practiced[w] ?? 0) > 0).length;
    sections.push({
      id: "spelling",
      title: "Spelling this week",
      count: `${practisedCount}/${totalWords}`,
      defaultOpen: true,
      summary: `${week.pattern ?? `${totalWords} words`}${week.testOn ? ` · test ${soon(week.testOn)}` : ""}.`,
      search: [
        ...(week.pattern ? [hit("sp-pattern", week.pattern, week.testOn ? `Test ${fmtDate(week.testOn)}` : null, "spelling pattern")] : []),
        ...week.words.map((w) => hit(`sp-${w}`, w, (practiced[w] ?? 0) > 0 ? `Practised ${practiced[w]}×` : "Not practised yet", "spelling word")),
        ...week.sightWords.map((w) => hit(`sw-${w}`, w, "Sight word", "spelling sight word")),
      ],
      body: (
        <>
          <div className="ios-list" style={{ margin: "0 var(--ios-gutter)" }}>
            {week.pattern && <Cell chevron={false} title={week.pattern} subtitle={week.testOn ? `Test ${fmtDate(week.testOn)}` : undefined} />}
            <div style={{ padding: "10px 16px 6px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {week.words.map((w) => {
                const n = practiced[w] ?? 0;
                return <Chip key={w} small selected={n > 0} onClick={() => tapWord(w)}>{w}{n > 1 ? ` ×${n}` : ""}</Chip>;
              })}
              {week.sightWords.map((w) => <Chip key={`s-${w}`} small selected onClick={() => tapWord(w)}>{w}{(practiced[w] ?? 0) > 1 ? ` ×${practiced[w]}` : ""}</Chip>)}
            </div>
            <div style={{ display: "flex", gap: 14, padding: "4px 16px 12px", alignItems: "center", flexWrap: "wrap" }}>
              {tapStack.length > 0 && <button type="button" className="ios-btn--plain" onClick={undoTap} style={{ color: "var(--ios-label-2)" }}>Undo last tap ({tapStack[tapStack.length - 1]})</button>}
              {isGuardian && <button type="button" className="ios-btn--plain" disabled={sent.has("words")} onClick={sendWords} style={{ color: sent.has("words") ? "var(--ios-green)" : "var(--ios-tint)", fontWeight: 600 }}>{sent.has("words") ? `Sent to ${kid}` : `Send the words to ${kid}'s screen`}</button>}
              {isGuardian && <button type="button" className="ios-btn--plain" onClick={resetPractice} style={{ color: "var(--ios-label-3)", fontSize: 13 }}>Reset</button>}
            </div>
          </div>
          <p className="ios-group-footer ios-footnote">Tap a word each time you practise it together. Sight words are in colour.</p>
        </>
      ),
    });
  }

  if (scripture.length > 0) {
    sections.push({
      id: "scripture",
      title: "Scripture this week",
      count: scripture.length,
      defaultOpen: true,
      summary: scripture.map((sc) => sc.label).join(", ") + ".",
      search: scripture.map((sc) => hit(`sc-${sc.key}`, sc.label, sc.text, "scripture memory verse recitation")),
      body: (
        <>
          <div className="ios-list" style={{ margin: "0 var(--ios-gutter)" }}>
            {scripture.map((sc) => {
              const t = taskByTitle(sc.label);
              return (
                <Cell
                  key={sc.key}
                  chevron={false}
                  lead={<span style={{ fontSize: 22, width: 30, textAlign: "center" }}>{sc.glyph}</span>}
                  title={sc.label}
                  subtitle={<span style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{sc.text}</span>}
                  trailing={isGuardian ? (
                    <button type="button" className="ios-btn--plain" disabled={!!t} onClick={() => sendTitled(sc.label, sc.text, "reading")} style={{ color: t?.completedAt ? "var(--ios-green)" : t ? "var(--ios-label-3)" : "var(--ios-tint)", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {t?.completedAt ? "Done ✓" : t ? "Sent" : "Send"}
                    </button>
                  ) : undefined}
                />
              );
            })}
          </div>
          <p className="ios-group-footer ios-footnote">The same three every week. Send one and it waits on the child&rsquo;s screen, which reads it aloud.</p>
        </>
      ),
    });
  }

  if (L) {
    sections.push({
      id: "practice",
      title: "Practice tonight",
      count: exercises.length,
      defaultOpen: true,
      summary: exercises.length === 0 ? "Nothing planned yet." : `${exercises.filter((e) => !e.doneToday).length} left today.`,
      search: exercises.map((ex) => hit(`ex-${ex.id}`, ex.title, ex.rationale, `${ex.skill ?? ""} ${ex.steps ?? ""} ${ex.materials ?? ""} ${FREQ_LABEL[ex.frequency]}`)),
      body: (
        <>
          {/* Grouped by skill, not left in the order the papers were
              photographed. Four exercises off two graded papers arrive
              interleaved — a decoding drill, a math drill, another decoding
              drill — and reading them that way makes the plan look like more
              work than it is. Together, they read as "the reading work" and
              "the math work", which is how an evening actually gets divided. */}
          <div className="ios-list" style={{ margin: "0 var(--ios-gutter)", overflow: "hidden", padding: 0 }}>
          {exerciseGroups.map(([skill, list], gi) => (
          <TopicGroup
            key={skill}
            storageKey={`ch-topic-prac-${data.childId}-${skill}`}
            title={skill}
            done={list.filter((e) => e.doneToday).length}
            total={list.length}
            first={gi === 0}
          >
            {list.map((ex) => {
              const openEx = openExercise === ex.id;
              return (
                <div key={ex.id}>
                  <Cell
                    chevron={false}
                    onClick={() => setOpenExercise(openEx ? null : ex.id)}
                    lead={<IconBadge color={ex.doneToday ? "var(--ios-green)" : "var(--ios-orange)"}>{ex.doneToday ? <Icons.ChecklistIcon /> : <Icons.SparkleIcon />}</IconBadge>}
                    title={ex.title}
                    subtitle={<><span>{ex.rationale}</span><span style={{ display: "block", color: "var(--ios-label-3)" }}>{ex.minutes ? `${ex.minutes} min · ` : ""}{FREQ_LABEL[ex.frequency]}{ex.streak > 0 ? ` · ${ex.streak}-day streak` : ""}</span></>}
                    trailing={
                      <button type="button" className="ios-btn--plain" disabled={pending} onClick={(e) => { e.stopPropagation(); toggleDone(ex); }} style={{ color: ex.doneToday ? "var(--ios-green)" : "var(--ios-tint)", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {ex.doneToday ? "Done ✓" : "Did it"}
                      </button>
                    }
                  />
                  {openEx && (
                    <div style={{ padding: "4px 16px 14px 16px", borderTop: "1px solid var(--ios-separator)" }}>
                      {ex.skill && <div className="ios-caption" style={{ color: "var(--ios-label-3)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "8px 0 4px" }}>{ex.skill}</div>}
                      {ex.steps && <div className="ios-subhead" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{ex.steps}</div>}
                      {ex.materials && <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 8 }}>Have ready: {ex.materials}</div>}
                      <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                        {isGuardian && <button type="button" className="ios-btn--plain" disabled={sent.has(ex.id)} onClick={() => sendExercise(ex)} style={{ color: sent.has(ex.id) ? "var(--ios-green)" : "var(--ios-tint)", fontWeight: 700 }}>{sent.has(ex.id) ? `Sent to ${kid} ✓` : `Send to ${kid}'s screen`}</button>}
                        <button type="button" className="ios-btn--plain" onClick={() => dismiss(ex, "done")} style={{ color: "var(--ios-label-2)" }}>Mastered — retire it</button>
                        <button type="button" className="ios-btn--plain" onClick={() => dismiss(ex, "dismissed")} style={{ color: "var(--ios-label-3)" }}>Not for us</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </TopicGroup>
          ))}
          </div>
          <p className="ios-group-footer ios-footnote">{exercises.length === 0 ? "Nothing planned yet. Photograph a graded paper or the newsletter and the plan is proposed from the teacher's marks." : "Each one traces to something the teacher wrote or the paper showed. Tap for the steps; tap Done again to take it back."}</p>
        </>
      ),
    });
  }

  if (resourceSections.length > 0) {
    sections.push({
      id: "resources",
      title: "More practice",
      count: resourceSections.reduce((n, sec) => n + sec.items.length, 0) + STAPLES.length,
      defaultOpen: true,
      summary: `Free sites for ${resourceSections.map((sec) => sec.label).join(", ")}, chosen for what ${kid} is working on now.`,
      search: [
        ...resourceSections.flatMap((sec) => sec.items.map((r) => hit(`rs-${r.url}`, r.name, r.note, `${sec.label} ${KIND_LABEL[r.kind]}`, r.url))),
        ...STAPLES.map((r) => hit(`st-${r.url}`, r.name, r.note, KIND_LABEL[r.kind], r.url)),
      ],
      body: (
        <>
          {resourceSections.map((sec) => (
            <div key={sec.label} className="ios-list" style={{ margin: "0 var(--ios-gutter) 10px" }}>
              <div className="ios-caption" style={{ padding: "10px 16px 2px", color: "var(--ios-label-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>For {sec.label}</div>
              {sec.items.map((r) => (
                <Cell key={r.url} href={r.url} title={r.name} subtitle={r.note} trailing={<span className="ios-caption" style={{ color: "var(--ios-label-3)", border: "1px solid currentColor", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{KIND_LABEL[r.kind]}</span>} />
              ))}
            </div>
          ))}
          <div className="ios-list" style={{ margin: "0 var(--ios-gutter)" }}>
            <div className="ios-caption" style={{ padding: "10px 16px 2px", color: "var(--ios-label-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Always worth a visit</div>
            {STAPLES.map((r) => (
              <Cell key={r.url} href={r.url} title={r.name} subtitle={r.note} trailing={<span className="ios-caption" style={{ color: "var(--ios-label-3)", border: "1px solid currentColor", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{KIND_LABEL[r.kind]}</span>} />
            ))}
          </div>
        </>
      ),
    });
  }

  if (isGuardian) {
    sections.push({
      id: "send",
      title: `Send ${kid} something`,
      defaultOpen: true,
      summary: "Anything at all, in your own words.",
      body: (
        <div style={{ display: "flex", gap: 8, margin: "0 var(--ios-gutter)" }}>
          <input value={customTask} onChange={(e) => setCustomTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendCustom(); }} placeholder={`e.g. “Read one page of Farmer Boy to Mom”`} style={{ flex: 1, minWidth: 0, padding: "11px 12px", borderRadius: 10, border: "none", background: "var(--ios-fill)", color: "var(--ios-label)", fontSize: 15 }} />
          <button type="button" className="ios-btn ios-btn--primary" disabled={!customTask.trim() || pending} onClick={sendCustom}>Send</button>
        </div>
      ),
    });
  }

  if (L && L.upcomingDates.length > 0) {
    sections.push({
      id: "dates",
      title: "Coming up",
      count: L.upcomingDates.length,
      summary: `Next: ${L.upcomingDates[0].title} · ${soon(L.upcomingDates[0].date)}.`,
      search: L.upcomingDates.map((d, i) => hit(`dt-${i}`, d.title, `${fmtDate(d.date)}${DATE_KIND_LABEL[d.kind] ? ` · ${DATE_KIND_LABEL[d.kind]}` : ""}`, `${d.note ?? ""} ${d.kind}`)),
      body: (
        <div className="ios-list" style={{ margin: "0 var(--ios-gutter)" }}>
          {L.upcomingDates.map((d, i) => (
            <Cell key={i} chevron={false} lead={<IconBadge color={d.kind === "no_school" || d.kind === "early_dismissal" ? "var(--ios-orange)" : "var(--ios-tint)"}><Icons.CalendarIcon /></IconBadge>} title={d.title} subtitle={`${fmtDate(d.date)}${DATE_KIND_LABEL[d.kind] ? ` · ${DATE_KIND_LABEL[d.kind]}` : ""}${d.note ? ` · ${d.note}` : ""}`} trailing={<span className="ios-caption" style={{ color: daysUntil(d.date) <= 1 ? "var(--ios-orange)" : "var(--ios-label-3)" }}>{soon(d.date)}</span>} />
          ))}
        </div>
      ),
    });
  }

  if (L && L.assessments.length > 0) {
    sections.push({
      id: "progress",
      title: "How it's going",
      count: `${trends.length} subject${trends.length === 1 ? "" : "s"}`,
      summary: watch ? `Weakest is ${watch.label} at ${watch.latest}%, across ${L.assessments.length} graded paper${L.assessments.length === 1 ? "" : "s"}.` : undefined,
      search: [
        ...trends.map((t) => hit(`tr-${t.subject}`, t.label, `${t.latestText} latest · ${t.latest}%`, `${t.subject} ${t.count} papers score grade`)),
        ...L.assessments.map((a) => hit(`as-${a.id}`, a.title, `${a.subject}${a.score != null && a.outOf ? ` · ${a.score}/${a.outOf}` : ""}`, `${a.teacherFeedback ?? ""} ${a.observations.join(" ")}`)),
      ],
      body: (
        <>
          <div className="ios-list" style={{ margin: "0 var(--ios-gutter)" }}>
            {trends.map((t) => {
              const a = arrow(t.delta);
              return (
                <Cell key={t.subject} chevron={false}
                  lead={<IconBadge color={SUBJECT_COLOR[t.subject] ?? SUBJECT_COLOR.other}><Icons.ChartIcon /></IconBadge>}
                  title={t.label}
                  subtitle={`${t.latestText} latest · ${t.count} paper${t.count === 1 ? "" : "s"}${t.lastOn ? ` · ${fmtDate(t.lastOn, false)}` : ""}`}
                  trailing={
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {t.series.length > 1 ? <Sparkline points={t.series} color={pctColor(t.latest)} width={72} height={26} /> : <span style={{ width: 72 }} />}
                      <span style={{ fontWeight: 700, color: pctColor(t.latest), whiteSpace: "nowrap" }}>{t.latest}%</span>
                      {a.glyph && <span style={{ color: a.color, fontSize: 12 }}>{a.glyph}</span>}
                    </span>
                  }
                />
              );
            })}
          </div>
          <p className="ios-group-footer ios-footnote">One line per subject across every graded paper, weakest first. The arrow compares the latest paper with the one before it.</p>
        </>
      ),
    });
  }

  if (nx && (nx.academics?.length ?? 0) > 0) {
    sections.push({
      id: "school",
      title: "This week at school",
      count: nx.academics?.length ?? 0,
      summary: `${(nx.academics ?? []).map((a) => a.subject).join(", ")}${newsletter?.docDate ? ` · newsletter of ${fmtDate(newsletter.docDate, false)}` : ""}.`,
      search: (nx.academics ?? []).map((a, i) => hit(`ac-${i}`, a.subject, a.topics.join(" · "), "this week at school")),
      body: (
        <div className="ios-list" style={{ margin: "0 var(--ios-gutter)" }}>
          {(nx.academics ?? []).map((a, i) => <Cell key={i} chevron={false} title={a.subject} subtitle={a.topics.join(" · ")} />)}
        </div>
      ),
    });
  }

  if (isGuardian && L) {
    sections.push({
      id: "buddy",
      title: `What ${kid} asked Buddy`,
      count: L.tutorRecent.length,
      summary: L.tutorRecent.length === 0 ? "Nothing yet. Everything Buddy and the child say to each other is kept here for you." : `Latest: “${L.tutorRecent[0].content.replace(/\[\[([^\]]+)\]\]/g, "$1").slice(0, 70)}…”`,
      search: L.tutorRecent.map((m) => hit(`tu-${m.id}`, m.content.replace(/\[\[([^\]]+)\]\]/g, "$1"), m.role === "assistant" ? "Buddy" : kid, "tutor conversation", `/children/${data.childId}/buddy`)),
      body: (
        <div className="ios-list" style={{ margin: "0 var(--ios-gutter)" }}>
          {[...L.tutorRecent].reverse().slice(-6).map((m) => (
            <Cell key={m.id} chevron={false} lead={<span style={{ fontSize: 20, width: 30, textAlign: "center" }}>{m.role === "assistant" ? "\u{1F989}" : "\u{1F9D2}"}</span>} title={<span style={{ fontWeight: 400, color: m.role === "assistant" ? "var(--ios-label-2)" : "var(--ios-label)" }}>{m.content.replace(/\[\[([^\]]+)\]\]/g, "$1")}</span>} subtitle={new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} />
          ))}
          <Cell href={`/children/${data.childId}/buddy`} lead={<IconBadge color="var(--ios-orange)"><Icons.SparkleIcon /></IconBadge>} title="All conversations" subtitle="By day and sitting" />
        </div>
      ),
    });
  }

  if (L && L.documents.length > 0) {
    sections.push({
      id: "docs",
      title: "From school",
      count: L.documents.length,
      summary: `${L.documents.length} scanned page${L.documents.length === 1 ? "" : "s"}, newest ${L.documents[0].docDate ? fmtDate(L.documents[0].docDate, false) : "recently"}.`,
      search: L.documents.map((d) => hit(`dc-${d.id}`, d.title, d.docDate ? fmtDate(d.docDate, false) : null, `${d.summary ?? ""} ${d.kind.replace("_", " ")}`)),
      body: (
        <>
          <div className="ios-list" style={{ margin: "0 var(--ios-gutter)" }}>
            {L.documents.map((d) => (
              <Cell key={d.id} chevron={false}
                lead={<IconBadge color={d.kind === "newsletter" ? "var(--ios-tint)" : d.kind === "graded_work" ? "var(--ios-green)" : "#8E8E93"}><Icons.BookIcon /></IconBadge>}
                title={d.title}
                subtitle={`${d.docDate ? fmtDate(d.docDate, false) : new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}${d.filePaths.length > 0 ? ` · ${d.filePaths.length} page${d.filePaths.length === 1 ? "" : "s"}` : ""}${d.summary ? ` · ${d.summary}` : ""}`}
                trailing={
                  <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    {d.filePaths.length > 0 && <button type="button" className="ios-btn--plain" onClick={() => openDocument(d.id, d.title)} style={{ color: "var(--ios-tint)" }}>View</button>}
                    {isGuardian && <button type="button" className="ios-btn--plain" onClick={() => rebuildDocument(d.id, d.title, d.kind)} style={{ color: "var(--ios-label-2)" }}>Rebuild</button>}
                    {isGuardian && <button type="button" className="ios-btn--plain" onClick={() => removeDocument(d.id, d.title)} style={{ color: "var(--ios-red)" }}>Delete</button>}
                  </span>
                }
              />
            ))}
          </div>
          <p className="ios-group-footer ios-footnote">Rebuild remakes the plan from the stored read — no camera, no waiting — with every recommended exercise back. Delete removes the document and everything it created.</p>
        </>
      ),
    });
  }

  sections.push({
    id: "routine",
    title: "Routine and health",
    count: today.length + openNotes.length,
    summary: today.length === 0 && openNotes.length === 0 ? "Nothing on the list, no notes for the next visit." : `${today.length} on the routine, ${openNotes.length} note${openNotes.length === 1 ? "" : "s"} for the next visit.`,
    search: [
      ...activities.map((a) => hit(`ac-${a.id}`, a.title, a.completed ? "Done" : "On the routine", `${a.category} ${a.notes ?? ""}`)),
      ...healthNotes.map((h) => hit(`hn-${h.id}`, h.note, h.resolved ? "Resolved" : "For the next visit", "health note doctor visit")),
    ],
    body: (
      <>
        <div className="ios-list" style={{ margin: "0 var(--ios-gutter)" }}>
          {today.map((a) => {
            const meta = CATEGORY_META[a.category] ?? CATEGORY_META.other;
            return (
              <Cell key={a.id} onClick={() => complete(a.id)} chevron={false} lead={<IconBadge color={meta.color}>{meta.icon}</IconBadge>} title={a.title}
                trailing={<span aria-hidden style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid var(--ios-separator)", flexShrink: 0 }} />} />
            );
          })}
          {done.map((a) => (
            <Cell key={a.id} chevron={false} lead={<IconBadge color="var(--ios-green)"><Icons.ChecklistIcon /></IconBadge>} title={<span style={{ textDecoration: "line-through", color: "var(--ios-label-2)" }}>{a.title}</span>} />
          ))}
          {openNotes.map((h) => (
            <Cell key={h.id} chevron={false} lead={<IconBadge color="#B565A7"><Icons.HeartIcon /></IconBadge>} title={h.note} subtitle={h.targetVisitDate ? `For the visit on ${fmtDate(h.targetVisitDate, false)}` : "For the next visit"}
              trailing={<button type="button" className="ios-btn--plain" onClick={() => resolveNote(h.id)} style={{ fontSize: 15 }}>Resolve</button>} />
          ))}
        </div>
        <div style={{ margin: "12px var(--ios-gutter) 0" }}>
          <AddActivityForm childId={data.childId} viewerUserId={viewerUserId} onAdded={(a) => setActivities((prev) => [...prev, a])} />
        </div>
        <div style={{ margin: "12px var(--ios-gutter) 0" }}>
          <AddHealthNoteForm childId={data.childId} viewerUserId={viewerUserId} onAdded={(h) => setHealthNotes((prev) => [...prev, h])} />
        </div>
      </>
    ),
  });

  const { order, move, reset, customised } = useSectionOrder(`ch-order-${data.childId}`, sections.map((sec) => sec.id));
  const byId = new Map(sections.map((sec) => [sec.id, sec]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as Section[];

  // ── Find ────────────────────────────────────────────────────────────────
  // Results follow the reader's own section order rather than a relevance
  // score. There is no corpus here to rank against — forty rows across eleven
  // sections — and a parent who has arranged the screen already knows where
  // things sit, so honouring that beats guessing at importance.
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = terms.length === 0 ? [] : ordered
    .map((sec) => ({ sec, hits: (sec.search ?? []).filter((h) => matches(h.text, terms)) }))
    .filter((r) => r.hits.length > 0);
  const resultCount = results.reduce((n, r) => n + r.hits.length, 0);

  /** Open the section a result lives in, drop the query, and scroll to it. */
  function reveal(sectionId: string) {
    writeLocal(`ch-fold-${sectionId}-${data.childId}`, true);
    setQuery("");
    setJump((j) => ({ id: sectionId, n: (j?.n ?? 0) + 1 }));
  }

  return (
    <>
      <LargeTitle
        title={data.name}
        subtitle={[L?.gradeLabel, data.age != null ? `Age ${data.age}` : null].filter(Boolean).join(" · ") || "Student Success"}
      />

      {notice && (
        <div className="ios-list" style={{ margin: "0 var(--ios-gutter) 8px", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span className="ios-subhead">{notice.text}</span>
          {notice.undo && <button type="button" className="ios-btn--plain" onClick={() => { notice.undo?.(); setNotice(null); }} style={{ color: "var(--ios-tint)", fontWeight: 700 }}>Undo</button>}
        </div>
      )}

      {justSaved && !notice && (
        <div className="ios-list" style={{ margin: "0 var(--ios-gutter) 8px", padding: "12px 14px" }}>
          <div className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-green)" }}>Kept.</div>
          <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
            {Number(params.get("reminders") ?? 0) > 0 ? `${params.get("reminders")} reminders and ` : ""}{Number(params.get("todos") ?? 0) > 0 ? `${params.get("todos")} practice to-dos ` : ""}{(Number(params.get("reminders") ?? 0) + Number(params.get("todos") ?? 0)) > 0 ? "are on Today for both of you." : "Nothing was added to Today."}
            {params.get("pages") === "0" ? " The page photos could not be attached; the plan was kept without them." : ""}
            {" "}Wrong read? Delete it under “From school” and everything it created goes with it.
          </div>
        </div>
      )}

      {/* ── The four places, always in the same order ───────────────────── */}
      {/* These are navigation, not content, so they are the one part of the
          screen that does not move and does not fold. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, margin: "0 var(--ios-gutter)" }}>
        {[
          { href: "#spelling", glyph: "\u{1F524}", label: "Spelling", sub: week ? `${wordsPracticed + week.sightWords.filter((w) => (practiced[w] ?? 0) > 0).length}/${totalWords}` : "—" },
          { href: "#scripture", glyph: "\u{1F4D6}", label: "Scripture", sub: scripture.length > 0 ? `${scripture.length}` : "—" },
          { href: `${kidHref}?open=buddy`, glyph: "\u{1F989}", label: "Buddy", sub: "Ask" },
          { href: `/children/${data.childId}/import`, glyph: "\u{1F4F7}", label: "Add", sub: "From school" },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              padding: "12px 4px 10px", borderRadius: 14, background: "var(--ios-cell)",
              border: "1px solid var(--ios-separator)", textDecoration: "none", color: "var(--ios-label)",
            }}
          >
            <span aria-hidden style={{ fontSize: 24, lineHeight: 1 }}>{t.glyph}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{t.label}</span>
            <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>{t.sub}</span>
          </Link>
        ))}
      </div>

      {/* ── Find ───────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", margin: "10px var(--ios-gutter) 0" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          enterKeyHint="search"
          placeholder={`Find a word, an exercise, a date…`}
          aria-label={`Find anything on ${kid}'s workspace`}
          style={{
            width: "100%", padding: "11px 34px 11px 34px", borderRadius: 10, border: "none",
            background: "var(--ios-fill)", color: "var(--ios-label)", fontSize: 16,
            boxSizing: "border-box",
          }}
        />
        <span
          aria-hidden
          style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--ios-label-3)", fontSize: 15, pointerEvents: "none" }}
        >
          ⌕
        </span>
        {query !== "" && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => setQuery("")}
            style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--ios-label-3)", fontSize: 17, cursor: "pointer", padding: "4px 8px" }}
          >
            ✕
          </button>
        )}
      </div>

      {isGuardian && terms.length === 0 && (
        <div style={{ margin: "10px var(--ios-gutter) 0" }}>
          <Cell
            href={kidHref}
            lead={<IconBadge color="var(--ios-orange)"><Icons.SparkleIcon /></IconBadge>}
            title={`${kid}'s screen`}
            subtitle={`${openTasks.length} task${openTasks.length === 1 ? "" : "s"} waiting · ${L?.stars.week ?? 0} stars this week`}
          />
        </div>
      )}

      {terms.length > 0 && (
        <>
          <p className="ios-group-footer ios-footnote" style={{ marginTop: 8 }}>
            {resultCount === 0
              ? `Nothing matches “${query.trim()}”.`
              : `${resultCount} match${resultCount === 1 ? "" : "es"} for “${query.trim()}”.`}
          </p>
          {results.map(({ sec, hits }) => (
            <Group key={sec.id} header={`${sec.title} · ${hits.length}`}>
              {hits.map((h) => (
                <Cell
                  key={h.key}
                  href={h.href}
                  onClick={h.href ? undefined : () => reveal(sec.id)}
                  title={h.title}
                  subtitle={h.sub}
                />
              ))}
            </Group>
          ))}
        </>
      )}

      {/* ── Pin, and arrange ───────────────────────────────────────────── */}
      {/* The pin is this parent's alone: it puts the child's week on their own
          Today and does nothing to anyone else's. */}
      <div style={{ display: terms.length > 0 ? "none" : "flex", alignItems: "center", justifyContent: "space-between", gap: 16, margin: "12px var(--ios-gutter) 0" }}>
        {isGuardian ? (
          <button
            type="button"
            className="ios-btn--plain"
            onClick={() => {
              const next = !pinned;
              setPinned(next);
              start(async () => {
                const r = await setPinnedChild(data.childId, next);
                if (r.error) { setPinned(!next); say(`Couldn't ${next ? "pin" : "unpin"}: ${r.error}`); return; }
                say(next ? `${kid}'s week is on your Today screen.` : `Removed ${kid} from your Today screen.`);
              });
            }}
            style={{ color: pinned ? "var(--ios-tint)" : "var(--ios-label-3)", fontWeight: pinned ? 700 : 500, fontSize: 14, display: "flex", alignItems: "center", gap: 5 }}
          >
            <span aria-hidden>{pinned ? "📌" : "📍"}</span>
            {pinned ? "On your Today" : "Pin to Today"}
          </button>
        ) : <span />}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {arranging && customised && (
          <button type="button" className="ios-btn--plain" onClick={reset} style={{ color: "var(--ios-label-2)", fontSize: 14 }}>
            Reset order
          </button>
        )}
        <button
          type="button"
          className="ios-btn--plain"
          onClick={() => setArranging((v) => !v)}
          style={{ color: arranging ? "var(--ios-tint)" : "var(--ios-label-3)", fontWeight: arranging ? 700 : 500, fontSize: 14 }}
        >
          {arranging ? "Done" : "Arrange"}
        </button>
        </div>
      </div>

      {arranging && (
        <p className="ios-group-footer ios-footnote" style={{ marginTop: 4 }}>
          Move a section with the arrows, or tap its name to fold it away. This is kept on this device only, so each of you can keep the arrangement you want.
        </p>
      )}

      {/* ── The sections, in this device's order ────────────────────────── */}
      {terms.length === 0 && ordered.map((sec, i) => (
        <Fold
          key={sec.id}
          id={sec.id}
          storageKey={`ch-fold-${sec.id}-${data.childId}`}
          title={sec.title}
          count={sec.count}
          summary={sec.summary}
          accessory={sec.accessory}
          defaultOpen={sec.defaultOpen}
          arrange={arranging ? {
            up: i === 0 ? null : () => move(sec.id, -1),
            down: i === ordered.length - 1 ? null : () => move(sec.id, 1),
          } : undefined}
        >
          {sec.body}
        </Fold>
      ))}

      {viewer && (
        <div role="dialog" aria-label={viewer.title} onClick={() => setViewer(null)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.92)", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ position: "sticky", top: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "max(12px, env(safe-area-inset-top)) 16px 12px", background: "rgba(0,0,0,0.7)", color: "#fff", backdropFilter: "blur(10px)" }}>
            <span style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{viewer.title} · {viewer.urls.length} page{viewer.urls.length === 1 ? "" : "s"}</span>
            <button type="button" onClick={() => setViewer(null)} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 999, padding: "8px 14px", fontWeight: 700 }}>Close</button>
          </div>
          <div onClick={(e) => e.stopPropagation()} style={{ display: "grid", gap: 12, padding: "12px 12px 40px", maxWidth: 820, margin: "0 auto" }}>
            {viewer.urls.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URLs; next/image cannot proxy them
              <img key={i} src={u} alt={`${viewer.title}, page ${i + 1}`} style={{ width: "100%", height: "auto", borderRadius: 8, background: "#fff" }} />
            ))}
          </div>
        </div>
      )}
      {pending && <span className="ios-caption" style={{ position: "fixed", bottom: 90, right: 16, color: "var(--ios-label-3)" }}>Saving…</span>}
    </>
  );
}
