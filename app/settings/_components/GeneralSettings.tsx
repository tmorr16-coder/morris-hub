"use client";

// Platform-level preferences stored on the user's Supabase metadata:
//   timezone  — drives "today" boundaries across the app (Health, Today)
//   move_goal — Apple Move (active energy) daily goal, in calories
// Saved via auth.updateUser (updates the caller's own metadata), then the page
// is refreshed so server components pick up the new values.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Group, Cell, IconBadge, Icons } from "@/components/ios";
import { TIMEZONE_OPTIONS, DEFAULT_TIMEZONE } from "@/lib/timezone";

export default function GeneralSettings({
  initialTimezone,
  initialMoveGoal,
}: {
  initialTimezone: string;
  initialMoveGoal: number;
}) {
  const router = useRouter();
  const [tz, setTz] = useState(initialTimezone || DEFAULT_TIMEZONE);
  const [moveGoal, setMoveGoal] = useState(String(initialMoveGoal || 1300));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(next: { timezone?: string; move_goal?: number }) {
    startTransition(async () => {
      await createClient().auth.updateUser({ data: next });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    });
  }

  return (
    <Group header="General" footer="Timezone sets your “today” for daily totals across the app. Move is your Apple active-energy goal.">
      <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.GearIcon /></IconBadge>} title="Timezone" chevron={false} />
      <div style={{ padding: "0 16px 12px" }}>
        <select
          value={tz}
          onChange={(e) => { setTz(e.target.value); save({ timezone: e.target.value }); }}
          disabled={pending}
          style={{ width: "100%", padding: "11px 12px", fontSize: 16, background: "var(--ios-fill)", border: "none", borderRadius: 10, color: "var(--ios-label)" }}
        >
          {TIMEZONE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <Cell lead={<IconBadge color="#FA114F"><Icons.DumbbellIcon /></IconBadge>} title="Daily Move goal" subtitle="Active energy (calories)" chevron={false}
        trailing={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input
              value={moveGoal}
              onChange={(e) => setMoveGoal(e.target.value)}
              onBlur={() => { const n = parseInt(moveGoal.replace(/[^0-9]/g, ""), 10); if (Number.isFinite(n) && n > 0) save({ move_goal: n }); }}
              inputMode="numeric"
              className="ios-num"
              style={{ width: 72, textAlign: "right", padding: "6px 8px", fontSize: 16, background: "var(--ios-fill)", border: "none", borderRadius: 8, color: "var(--ios-label)" }}
            />
            <span className="ios-footnote" style={{ color: saved ? "var(--ios-green)" : "var(--ios-label-3)" }}>{saved ? "Saved" : "cal"}</span>
          </span>
        }
      />
    </Group>
  );
}
