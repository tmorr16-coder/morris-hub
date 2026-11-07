import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function load(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  const exports = {};
  new Function("require", "exports", outputText)((id) => { if (!(id in dependencies)) throw Error(id); return dependencies[id]; }, exports);
  return exports;
}
const recovery = await load("../app/health/workout/_lib/resume.ts");
const sharing = await load("../lib/workout-sharing.ts");
const store = new Map();
globalThis.localStorage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) };
globalThis.window = new EventTarget();
const exercise = { name: "Squat", muscles: ["Quads"], restSec: 90, cues: [], target: { sets: 3, reps: 8, weight: 100 }, lastSession: { date: "", sets: [] } };
const snapshot = () => ({ userId: "reader-1", sessionId: "session-1", exerciseIds: ["exercise-1"], exercises: [exercise], setLogs: [[{ reps: 8, weight: 100, rpe: 7 }, null, null]], cardioBlocks: [], warmup: false, cooldown: false, startedAtMs: 1000, savedAtMs: 2000, currentExIdx: 0, activeSetIdx: 1, inputReps: "9", inputWeight: "105", inputRpe: 8, pausedAtMs: 61000, pausedDurationMs: 10000, pausedRestLeftMs: 30000 });

test("workout recovery retains drafts, set position, pause and rest across reloads and notifies the platform", () => {
  store.clear(); let events = 0; const listener = () => events++;
  window.addEventListener(recovery.WORKOUT_UPDATED, listener);
  const saved = snapshot();
  assert.equal(recovery.writeSnapshot(saved), true);
  assert.deepEqual(recovery.readSnapshot("reader-1"), saved);
  assert.equal(recovery.readSnapshot("another-reader"), null);
  assert.equal(events, 1);
  recovery.clearSnapshot(); assert.equal(recovery.readSnapshot(), null); assert.equal(events, 2);
  window.removeEventListener(recovery.WORKOUT_UPDATED, listener);
});

test("a paused workout excludes both previous and current pause time", () => {
  assert.equal(recovery.workoutElapsed(snapshot(), 999999), 50);
  assert.equal(recovery.workoutElapsed({ startedAtMs: 1000, pausedDurationMs: 30000 }, 91000), 60);
});

test("legacy sessions are adopted only after ownership validation and cannot resurrect after being cleared", async () => {
  const legacy = snapshot(); delete legacy.userId;
  recovery.writeSnapshot(legacy);
  assert.equal(await recovery.restoreSnapshot("reader-2", async () => false), null);
  const migrated = await recovery.restoreSnapshot("reader-1", async () => true);
  assert.equal(migrated.userId, "reader-1");
  recovery.writeSnapshot(legacy);
  assert.equal(await recovery.restoreSnapshot("reader-1", async () => { recovery.clearSnapshot(); return true; }), null);
});

test("corrupt and malformed snapshots do not crash restoration", () => {
  for (const value of ["not json", JSON.stringify({ ...snapshot(), exercises: [] }), JSON.stringify({ ...snapshot(), currentExIdx: 200 }), JSON.stringify({ ...snapshot(), setLogs: ["invalid"] })]) {
    store.set(recovery.RESUME_KEY, value); assert.equal(recovery.readSnapshot(), null);
  }
});

test("shared workout links contain only the approved summary, never account/session or health data", () => {
  const summary = { title: "Strength workout", minutes: 35, exercises: 4, sets: 12, reps: 96, volume: 12000, caption: "Let’s move together!", userId: "private-user", sessionId: "private-session", bodyWeight: 180 };
  const url = new URL(sharing.workoutShareUrl(summary, "https://morrisai.family/health/workout?plan=private-plan"));
  assert.equal(url.pathname, "/workouts/share");
  const payload = sharing.parseWorkoutShare(url.searchParams.get("s"));
  assert.equal(payload.sets, 12); assert.equal(payload.caption, summary.caption);
  for (const hidden of ["private-user", "private-session", "bodyWeight", "private-plan"]) assert.ok(!url.toString().includes(hidden));
  const fb = new URL(sharing.facebookShareUrl(url.toString()));
  assert.equal(fb.hostname, "www.facebook.com"); assert.equal(fb.searchParams.get("u"), url.toString());
  assert.equal(fb.searchParams.has("quote"), false); assert.equal(fb.searchParams.has("message"), false);
});

test("invalid share data is rejected and volume can be omitted", () => {
  assert.equal(sharing.parseWorkoutShare("bad json"), null);
  assert.equal(sharing.parseWorkoutShare(JSON.stringify({ title: "Test", minutes: -1, exercises: 1, sets: 1, reps: 1, caption: "" })), null);
  const summary = sharing.parseWorkoutShare(JSON.stringify({ title: "Test", minutes: 10, exercises: 1, sets: 1, reps: 8, caption: "" }));
  assert.ok(!("volume" in summary)); assert.doesNotMatch(sharing.workoutShareDescription(summary), /volume/);
});

async function actions({ failInsert = false } = {}) {
  const rows = { exercises: [{ id: "exercise-1", session_id: "session-1", user_id: "reader-1" }], sets: [], workout_sessions: [{ id: "session-1", user_id: "reader-1", duration_min: null }] };
  const db = { from(table) {
    const filters = []; let patch, insert;
    const execute = () => {
      const matches = rows[table].filter((r) => filters.every(([k, v]) => Array.isArray(v) ? v.includes(r[k]) : r[k] === v));
      if (insert) {
        if (failInsert) return { data: null, error: { message: "offline" } };
        rows[table].push({ id: `row-${rows[table].length}`, ...insert });
      }
      if (patch) matches.forEach((r) => Object.assign(r, patch));
      return { data: matches, error: null };
    };
    const q = { select: () => q, eq: (k, v) => { filters.push([k, v]); return q; }, in: (k, v) => { filters.push([k, v]); return q; }, is: (k, v) => { filters.push([k, v]); return q; }, update: (p) => { patch = p; return q; }, insert: (p) => { insert = p; return q; }, maybeSingle: async () => { const r = execute(); return { ...r, data: r.data?.[0] ?? null }; }, then: (resolve, reject) => Promise.resolve(execute()).then(resolve, reject) };
    return q;
  } };
  const api = await load("../app/health/workout/actions.ts", { "@/lib/supabase/admin": { createAdminClient: () => db }, "@/lib/health/auth": { getCurrentUserId: async () => "reader-1" }, "next/cache": { revalidatePath() {} }, "./exercise-library": { EXERCISE_LIBRARY: [] } });
  return { api, rows };
}

test("final save reconciles offline sets without duplicating them when retried", async () => {
  const { api, rows } = await actions();
  const log = { exerciseId: "exercise-1", setNumber: 1, reps: 8, weight: 100, rpe: 7 };
  assert.deepEqual(await api.syncWorkoutSets("session-1", [log]), {});
  assert.deepEqual(await api.syncWorkoutSets("session-1", [{ ...log, reps: 9 }]), {});
  assert.equal(rows.sets.length, 1); assert.equal(rows.sets[0].reps_actual, 9);
  assert.ok((await api.syncWorkoutSets("other-session", [log])).error);
});

test("failed set sync and missing sessions return errors instead of reporting a completed workout", async () => {
  const { api } = await actions({ failInsert: true });
  assert.ok((await api.syncWorkoutSets("session-1", [{ exerciseId: "exercise-1", setNumber: 1, reps: 8, weight: 100, rpe: 7 }])).error);
  assert.ok((await api.finishSession("someone-else", 30)).error);
  assert.equal(await api.ownsActiveWorkout("someone-else"), false);
});
