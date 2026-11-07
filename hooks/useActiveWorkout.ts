"use client";

import { useEffect, useState } from "react";
import { readSnapshot, restoreSnapshot, WORKOUT_UPDATED, RESUME_KEY, type WorkoutSnapshot } from "@/app/health/workout/_lib/resume";
import { ownsActiveWorkout } from "@/app/health/workout/actions";

export function useActiveWorkout(userId: string) {
  const [snapshot, setSnapshot] = useState<WorkoutSnapshot | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => { if (active) setSnapshot(readSnapshot(userId)); };
    const storage = (event: StorageEvent) => { if (!event.key || event.key === RESUME_KEY) refresh(); };
    refresh();
    void restoreSnapshot(userId, ownsActiveWorkout).then(() => { if (active) refresh(); }).catch(() => {});
    window.addEventListener(WORKOUT_UPDATED, refresh);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener(WORKOUT_UPDATED, refresh);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", refresh);
    };
  }, [userId]);
  return snapshot;
}
