import type { MuscleGroup } from '../../_components/Body';
import type { Exercise } from '../exercise-library';

export type { MuscleGroup };
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface LibraryExercise {
  name: string;
  sets: number;
  reps: number;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
}

export interface PlannedExercise extends LibraryExercise {
  _score: number;
}

// Exercise library keyed by muscle group — ported verbatim from builder.jsx
const LIB: Partial<Record<MuscleGroup, LibraryExercise[]>> = {
  chest: [
    { name: 'Barbell Bench Press', sets: 4, reps: 6,  primary: ['chest'],              secondary: ['triceps', 'shoulders'] },
    { name: 'Incline DB Press',    sets: 3, reps: 10, primary: ['chest'],              secondary: ['shoulders'] },
    { name: 'Cable Fly',           sets: 3, reps: 12, primary: ['chest'],              secondary: [] },
  ],
  back: [
    { name: 'Barbell Row',         sets: 4, reps: 8,  primary: ['back', 'lats'],      secondary: ['biceps'] },
    { name: 'Back Extension',      sets: 3, reps: 12, primary: ['back'],              secondary: ['glutes', 'hamstrings'] },
  ],
  lats: [
    { name: 'Pull-ups',            sets: 4, reps: 8,  primary: ['lats'],              secondary: ['biceps'] },
    { name: 'Lat Pulldown',        sets: 3, reps: 10, primary: ['lats'],              secondary: ['biceps'] },
    { name: 'Single-arm DB Row',   sets: 3, reps: 10, primary: ['lats', 'back'],      secondary: ['biceps'] },
  ],
  shoulders: [
    { name: 'Overhead Press',      sets: 4, reps: 6,  primary: ['shoulders'],         secondary: ['triceps'] },
    { name: 'Lateral Raise',       sets: 3, reps: 12, primary: ['shoulders'],         secondary: [] },
    { name: 'Face Pull',           sets: 3, reps: 15, primary: ['shoulders'],         secondary: ['back'] },
  ],
  biceps: [
    { name: 'Barbell Curl',        sets: 3, reps: 10, primary: ['biceps'],            secondary: ['forearms'] },
    { name: 'Hammer Curl',         sets: 3, reps: 10, primary: ['biceps', 'forearms'], secondary: [] },
  ],
  triceps: [
    { name: 'Tricep Pushdown',     sets: 3, reps: 12, primary: ['triceps'],           secondary: [] },
    { name: 'Skull Crusher',       sets: 3, reps: 10, primary: ['triceps'],           secondary: [] },
  ],
  forearms: [
    { name: 'Wrist Curl',          sets: 3, reps: 15, primary: ['forearms'],          secondary: [] },
    { name: 'Farmer Carry',        sets: 3, reps: 30, primary: ['forearms'],          secondary: ['traps', 'abs'] },
  ],
  traps: [
    { name: 'Barbell Shrug',       sets: 3, reps: 12, primary: ['traps'],             secondary: ['forearms'] },
  ],
  abs: [
    { name: 'Hanging Leg Raise',   sets: 3, reps: 12, primary: ['abs'],              secondary: ['obliques'] },
    { name: 'Cable Crunch',        sets: 3, reps: 15, primary: ['abs'],              secondary: [] },
    { name: 'Plank',               sets: 3, reps: 60, primary: ['abs'],              secondary: ['obliques'] },
  ],
  obliques: [
    { name: 'Russian Twist',       sets: 3, reps: 20, primary: ['obliques'],         secondary: ['abs'] },
    { name: 'Side Plank',          sets: 3, reps: 45, primary: ['obliques'],         secondary: ['abs'] },
  ],
  quads: [
    { name: 'Back Squat',          sets: 4, reps: 6,  primary: ['quads', 'glutes'],  secondary: ['hamstrings', 'abs'] },
    { name: 'Leg Press',           sets: 3, reps: 10, primary: ['quads'],            secondary: ['glutes'] },
    { name: 'Bulgarian Split',     sets: 3, reps: 10, primary: ['quads', 'glutes'],  secondary: ['hamstrings'] },
  ],
  hamstrings: [
    { name: 'Romanian Deadlift',   sets: 4, reps: 8,  primary: ['hamstrings', 'glutes'], secondary: ['back'] },
    { name: 'Lying Leg Curl',      sets: 3, reps: 12, primary: ['hamstrings'],           secondary: [] },
  ],
  glutes: [
    { name: 'Hip Thrust',          sets: 4, reps: 8,  primary: ['glutes'],                  secondary: ['hamstrings'] },
    { name: 'Walking Lunge',       sets: 3, reps: 12, primary: ['glutes', 'quads'],          secondary: ['hamstrings'] },
  ],
  calves: [
    { name: 'Standing Calf Raise', sets: 3, reps: 15, primary: ['calves'], secondary: [] },
    { name: 'Seated Calf Raise',   sets: 3, reps: 15, primary: ['calves'], secondary: [] },
  ],
};

// Score every candidate: # selected primary + 0.5 × # selected secondary.
// Dedupe by name, greedily cover all selected groups, cap at 6 exercises.
export function buildPlan(selected: MuscleGroup[]): PlannedExercise[] {
  if (!selected.length) return [];
  const sel = new Set(selected);

  const scored: PlannedExercise[] = [];
  for (const [group, list] of Object.entries(LIB) as [MuscleGroup, LibraryExercise[]][]) {
    if (!sel.has(group)) continue;
    for (const ex of list) {
      const score =
        ex.primary.filter((m) => sel.has(m)).length +
        0.5 * ex.secondary.filter((m) => sel.has(m)).length;
      scored.push({ ...ex, _score: score });
    }
  }

  const byName = new Map<string, PlannedExercise>();
  for (const ex of scored) {
    const existing = byName.get(ex.name);
    if (!existing || existing._score < ex._score) byName.set(ex.name, ex);
  }

  const sorted = [...byName.values()].sort((a, b) => b._score - a._score);
  const plan: PlannedExercise[] = [];
  const covered = new Set<MuscleGroup>();

  for (const ex of sorted) {
    const newCoverage = ex.primary.filter((m) => sel.has(m) && !covered.has(m));
    if (newCoverage.length || plan.length < 5) {
      plan.push(ex);
      ex.primary.forEach((m) => sel.has(m) && covered.add(m));
    }
    if (covered.size === sel.size && plan.length >= Math.min(4, sel.size + 1)) break;
    if (plan.length >= 6) break;
  }

  plan.sort((a, b) => b._score - a._score);
  return plan;
}

export const LEVELS: Record<Difficulty, { sMul: number; rMul: number; label: string; hint: string }> = {
  beginner:     { sMul: 0.75, rMul: 1.10, label: 'Beginner',     hint: 'Lower volume, higher reps' },
  intermediate: { sMul: 1.00, rMul: 1.00, label: 'Intermediate', hint: 'Standard programming' },
  advanced:     { sMul: 1.25, rMul: 0.92, label: 'Advanced',     hint: 'More sets, lower reps' },
};

export function applyLevel(plan: PlannedExercise[], difficulty: Difficulty): PlannedExercise[] {
  const m = LEVELS[difficulty];
  return plan.map((ex) => ({
    ...ex,
    sets: Math.max(2, Math.round(ex.sets * m.sMul)),
    reps: Math.max(3, Math.round(ex.reps * m.rMul)),
  }));
}

// ~2.5 min per set including rest
export function estimateDuration(plan: PlannedExercise[]): number {
  return Math.round(plan.reduce((sum, ex) => sum + ex.sets * 2.5, 0));
}

// Convert a builder plan into the Exercise[] shape WorkoutTracker expects.
// Sets target weight to 0 (first session) and provides empty-but-valid lastSession.
export function toTrackerExercises(
  plan: { name: string; sets: number; reps: number; primary: string[] }[]
): Exercise[] {
  return plan.map((ex) => ({
    name: ex.name,
    target: { sets: ex.sets, reps: ex.reps, weight: 0 },
    lastSession: {
      date: 'First session',
      sets: Array<{ reps: number; weight: number; rpe: number }>(ex.sets).fill(
        { reps: ex.reps, weight: 0, rpe: 7 }
      ),
    },
    restSec: ex.sets >= 4 && ex.reps <= 6 ? 180 : 120,
    cues: [],
    muscles: ex.primary,
  }));
}
