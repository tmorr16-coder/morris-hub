export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";

function fmtWorkoutType(raw: string): string {
  return raw.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default async function WorkoutDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ workoutId: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();
  const { workoutId } = await params;
  const { source } = await searchParams;

  if (source === "apple") {
    const { data: workout } = await db.from("apple_health_workouts")
      .select("id, timestamp, workout_type, duration_sec, distance_m, calories")
      .eq("id", workoutId).eq("user_id", userId).maybeSingle();
    if (!workout) notFound();

    const dateStr = new Date(workout.timestamp).toLocaleDateString("sv");
    const durationMin = workout.duration_sec != null ? Math.round(workout.duration_sec / 60) : null;
    const distanceMi = workout.distance_m != null ? (workout.distance_m / 1609.344).toFixed(2) : null;

    return (
      <div style={{ padding: "20px 20px 40px", maxWidth: 480, margin: "0 auto" }}>
        <Link href="/health/train" style={{ fontSize: 13, color: "var(--color-ink-3)", textDecoration: "none" }}>← Train</Link>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", margin: "16px 0 4px" }}>
          {fmtDate(dateStr)} · from Apple Health
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 20px", color: "var(--color-ink)" }}>
          {fmtWorkoutType(workout.workout_type)}
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { label: "Duration", value: durationMin !== null ? `${durationMin} min` : "—" },
            { label: "Distance", value: distanceMi !== null ? `${distanceMi} mi` : "—" },
            { label: "Calories", value: workout.calories != null ? `${Math.round(workout.calories)}` : "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 12, padding: "14px 12px", textAlign: "center", boxShadow: "var(--shadow-card)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 600, color: "var(--color-ink)" }}>{value}</div>
              <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Manual session: workout_sessions -> exercises -> sets
  const { data: session } = await db.from("workout_sessions")
    .select("id, date, type, duration_min")
    .eq("id", workoutId).eq("user_id", userId).maybeSingle();
  if (!session) notFound();

  const { data: exerciseRows } = await db.from("exercises")
    .select("id, name, order_index")
    .eq("session_id", workoutId).eq("user_id", userId)
    .order("order_index", { ascending: true });

  const exercises: { id: string; name: string }[] = exerciseRows ?? [];
  const exerciseIds = exercises.map((e) => e.id);

  const { data: setRows } = exerciseIds.length > 0
    ? await db.from("sets")
        .select("exercise_id, set_number, reps_actual, weight_actual, rpe")
        .in("exercise_id", exerciseIds)
        .order("set_number", { ascending: true })
    : { data: [] };

  type SetRow = { exercise_id: string; set_number: number; reps_actual: number; weight_actual: number; rpe: number | null };
  const setsByExercise = new Map<string, SetRow[]>();
  for (const s of (setRows ?? []) as SetRow[]) {
    if (!setsByExercise.has(s.exercise_id)) setsByExercise.set(s.exercise_id, []);
    setsByExercise.get(s.exercise_id)!.push(s);
  }

  const totalVolume = ((setRows ?? []) as SetRow[]).reduce((sum, s) => sum + s.reps_actual * s.weight_actual, 0);
  const totalSets = (setRows ?? []).length;

  return (
    <div style={{ padding: "20px 20px 40px", maxWidth: 480, margin: "0 auto" }}>
      <Link href="/health/train" style={{ fontSize: 13, color: "var(--color-ink-3)", textDecoration: "none" }}>← Train</Link>
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", margin: "16px 0 4px" }}>
        {fmtDate(session.date)} · logged in-app
      </div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 8px", color: "var(--color-ink)" }}>
        {session.type}
      </h1>
      <p style={{ fontSize: 13, color: "var(--color-ink-3)", margin: "0 0 20px" }}>
        {session.duration_min != null ? `${session.duration_min} min` : "—"} · {totalSets} sets · {totalVolume.toLocaleString()} lbs total volume
      </p>

      {exercises.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--color-ink-4)" }}>No exercise detail recorded for this session.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {exercises.map((ex) => {
            const sets = setsByExercise.get(ex.id) ?? [];
            return (
              <div key={ex.id} style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 14, padding: "14px 16px", boxShadow: "var(--shadow-card)" }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--color-ink)", marginBottom: sets.length > 0 ? 10 : 0 }}>
                  {ex.name}
                </div>
                {sets.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {sets.map((s) => (
                      <div key={s.set_number} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: "var(--color-bg-sunk)", borderRadius: 8 }}>
                        <span style={{ width: 44, fontSize: 11, color: "var(--color-ink-4)", fontWeight: 600 }}>Set {s.set_number}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>
                          {s.reps_actual} × {s.weight_actual}lb
                        </span>
                        {s.rpe != null && (
                          <span style={{ fontSize: 11, color: "var(--color-ink-4)", marginLeft: "auto" }}>@ {s.rpe}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
