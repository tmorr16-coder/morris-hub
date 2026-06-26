export interface SetLog {
  reps: number;
  weight: number;
  rpe: number;
}

export interface LastSession {
  date: string;
  sets: SetLog[];
}

export interface Exercise {
  name: string;
  target: { sets: number; reps: number; weight: number };
  lastSession: LastSession;
  restSec: number;
  cues: string[];
  muscles: string[];
}

export interface ProgressionSuggestion {
  reps: number;
  weight: number;
  hint: string | null;
}

export const EXERCISE_LIBRARY: Exercise[] = [
  {
    name: "Back Squat",
    target: { sets: 4, reps: 6, weight: 185 },
    lastSession: {
      date: "Apr 18",
      sets: [
        { reps: 6, weight: 175, rpe: 7 },
        { reps: 6, weight: 175, rpe: 7 },
        { reps: 6, weight: 180, rpe: 8 },
        { reps: 5, weight: 180, rpe: 9 },
      ],
    },
    restSec: 180,
    cues: ["Brace core before unrack", "Knees track over toes", "Drive through heels"],
    muscles: ["Quads", "Glutes", "Hamstrings", "Core"],
  },
  {
    name: "Romanian Deadlift",
    target: { sets: 4, reps: 8, weight: 165 },
    lastSession: {
      date: "Apr 18",
      sets: [
        { reps: 8, weight: 155, rpe: 7 },
        { reps: 8, weight: 160, rpe: 8 },
        { reps: 8, weight: 160, rpe: 8 },
        { reps: 7, weight: 165, rpe: 9 },
      ],
    },
    restSec: 150,
    cues: ["Hinge at hips", "Bar stays close to legs", "Feel hamstring stretch"],
    muscles: ["Hamstrings", "Glutes", "Lower back"],
  },
  {
    name: "Walking Lunges",
    target: { sets: 3, reps: 10, weight: 35 },
    lastSession: {
      date: "Apr 18",
      sets: [
        { reps: 10, weight: 30, rpe: 7 },
        { reps: 10, weight: 30, rpe: 7 },
        { reps: 10, weight: 35, rpe: 8 },
      ],
    },
    restSec: 120,
    cues: ["Step long, knee 90°", "Torso upright", "Drive off front heel"],
    muscles: ["Quads", "Glutes"],
  },
  {
    name: "Calf Raises",
    target: { sets: 3, reps: 15, weight: 90 },
    lastSession: {
      date: "Apr 18",
      sets: [
        { reps: 15, weight: 85, rpe: 7 },
        { reps: 15, weight: 85, rpe: 8 },
        { reps: 15, weight: 90, rpe: 8 },
      ],
    },
    restSec: 90,
    cues: ["Full range of motion", "Pause at top", "Slow eccentric"],
    muscles: ["Calves"],
  },
];

export function suggestNext(
  lastSession: LastSession,
  target: { sets: number; reps: number; weight: number }
): ProgressionSuggestion {
  const last = lastSession.sets;
  const allHitTarget = last.every((s) => s.reps >= target.reps && s.rpe <= 8);
  if (allHitTarget) {
    return {
      reps: target.reps,
      weight: last[last.length - 1].weight + 5,
      hint: "↑ All sets crushed at RPE ≤8 — bump weight 5 lbs",
    };
  }
  const someHigh = last.some((s) => s.rpe >= 9);
  if (someHigh) {
    return {
      reps: target.reps,
      weight: last[last.length - 1].weight,
      hint: "→ Hold weight — last session hit RPE 9",
    };
  }
  return {
    reps: target.reps,
    weight: last[last.length - 1].weight + 2.5,
    hint: "↑ Small bump — moderate effort last time",
  };
}
