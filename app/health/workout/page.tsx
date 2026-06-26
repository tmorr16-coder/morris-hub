import WorkoutTracker from "./_components/WorkoutTracker";
import { toTrackerExercises } from "./_lib/build-plan";
import type { CardioBlock } from "./actions";

export default async function WorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: encoded } = await searchParams;

  let initialExercises;
  let initialWarmup: boolean | undefined;
  let initialCooldown: boolean | undefined;
  let initialCardio: CardioBlock | undefined;

  if (encoded) {
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
      // Ignore malformed param — fall back to default EXERCISE_LIBRARY
    }
  }

  return (
    <WorkoutTracker
      initialExercises={initialExercises}
      initialWarmup={initialWarmup}
      initialCooldown={initialCooldown}
      initialCardio={initialCardio}
    />
  );
}
