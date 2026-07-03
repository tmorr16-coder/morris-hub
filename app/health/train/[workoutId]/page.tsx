export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { LargeTitle, Group, Cell } from "@/components/ios";

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
      <div className="ios-scroll">
        <LargeTitle
          title={fmtWorkoutType(workout.workout_type)}
          subtitle={`${fmtDate(dateStr)} · from Apple Health`}
        />
        <Group header="Summary">
          <Cell chevron={false} title="Duration" trailing={<span className="ios-num">{durationMin !== null ? `${durationMin} min` : "—"}</span>} />
          <Cell chevron={false} title="Distance" trailing={<span className="ios-num">{distanceMi !== null ? `${distanceMi} mi` : "—"}</span>} />
          <Cell chevron={false} title="Calories" trailing={<span className="ios-num">{workout.calories != null ? `${Math.round(workout.calories)}` : "—"}</span>} />
        </Group>
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
    <div className="ios-scroll">
      <LargeTitle title={session.type} subtitle={`${fmtDate(session.date)} · logged in-app`} />

      <Group header="Summary">
        <Cell chevron={false} title="Duration" trailing={<span className="ios-num">{session.duration_min != null ? `${session.duration_min} min` : "—"}</span>} />
        <Cell chevron={false} title="Sets" trailing={<span className="ios-num">{totalSets}</span>} />
        <Cell chevron={false} title="Total volume" trailing={<span className="ios-num">{totalVolume.toLocaleString()} lbs</span>} />
      </Group>

      {exercises.length === 0 ? (
        <Group footer="No exercise detail recorded for this session.">
          <Cell chevron={false} title="No exercises logged" />
        </Group>
      ) : (
        exercises.map((ex) => {
          const sets = setsByExercise.get(ex.id) ?? [];
          return (
            <Group key={ex.id} header={ex.name}>
              {sets.length > 0 ? (
                sets.map((s) => (
                  <Cell
                    key={s.set_number}
                    chevron={false}
                    title={`Set ${s.set_number}`}
                    trailing={
                      <span className="ios-num">
                        {s.reps_actual} × {s.weight_actual} lb{s.rpe != null ? ` · RPE ${s.rpe}` : ""}
                      </span>
                    }
                  />
                ))
              ) : (
                <Cell chevron={false} title="No sets recorded" />
              )}
            </Group>
          );
        })
      )}
    </div>
  );
}
