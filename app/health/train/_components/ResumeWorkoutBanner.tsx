"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconBadge, Icons } from "@/components/ios";
import { readSnapshot, type WorkoutSnapshot } from "../../workout/_lib/resume";

function relativeTime(ms: number) {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Reads the in-progress workout snapshot from localStorage (post-mount, so no
// hydration mismatch) and, if one exists, offers a tap-to-resume card. Works
// after fully closing the app since it needs no ?plan param.
export default function ResumeWorkoutBanner() {
  const [snap, setSnap] = useState<WorkoutSnapshot | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setSnap(readSnapshot());
  }, []);

  if (!snap) return null;

  const exCount  = snap.exercises.length;
  const doneSets = snap.setLogs.flat().filter(Boolean).length;

  return (
    <section style={{ marginBottom: 16 }}>
      <h2 className="ios-group-header" style={{ padding: "0 0 7px" }}>In progress</h2>
      <div className="ios-list" style={{ margin: 0 }}>
        <Link href="/health/workout?resume=1" className="ios-cell" style={{ textDecoration: "none" }}>
          <span className="ios-cell-lead">
            <IconBadge color="var(--ios-green)"><Icons.DumbbellIcon /></IconBadge>
          </span>
          <span className="ios-cell-body">
            <span className="ios-caption" style={{ color: "var(--ios-green)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Resume workout
            </span>
            <span className="ios-cell-title ios-truncate">
              {exCount} exercise{exCount === 1 ? "" : "s"}
              {doneSets > 0 ? ` · ${doneSets} set${doneSets === 1 ? "" : "s"} logged` : ""}
            </span>
            <span className="ios-cell-sub">Started {relativeTime(snap.startedAtMs)}</span>
          </span>
          <Icons.ChevronRight className="ios-chevron" />
        </Link>
      </div>
    </section>
  );
}
