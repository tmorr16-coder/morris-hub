export interface CombinedWorkoutRow {
  id: string;
  timestamp: string;
  workout_type: string;
  duration_sec: number | null;
  distance_m: number | null;
  calories: number | null;
  source: "manual" | "apple_health";
}

interface Props {
  workouts: CombinedWorkoutRow[];
  now: Date;
}

function fmtDayLabel(isoTs: string, now: Date): string {
  const d = new Date(isoTs);
  const dateStr = d.toLocaleDateString("sv");
  const today = now.toLocaleDateString("sv");
  const yesterday = new Date(now.getTime() - 86_400_000).toLocaleDateString("sv");
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtDuration(sec: number | null): string {
  if (sec === null) return "—";
  const m = Math.round(sec / 60);
  return `${m} min`;
}

function fmtDistance(meters: number | null): string {
  if (meters === null) return "";
  const mi = meters / 1609.344;
  return `${mi.toFixed(2)} mi`;
}

function fmtCalories(cal: number | null): string {
  if (cal === null) return "";
  return `${Math.round(cal)} kcal`;
}

function fmtWorkoutType(raw: string): string {
  return raw.replace(/([a-z])([A-Z])/g, "$1 $2");
}

const tileStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  background: "var(--color-bg-raised)",
  border: "1px solid var(--color-line)",
  borderRadius: 14,
  padding: "20px 22px",
  boxShadow: "var(--shadow-card)",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--color-ink-3)",
  marginBottom: 14,
};

export default function ActivityHistoryCard({ workouts, now }: Props) {
  // Last 7 calendar days (oldest -> newest, ending today), independent of Monday-start weeks —
  // this keeps the day-grid and the workout list beneath it reading the same rolling window.
  const todayLocal = now.toLocaleDateString("sv");
  const days: { dateStr: string; label: string; isToday: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const dateStr = d.toLocaleDateString("sv");
    days.push({
      dateStr,
      label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
      isToday: dateStr === todayLocal,
    });
  }
  const activeDates = new Set(workouts.map((w) => new Date(w.timestamp).toLocaleDateString("sv")));

  const groups: { day: string; rows: CombinedWorkoutRow[] }[] = [];
  for (const w of workouts) {
    const day = fmtDayLabel(w.timestamp, now);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.rows.push(w);
    } else {
      groups.push({ day, rows: [w] });
    }
  }

  return (
    <div style={tileStyle}>
      <div style={{ ...eyebrowStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Activity</span>
        <span>Last 7 days</span>
      </div>

      {/* Day-checkmark row */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 4, marginBottom: 20 }}>
        {days.map(({ dateStr, label, isToday }) => {
          const isActive = activeDates.has(dateStr);
          return (
            <div key={dateStr} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
                color: isToday ? "var(--color-ink-2)" : "var(--color-ink-4)",
              }}>
                {label}
              </div>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: isActive ? "var(--color-moss)" : isToday ? "var(--color-bg-sunk)" : "transparent",
                border: isToday && !isActive ? "1.5px solid var(--color-line-2)" : "1.5px solid transparent",
                display: "flex", alignItems: "center", justifyContent: "center", transition: "background 150ms",
              }}>
                {isActive && <span style={{ color: "#fff", fontSize: 12, lineHeight: 1 }}>✓</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grouped workout list */}
      {workouts.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--color-ink-4)", textAlign: "center", padding: "16px 0" }}>
          No workouts in the last 7 days
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groups.map(({ day, rows }) => (
            <div key={day}>
              <div style={{ fontSize: 10, color: "var(--color-ink-4)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 500, marginBottom: 6 }}>
                {day}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {rows.map((w) => {
                  const dist = fmtDistance(w.distance_m);
                  const cal = fmtCalories(w.calories);
                  const meta = [fmtDuration(w.duration_sec), dist, cal].filter(Boolean).join(" · ");
                  return (
                    <div key={w.id} style={{
                      background: "var(--color-bg-sunk)", borderRadius: 10, padding: "10px 14px",
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        {w.source === "manual" && (
                          <span title="Manually logged" style={{ fontSize: 10, color: "var(--color-ink-4)", flexShrink: 0 }}>✎</span>
                        )}
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {fmtWorkoutType(w.workout_type)}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-ink-3)", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {meta}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
