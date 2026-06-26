export interface WorkoutRow {
  id: string;
  timestamp: string;
  workout_type: string;
  duration_sec: number | null;
  distance_m: number | null;
  calories: number | null;
}

interface Props {
  workouts: WorkoutRow[];
}

function fmtDayLabel(isoTs: string): string {
  const d = new Date(isoTs);
  const dateStr = d.toLocaleDateString("sv");
  const today = new Date().toLocaleDateString("sv");
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString("sv");
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
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--color-ink-3)",
  marginBottom: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

export default function RecentWorkoutsCard({ workouts }: Props) {
  if (workouts.length === 0) {
    return (
      <div style={tileStyle}>
        <div style={eyebrowStyle}>Recent Workouts</div>
        <div style={{ fontSize: 13, color: "var(--color-ink-4)", textAlign: "center", padding: "16px 0" }}>
          No workouts in the last 7 days
        </div>
      </div>
    );
  }

  const groups: { day: string; rows: WorkoutRow[] }[] = [];
  for (const w of workouts) {
    const day = fmtDayLabel(w.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.rows.push(w);
    } else {
      groups.push({ day, rows: [w] });
    }
  }

  return (
    <div style={tileStyle}>
      <div style={eyebrowStyle}>
        <span>Recent Workouts</span>
        <span>Last 7 days</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {groups.map(({ day, rows }) => (
          <div key={day}>
            <div
              style={{
                fontSize: 10,
                color: "var(--color-ink-4)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                fontWeight: 500,
                marginBottom: 6,
              }}
            >
              {day}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rows.map((w) => {
                const dist = fmtDistance(w.distance_m);
                const cal = fmtCalories(w.calories);
                const meta = [fmtDuration(w.duration_sec), dist, cal]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div
                    key={w.id}
                    style={{
                      background: "var(--color-bg-sunk)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--color-ink)",
                        minWidth: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {fmtWorkoutType(w.workout_type)}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--color-ink-3)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {meta}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
