import type { Exercise, SetLog } from "../exercise-library";
import type { CardioBlock } from "../actions";

// Stable localStorage key for the single in-progress workout on this device.
// Account-scoped recovery on this device. It survives navigation and app closure.
export const RESUME_KEY = "morris:activeWorkout";
export const WORKOUT_UPDATED = "morris:workout-updated";

export interface WorkoutSnapshot {
  userId?: string;
  title?: string;
  sessionId: string;
  exerciseIds: string[];
  exercises: Exercise[];
  setLogs: (SetLog | null)[][];
  cardioBlocks: CardioBlock[];
  warmup: boolean;
  cooldown: boolean;
  startedAtMs: number;   // real start timestamp — elapsed survives an app close
  currentExIdx: number;
  activeSetIdx: number;
  /** Wall-clock end of an in-progress rest, so it keeps running if you leave. */
  restEndsAtMs?: number | null;
  restTotal?: number;
  /** "circuit" rotates through the exercises each round instead of finishing one at a time. */
  mode?: "straight" | "circuit";
  savedAtMs: number;
  pausedAtMs?: number | null;
  pausedDurationMs?: number;
  pausedRestLeftMs?: number | null;
  inputReps?: string;
  inputWeight?: string;
  inputRpe?: number;
  stationRestSec?: number;
  roundRestSec?: number;
  showSummary?: boolean;
  finalElapsed?: number;
  extrasSaved?: boolean;
}

// Read + validate the snapshot. Returns null if absent, corrupt, or malformed.
// Safe to call only in effects/handlers (touches localStorage).
export function readSnapshot(userId?: string): WorkoutSnapshot | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      p &&
      typeof p.sessionId === "string" && p.sessionId &&
      Array.isArray(p.exerciseIds) &&
      Array.isArray(p.exercises) && p.exercises.length > 0 &&
      p.exerciseIds.length === p.exercises.length &&
      p.exercises.every((ex: Exercise) => ex && typeof ex.name === "string" && ex.target && Number.isInteger(ex.target.sets) && ex.target.sets > 0 && Array.isArray(ex.lastSession?.sets)) &&
      Array.isArray(p.setLogs) && p.setLogs.length === p.exercises.length &&
      p.setLogs.every((row: unknown) => Array.isArray(row) && row.every((log) => log === null ||
        (log && Number.isFinite(log.reps) && Number.isFinite(log.weight) && Number.isFinite(log.rpe)))) &&
      typeof p.startedAtMs === "number" && Number.isFinite(p.startedAtMs) &&
      (p.pausedAtMs == null || Number.isFinite(p.pausedAtMs)) &&
      (p.pausedDurationMs == null || (Number.isFinite(p.pausedDurationMs) && p.pausedDurationMs >= 0)) &&
      Number.isInteger(p.currentExIdx ?? 0) && (p.currentExIdx ?? 0) >= 0 && (p.currentExIdx ?? 0) < p.exercises.length &&
      Number.isInteger(p.activeSetIdx ?? 0) && (p.activeSetIdx ?? 0) >= 0 && (p.activeSetIdx ?? 0) < p.exercises[p.currentExIdx ?? 0].target.sets &&
      (!userId || p.userId === userId)
    ) {
      return p as WorkoutSnapshot;
    }
  } catch {
    // corrupt JSON or SSR — fall through
  }
  return null;
}

export function writeSnapshot(snapshot: WorkoutSnapshot): boolean {
  try {
    const { userId: _userId, ...persisted } = snapshot;
    localStorage.setItem(RESUME_KEY, JSON.stringify(persisted));
    window.dispatchEvent(new Event(WORKOUT_UPDATED));
    return true;
  } catch { return false; }
}

/** Older device snapshots are adopted only after checking session ownership. */
export async function restoreSnapshot(userId: string, ownsSession: (id: string) => Promise<boolean>): Promise<WorkoutSnapshot | null> {
  const snap = readSnapshot();
  if (!snap || (snap.userId && snap.userId !== userId)) return null;
  if (snap.userId) return snap;
  if (!(await ownsSession(snap.sessionId))) return null;
  // Another tab may have replaced or finished this session during the request.
  const current = readSnapshot();
  if (!current || current.sessionId !== snap.sessionId || current.userId) return readSnapshot(userId);
  const migrated = { ...snap, userId };
  writeSnapshot(migrated);
  return migrated;
}

export function workoutElapsed(snapshot: Pick<WorkoutSnapshot, "startedAtMs" | "pausedAtMs" | "pausedDurationMs">, now = Date.now()): number {
  return Math.max(0, Math.floor(((snapshot.pausedAtMs ?? now) - snapshot.startedAtMs - (snapshot.pausedDurationMs ?? 0)) / 1000));
}

export function clearSnapshot() {
  try {
    localStorage.removeItem(RESUME_KEY);
    window.dispatchEvent(new Event(WORKOUT_UPDATED));
  } catch {
    // ignore
  }
}
