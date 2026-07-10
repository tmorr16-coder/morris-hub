import type { Exercise, SetLog } from "../exercise-library";
import type { CardioBlock } from "../actions";

// Stable localStorage key for the single in-progress workout on this device.
// The workout is done on one device, so localStorage surviving an app close is
// the realistic durability requirement (no DB migration is possible).
export const RESUME_KEY = "morris:activeWorkout";

export interface WorkoutSnapshot {
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
  savedAtMs: number;
}

// Read + validate the snapshot. Returns null if absent, corrupt, or malformed.
// Safe to call only in effects/handlers (touches localStorage).
export function readSnapshot(): WorkoutSnapshot | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      p &&
      typeof p.sessionId === "string" && p.sessionId &&
      Array.isArray(p.exerciseIds) &&
      Array.isArray(p.exercises) &&
      Array.isArray(p.setLogs) &&
      typeof p.startedAtMs === "number"
    ) {
      return p as WorkoutSnapshot;
    }
  } catch {
    // corrupt JSON or SSR — fall through
  }
  return null;
}

export function clearSnapshot() {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {
    // ignore
  }
}
