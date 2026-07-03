import { redirect } from "next/navigation";
import WorkoutTracker from "./_components/WorkoutTracker";
import { toTrackerExercises } from "./_lib/build-plan";
import type { CardioBlock } from "./actions";

export default async function WorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: encoded } = await searchParams;

  // No plan means nothing was built yet — send the user to the builder
  // instead of silently starting a canned default workout.
  if (!encoded) {
    redirect("/health/workout/builder");
  }

  let initialExercises;
  let initialWarmup: boolean | undefined;
  let initialCooldown: boolean | undefined;
  let initialCardio: CardioBlock | undefined;

  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    if (Array.isArray(decoded)) {
      initialExercises = toTrackerExercises(decoded);
    } else {
      initialExercises = toTrackerExercises(decoded.exercises ?? []);
      if (decoded.warmup)   initialWarmup   = true;
      if (decoded.cooldown) initialCooldown = true;
      if (decoded.cardio)   initialCardio   = decoded.cardio as CardioBlock;
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
      />
    </div>
  );
}
