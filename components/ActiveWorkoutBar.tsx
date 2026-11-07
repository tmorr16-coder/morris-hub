"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveWorkout } from "@/hooks/useActiveWorkout";
import { workoutElapsed } from "@/app/health/workout/_lib/resume";

export default function ActiveWorkoutBar({ userId }: { userId: string }) {
  const snap = useActiveWorkout(userId);
  const path = usePathname();
  const [now, setNow] = useState(() => Date.now());
  const visible = !!snap && path !== "/health/workout" && !path.startsWith("/workouts/share");
  useEffect(() => {
    if (!visible) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    document.body.setAttribute("data-workout-active", "true");
    window.addEventListener("focus", tick);
    return () => { clearInterval(id); window.removeEventListener("focus", tick); document.body.removeAttribute("data-workout-active"); };
  }, [visible]);
  if (!snap || !visible) return null;
  const sets = snap.setLogs.flat().filter(Boolean).length;
  const elapsed = snap.showSummary ? snap.finalElapsed ?? workoutElapsed(snap, now) : workoutElapsed(snap, now);
  return (
    <aside className="active-workout-bar" aria-label="Active workout">
      <Link href="/health/workout?resume=1" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "inherit", textDecoration: "none" }}>
        <span aria-hidden style={{ fontSize: 22 }}>🏋️</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 15 }}>{snap.showSummary ? "Save your workout summary" : snap.pausedAtMs ? "Workout paused" : "Workout in progress"}</strong>
          <span style={{ fontSize: 13 }}>{sets} sets logged · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
        </span>
        <strong style={{ fontSize: 14 }}>{snap.showSummary ? "Review" : "Resume"} →</strong>
      </Link>
    </aside>
  );
}
