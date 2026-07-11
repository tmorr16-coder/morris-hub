import { redirect } from "next/navigation";
import WorkoutTracker from "./_components/WorkoutTracker";
import { toTrackerExercises } from "./_lib/build-plan";
import type { CardioBlock } from "./actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";

/** Latest recorded body weight (lb), for the "BW" quick-fill on bodyweight sets. */
async function getBodyWeight(): Promise<number | null> {
  try {
    const userId = await getCurrentUserId();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;
    const { data } = await db
      .from("apple_health_metrics")
      .select("value")
      .eq("user_id", userId)
      .eq("metric_name", "weight")
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.value ?? null;
  } catch {
    return null;
  }
}

export default async function WorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; resume?: string }>;
}) {
  const { plan: encoded, resume } = await searchParams;
  const bodyWeight = await getBodyWeight();

  // No plan means nothing was built yet. If we're resuming an in-progress
  // workout, load it entirely from the localStorage snapshot instead of the
  // builder; otherwise send the user to the builder.
  if (!encoded) {
    if (resume === "1") {
      return (
        <div className="ios-scroll">
          <WorkoutTracker resume bodyWeight={bodyWeight} />
        </div>
      );
    }
    redirect("/health/workout/builder");
  }

  let initialExercises;
  let initialWarmup: boolean | undefined;
  let initialCooldown: boolean | undefined;
  let initialCardio: CardioBlock | undefined;
  let initialBlocks: CardioBlock[] | undefined;

  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    if (Array.isArray(decoded)) {
      initialExercises = toTrackerExercises(decoded);
    } else {
      initialExercises = toTrackerExercises(decoded.exercises ?? []);
      if (decoded.warmup)   initialWarmup   = true;
      if (decoded.cooldown) initialCooldown = true;
      if (decoded.cardio)   initialCardio   = decoded.cardio as CardioBlock;
      if (Array.isArray(decoded.blocks)) initialBlocks = decoded.blocks as CardioBlock[];
    }
  } catch {
    // Malformed plan param — send the user back to build a fresh one
    // rather than silently falling back to a canned default workout.
    redirect("/health/workout/builder");
  }

  return (
    <div className="ios-scroll">
      <WorkoutTracker
        initialExercises={initialExercises}
        initialWarmup={initialWarmup}
        initialCooldown={initialCooldown}
        initialCardio={initialCardio}
        initialBlocks={initialBlocks}
        bodyWeight={bodyWeight}
      />
    </div>
  );
}
