// App-level TypeScript types.
// Database-specific types live in lib/health/types/database.ts (Supabase-generated).

export type WorkoutSet = {
  reps: number;
  weight: number;
  rpe: number;
};

export type Exercise = {
  id: string;
  name: string;
  muscles: string[];
  restSec: number;
};

export type DoseLog = {
  id: string;
  week: number;
  date: string;
  dose: string;
  site: string;
  time: string;
  taken: boolean;
};

export type BodyMetrics = {
  date: string;
  weightLbs: number;
  muscleLbs: number;
  bodyFatPct: number;
};

export type AiSuggestion = {
  type: "running" | "resistance" | "biking" | "rest";
  name: string;
  duration: string;
  intensity: string;
  reason: string;
};
