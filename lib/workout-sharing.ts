/** The complete public sharing contract. Private workout/account fields are excluded. */
export interface WorkoutShareSummary {
  title: string;
  minutes: number;
  exercises: number;
  sets: number;
  reps: number;
  volume?: number;
  caption: string;
}

export function parseWorkoutShare(raw: string | null | undefined): WorkoutShareSummary | null {
  if (typeof raw !== "string" || !raw || raw.length > 1800) return null;
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p.title !== "string" || !p.title.trim() || p.title.length > 70 ||
        typeof p.caption !== "string" || p.caption.length > 220) return null;
    for (const [key, max] of [["minutes", 1440], ["exercises", 300], ["sets", 10000], ["reps", 1000000]] as const) {
      if (!Number.isFinite(p[key]) || p[key] < 0 || p[key] > max || !Number.isInteger(p[key])) return null;
    }
    if (p.volume != null && (!Number.isFinite(p.volume) || p.volume < 0 || p.volume > 1e9)) return null;
    return { title: p.title.trim(), minutes: p.minutes, exercises: p.exercises, sets: p.sets, reps: p.reps,
      ...(p.volume != null ? { volume: p.volume } : {}), caption: p.caption };
  } catch { return null; }
}

export function workoutShareUrl(summary: WorkoutShareSummary, origin: string): string {
  const safe = parseWorkoutShare(JSON.stringify(summary));
  if (!safe) throw new Error("Invalid workout summary");
  const url = new URL("/workouts/share", origin);
  url.searchParams.set("s", JSON.stringify(safe));
  return url.toString();
}

export function facebookShareUrl(url: string): string {
  const target = new URL("https://www.facebook.com/sharer/sharer.php");
  target.searchParams.set("u", url);
  return target.toString();
}

export function workoutShareDescription(s: WorkoutShareSummary): string {
  return `${s.minutes} minutes · ${s.exercises} exercises · ${s.sets} sets · ${s.reps} reps${s.volume != null ? ` · ${s.volume.toLocaleString("en-US")} lb total volume` : ""}. ${s.caption}`.trim();
}
