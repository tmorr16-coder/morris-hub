"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

// A first grader's workspace, for the parents who run it.
//
// The school's week comes home on paper; this is where it lives once it has
// been photographed. The screen answers, in order: what is this week about,
// what is coming up, what should we practise tonight and why, how is it
// going, and what did the school send. The child's routine and health notes
// stay underneath, as before.
//
// Every tap here can be taken back: a word tapped by mistake, a "Did it",
// a dismissed exercise, a whole scanned document with everything it created.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LargeTitle, Group, Cell, IconBadge, Icons, Chip, GlanceGrid, GlanceTile, Sparkline } from "@/components/ios";
import type { ChildWorkspaceData, ChildActivity, ChildHealthNote } from "../_lib/children";
import type { Exercise, SchoolDate, ChildTask } from "../_lib/learning";
import {
  logPractice, unlogPractice, setExerciseStatus, markWordPracticed, childDocumentUrls,
  deleteChildDocument, documentImpact, assignTask, deleteTask, reopenTask, rebuildFromDocument, resetWeekPractice,
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
  const [notice, setNotice] = useState<{ text: string; undo?: () => void } | null>(null);
  const [viewer, setViewer] = useState<{ title: string; urls: string[] } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, start] = useTransition();
  const db = createClient() as any;
  const L = data.learning;
  const week = L?.spellingWeek ?? null;
  const kid = firstName(data.name);

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  function say(text: string, undo?: () => void, ms = 8000) {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ text, undo });
    noticeTimer.current = setTimeout(() => setNotice(null), ms);
  }

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
  const doneTasks = tasks.filter((t) => t.completedAt);

  const trends = trendsBySubject(L?.assessments ?? []);
  const watch = trends[0] ?? null;
  const wordsPracticed = week ? week.words.filter((w) => (practiced[w] ?? 0) > 0).length : 0;
  const newsletter = L?.latestNewsletter;
  const nx = newsletter?.extracted;
  const isGuardian = data.viewerIsGuardian;

  return (
    <>
      <LargeTitle
        title={data.name}
        subtitle={[L?.gradeLabel, data.age != null ? `Age ${data.age}` : null, week?.weekStart ? `Week of ${fmtDate(week.weekStart, false)}` : null].filter(Boolean).join(" · ") || "Student Success"}
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

      {/* ── The big actions, first ─────────────────────────────────────── */}
      {isGuardian && (
        <Group footer="Photograph what came home as it comes out of the folder. Hand the phone over and the other screen is built for a six-year-old.">
          <Cell href={`/children/${data.childId}/import`} lead={<IconBadge color="var(--ios-tint)"><Icons.ComposeIcon /></IconBadge>} title="Add what came home" subtitle="Camera or photos · read and turned into a plan" />
          <Cell href={`/children/${data.childId}/kid`} lead={<IconBadge color="var(--ios-orange)"><Icons.SparkleIcon /></IconBadge>} title={`${kid}'s screen`} subtitle={`${openTasks.length} task${openTasks.length === 1 ? "" : "s"} waiting · ${L?.stars.week ?? 0} stars this week · tutor built in`} />
        </Group>
      )}

      {/* ── Glance ─────────────────────────────────────────────────────── */}
      {L && (L.spellingWeek || L.assessments.length > 0 || L.exercises.length > 0) && (
        <GlanceGrid>
          <GlanceTile href={`/children/${data.childId}#spelling`} label="Spelling test" icon={<Icons.CalendarIcon />} value={week?.testOn ? soon(week.testOn) : "—"} sub={week?.pattern ?? undefined} accent="var(--ios-tint)" />
          <GlanceTile href={`/children/${data.childId}#spelling`} label="Words practised" icon={<Icons.ChecklistIcon />} value={week ? `${wordsPracticed}/${week.words.length}` : "—"} sub={week ? "tap a word below" : undefined} accent="var(--ios-green)" />
          <GlanceTile href={`/children/${data.childId}#practice`} label="Practice days" icon={<Icons.SparkleIcon />} value={`${L.practiceDaysThisWeek}/7`} sub="this week" accent="var(--ios-orange)" />
          <GlanceTile href={`/children/${data.childId}#progress`} label={watch ? "Watch" : "Scores"} icon={<Icons.ChartIcon />} value={watch ? `${watch.label} ${watch.latest}%` : "—"} sub={watch ? `${arrow(watch.delta).glyph ? `${arrow(watch.delta).glyph} ${Math.abs(watch.delta ?? 0)} pts · ` : ""}${trends.length} subject${trends.length === 1 ? "" : "s"} tracked` : "no graded work yet"} accent={watch ? pctColor(watch.latest) : "#B565A7"} />
        </GlanceGrid>
      )}

      {/* ── Coming up ──────────────────────────────────────────────────── */}
      {L && L.upcomingDates.length > 0 && (
        <Group header="Coming up">
          {L.upcomingDates.map((d, i) => (
            <Cell key={i} chevron={false} lead={<IconBadge color={d.kind === "no_school" || d.kind === "early_dismissal" ? "var(--ios-orange)" : "var(--ios-tint)"}><Icons.CalendarIcon /></IconBadge>} title={d.title} subtitle={`${fmtDate(d.date)}${DATE_KIND_LABEL[d.kind] ? ` · ${DATE_KIND_LABEL[d.kind]}` : ""}${d.note ? ` · ${d.note}` : ""}`} trailing={<span className="ios-caption" style={{ color: daysUntil(d.date) <= 1 ? "var(--ios-orange)" : "var(--ios-label-3)" }}>{soon(d.date)}</span>} />
          ))}
        </Group>
      )}

      {/* ── This week's spelling ───────────────────────────────────────── */}
      <div id="spelling" />
      {week && (
        <Group header="Spelling this week" footer="Tap a word each time you practise it together. Sight words are in colour.">
          {week.pattern && <Cell chevron={false} title={week.pattern} subtitle={week.testOn ? `Test ${fmtDate(week.testOn)}` : undefined} />}
          <div style={{ padding: "10px 16px 6px", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {week.words.map((w) => {
              const n = practiced[w] ?? 0;
              return <Chip key={w} small selected={n > 0} onClick={() => tapWord(w)}>{w}{n > 1 ? ` ×${n}` : ""}</Chip>;
            })}
            {week.sightWords.map((w) => <Chip key={`s-${w}`} small selected onClick={() => tapWord(w)}>{w}{(practiced[w] ?? 0) > 1 ? ` ×${practiced[w]}` : ""}</Chip>)}
          </div>
          <div style={{ display: "flex", gap: 14, padding: "4px 16px 12px", alignItems: "center" }}>
            {tapStack.length > 0 && <button type="button" className="ios-btn--plain" onClick={undoTap} style={{ color: "var(--ios-label-2)" }}>Undo last tap ({tapStack[tapStack.length - 1]})</button>}
            {isGuardian && <button type="button" className="ios-btn--plain" disabled={sent.has("words")} onClick={sendWords} style={{ color: sent.has("words") ? "var(--ios-green)" : "var(--ios-tint)", fontWeight: 600 }}>{sent.has("words") ? `Sent to ${kid}` : `Send the words to ${kid}'s screen`}</button>}
          </div>
        </Group>
      )}

      {/* ── Practice plan ──────────────────────────────────────────────── */}
      <div id="practice" />
      {L && (
        <Group header="Practice tonight" footer={exercises.length === 0 ? "Nothing planned yet. Photograph a graded paper or the newsletter and the plan is proposed from the teacher's marks." : "Each one traces to something the teacher wrote or the paper showed. Tap for the steps; tap Done again to take it back."}>
          {isGuardian && exercises.length > 0 && (
            <div style={{ padding: "8px 16px 0", textAlign: "right" }}>
              <button type="button" className="ios-btn--plain" onClick={resetPractice} style={{ color: "var(--ios-label-3)", fontSize: 13 }}>Reset this week&rsquo;s practice</button>
            </div>
          )}
          {exercises.map((ex) => {
            const open = openExercise === ex.id;
            return (
              <div key={ex.id}>
                <Cell
                  chevron={false}
                  onClick={() => setOpenExercise(open ? null : ex.id)}
                  lead={<IconBadge color={ex.doneToday ? "var(--ios-green)" : "var(--ios-orange)"}>{ex.doneToday ? <Icons.ChecklistIcon /> : <Icons.SparkleIcon />}</IconBadge>}
                  title={ex.title}
                  subtitle={<><span>{ex.rationale}</span><span style={{ display: "block", color: "var(--ios-label-3)" }}>{ex.minutes ? `${ex.minutes} min · ` : ""}{FREQ_LABEL[ex.frequency]}{ex.streak > 0 ? ` · ${ex.streak}-day streak` : ""}</span></>}
                  trailing={
                    <button type="button" className="ios-btn--plain" disabled={pending} onClick={(e) => { e.stopPropagation(); toggleDone(ex); }} style={{ color: ex.doneToday ? "var(--ios-green)" : "var(--ios-tint)", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {ex.doneToday ? "Done ✓" : "Did it"}
                    </button>
                  }
                />
                {open && (
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
        </Group>
      )}

      {/* ── Tasks on the child's screen ───────────────────────────────── */}
      {isGuardian && L && (
        <Group header={`On ${kid}'s screen`} footer={`${kid} completes these on the other screen and earns stars. ${L.stars.total} stars so far.`}>
          {openTasks.map((t) => (
            <Cell key={t.id} chevron={false} lead={<span style={{ fontSize: 22, width: 30, textAlign: "center" }}>{TASK_EMOJI[t.kind]}</span>} title={t.title} subtitle={`Sent ${fmtDate(t.assignedOn, false)}${t.kind === "spelling" && t.payload.words ? ` · ${t.payload.words.length} words` : ""}`}
              trailing={<button type="button" className="ios-btn--plain" onClick={() => removeTask(t)} style={{ color: "var(--ios-label-3)" }}>Remove</button>} />
          ))}
          {doneTasks.map((t) => (
            <Cell key={t.id} chevron={false} lead={<span style={{ fontSize: 22, width: 30, textAlign: "center" }}>{TASK_EMOJI[t.kind]}</span>} title={<span style={{ color: "var(--ios-label-2)" }}>{t.title}</span>} subtitle={`Done today · ${"⭐".repeat(Math.max(1, t.stars))}${t.childNote ? ` · “${t.childNote}”` : ""}`}
              trailing={<button type="button" className="ios-btn--plain" onClick={() => reopen(t)} style={{ color: "var(--ios-label-3)" }}>Undo</button>} />
          ))}
          <div style={{ display: "flex", gap: 8, padding: "10px 16px 12px" }}>
            <input value={customTask} onChange={(e) => setCustomTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendCustom(); }} placeholder={`Send ${kid} a task, e.g. “Read one page of Farmer Boy to Mom”`} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "none", background: "var(--ios-fill)", color: "var(--ios-label)", fontSize: 15 }} />
            <button type="button" className="ios-btn ios-btn--primary" disabled={!customTask.trim() || pending} onClick={sendCustom}>Send</button>
          </div>
        </Group>
      )}

      {/* ── Buddy, for the parents ─────────────────────────────────────── */}
      {isGuardian && L && (
        <Group header={`What ${kid} asked Buddy`} footer={L.tutorRecent.length === 0 ? "Nothing yet. Everything Buddy and the child say to each other is kept here for you." : "The latest exchanges. Every conversation is kept."}>
          {[...L.tutorRecent].reverse().slice(-6).map((m) => (
            <Cell key={m.id} chevron={false} lead={<span style={{ fontSize: 20, width: 30, textAlign: "center" }}>{m.role === "assistant" ? "🦉" : "🧒"}</span>} title={<span style={{ fontWeight: 400, color: m.role === "assistant" ? "var(--ios-label-2)" : "var(--ios-label)" }}>{m.content.replace(/\[\[([^\]]+)\]\]/g, "$1")}</span>} subtitle={new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} />
          ))}
          <Cell href={`/children/${data.childId}/buddy`} lead={<IconBadge color="var(--ios-orange)"><Icons.SparkleIcon /></IconBadge>} title="All conversations" subtitle="By day and sitting" />
        </Group>
      )}

      {/* ── This week at school ────────────────────────────────────────── */}
      {nx && ((nx.academics?.length ?? 0) > 0 || nx.read_aloud || nx.memory_verse || nx.recitation || (nx.parent_requests?.length ?? 0) > 0) && (
        <Group header="This week at school" footer={newsletter?.docDate ? `From the newsletter of ${fmtDate(newsletter.docDate, false)}.` : undefined}>
          {(nx.academics ?? []).map((a, i) => <Cell key={i} chevron={false} title={a.subject} subtitle={a.topics.join(" · ")} />)}
          {nx.read_aloud && <Cell chevron={false} lead={<IconBadge color="#5B6B9E"><Icons.BookIcon /></IconBadge>} title="Read aloud" subtitle={nx.read_aloud} />}
          {nx.memory_verse && <Cell chevron={false} lead={<IconBadge color="#8FA3DC"><Icons.HeartIcon /></IconBadge>} title="Memory verse" subtitle={nx.memory_verse} />}
          {nx.recitation && <Cell chevron={false} lead={<IconBadge color="#B565A7"><Icons.SparkleIcon /></IconBadge>} title="Recitation" subtitle={nx.recitation} />}
          {(nx.parent_requests ?? []).map((r, i) => <Cell key={`p-${i}`} chevron={false} lead={<IconBadge color="var(--ios-orange)"><Icons.BellIcon /></IconBadge>} title={r} />)}
        </Group>
      )}

      {/* ── Progress ───────────────────────────────────────────────────── */}
      <div id="progress" />
      {L && L.assessments.length > 0 && (
        <Group header="How it's going" footer="One line per subject across every graded paper, weakest first. The arrow compares the latest paper with the one before it.">
          {trends.map((t) => {
            const ar = arrow(t.delta);
            return (
              <div key={t.subject} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--ios-separator)" }}>
                <IconBadge color={SUBJECT_COLOR[t.subject] ?? SUBJECT_COLOR.other}><Icons.ChartIcon /></IconBadge>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ios-subhead" style={{ fontWeight: 600 }}>{t.label}</div>
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>{t.count === 1 ? "first paper" : `${t.count} papers`}{t.lastOn ? ` · latest ${fmtDate(t.lastOn, false)}` : ""}</div>
                </div>
                {t.series.length > 1 ? <Sparkline points={t.series} color={pctColor(t.latest)} width={72} height={26} /> : <span style={{ width: 72 }} />}
                <div style={{ textAlign: "right", minWidth: 64 }}>
                  <div className="ios-num" style={{ fontWeight: 700, color: pctColor(t.latest) }}>{t.latestText}</div>
                  <div className="ios-caption" style={{ color: ar.color }}>{t.delta == null ? `${t.latest}%` : `${ar.glyph} ${t.delta > 0 ? "+" : ""}${t.delta} pts`}</div>
                </div>
              </div>
            );
          })}
          <div className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "10px 16px 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Each paper</div>
          {L.assessments.map((a) => (
            <Cell
              key={a.id}
              chevron={false}
              lead={<IconBadge color={SUBJECT_COLOR[a.subject] ?? SUBJECT_COLOR.other}><Icons.ChartIcon /></IconBadge>}
              title={a.title}
              subtitle={<>
                {a.assessedOn && <span>{fmtDate(a.assessedOn, false)}</span>}
                {a.teacherFeedback && <span style={{ display: "block" }}>Teacher: “{a.teacherFeedback}”</span>}
                {a.observations.slice(0, 2).map((o, i) => <span key={i} style={{ display: "block", color: "var(--ios-label-3)" }}>{o}</span>)}
              </>}
              trailing={a.score != null && a.outOf ? <span className="ios-num" style={{ fontWeight: 700, color: (a.score / a.outOf) >= 0.9 ? "var(--ios-green)" : (a.score / a.outOf) >= 0.7 ? "var(--ios-orange)" : "var(--ios-red)" }}>{a.score}/{a.outOf}</span> : undefined}
            />
          ))}
        </Group>
      )}

      {/* ── Documents ──────────────────────────────────────────────────── */}
      {L && L.documents.length > 0 && (
        <Group header="From school" footer="Rebuild remakes the plan from the stored read — no camera, no waiting — with every recommended exercise back. Delete removes the document and everything it created.">
          {L.documents.slice(0, 12).map((d) => (
            <Cell
              key={d.id}
              chevron={false}
              onClick={d.filePaths.length > 0 ? () => openDocument(d.id, d.title) : undefined}
              lead={<IconBadge color={d.kind === "graded_work" ? "#B565A7" : "var(--ios-tint)"}><Icons.BookIcon /></IconBadge>}
              title={d.title}
              subtitle={`${d.docDate ? fmtDate(d.docDate, false) : fmtDate(d.createdAt.slice(0, 10), false)}${d.filePaths.length > 0 ? ` · ${d.filePaths.length} page${d.filePaths.length === 1 ? "" : "s"} · tap to view` : " · no pages attached"}`}
              trailing={isGuardian ? (
                <span style={{ display: "inline-flex", gap: 14 }}>
                  <button type="button" className="ios-btn--plain" onClick={(e) => { e.stopPropagation(); rebuildDocument(d.id, d.title, d.kind); }} style={{ color: "var(--ios-tint)" }}>Rebuild</button>
                  <button type="button" className="ios-btn--plain" onClick={(e) => { e.stopPropagation(); removeDocument(d.id, d.title); }} style={{ color: "var(--ios-red)" }}>Delete</button>
                </span>
              ) : undefined}
            />
          ))}
        </Group>
      )}

      {/* ── Routine and health, as before ──────────────────────────────── */}
      <Group header="Routine" footer={today.length === 0 ? "Nothing on the list right now." : undefined}>
        {today.map((a) => {
          const meta = CATEGORY_META[a.category] ?? CATEGORY_META.other;
          return (
            <Cell key={a.id} onClick={() => complete(a.id)} chevron={false} lead={<IconBadge color={meta.color}>{meta.icon}</IconBadge>} title={a.title}
              trailing={<span aria-hidden style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid var(--ios-separator)", flexShrink: 0 }} />} />
          );
        })}
      </Group>
      <div style={{ margin: "12px var(--ios-gutter) 0" }}>
        <AddActivityForm childId={data.childId} viewerUserId={viewerUserId} onAdded={(a) => setActivities((prev) => [...prev, a])} />
      </div>

      {done.length > 0 && (
        <Group header="Achievements">
          {done.map((a) => (
            <Cell key={a.id} chevron={false} lead={<IconBadge color="var(--ios-green)"><Icons.ChecklistIcon /></IconBadge>} title={<span style={{ textDecoration: "line-through", color: "var(--ios-label-2)" }}>{a.title}</span>} />
          ))}
        </Group>
      )}

      <Group header="Health notes for next visit">
        {openNotes.length === 0 ? (
          <Cell chevron={false} title={<span style={{ color: "var(--ios-label-2)" }}>No notes for the next visit.</span>} />
        ) : (
          openNotes.map((h) => (
            <Cell key={h.id} chevron={false} title={h.note} subtitle={h.targetVisitDate ? fmtDate(h.targetVisitDate, false) : undefined}
              trailing={<button type="button" className="ios-btn--plain" onClick={() => resolveNote(h.id)} style={{ fontSize: 15 }}>Resolve</button>} />
          ))
        )}
      </Group>
      <div style={{ margin: "12px var(--ios-gutter) 0" }}>
        <AddHealthNoteForm childId={data.childId} viewerUserId={viewerUserId} onAdded={(h) => setHealthNotes((prev) => [...prev, h])} />
      </div>

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
