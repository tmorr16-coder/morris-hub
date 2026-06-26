interface Props {
  steps: number | null;
  activeEnergyCal: number | null;
  distanceMiles: number | null;
  heartRateBpm: number | null;
  heartRateLabel?: string;
  source?: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  apple_health: "⌚ Apple Watch",
  oura:         "💍 Oura",
  withings:     "⚖️ Withings",
};

const STATS = [
  {
    key: "steps" as const,
    label: "Steps",
    icon: "👟",
    format: (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 }),
    suffix: "",
  },
  {
    key: "activeEnergyCal" as const,
    label: "Active Energy",
    icon: "🔥",
    format: (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 }),
    suffix: " kcal",
  },
  {
    key: "distanceMiles" as const,
    label: "Distance",
    icon: "🚶",
    format: (v: number) => v.toFixed(2),
    suffix: " mi",
  },
  {
    key: "heartRateBpm" as const,
    label: "Heart Rate",
    icon: "❤️",
    format: (v: number) => Math.round(v).toString(),
    suffix: " bpm",
  },
];

export default function ActivityCard({
  steps,
  activeEnergyCal,
  distanceMiles,
  heartRateBpm,
  heartRateLabel = "Heart Rate",
  source,
}: Props) {
  const values: Record<string, number | null> = {
    steps,
    activeEnergyCal,
    distanceMiles,
    heartRateBpm,
  };
  const stats = STATS.map((s) =>
    s.key === "heartRateBpm" ? { ...s, label: heartRateLabel } : s
  );

  const sourceLabel = source ? SOURCE_LABELS[source] ?? source : null;
  const hasData = steps !== null || activeEnergyCal !== null || distanceMiles !== null || heartRateBpm !== null;

  return (
    <div
      style={{
        gridColumn: "1 / -1",
        background: "var(--color-bg-raised)",
        border: "1px solid var(--color-line)",
        borderRadius: 14,
        padding: "20px 22px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div
          style={{
            fontSize: 10, fontWeight: 500, letterSpacing: "0.14em",
            textTransform: "uppercase", color: "var(--color-ink-3)",
          }}
        >
          Today&apos;s Activity
        </div>
        {hasData && sourceLabel && (
          <div style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
            via {sourceLabel}
          </div>
        )}
        {!hasData && (
          <div style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
            No data today
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {stats.map(({ key, label, icon, format, suffix }) => {
          const raw = values[key];
          const display = raw !== null ? `${format(raw)}${suffix}` : "—";
          return (
            <div
              key={key}
              style={{
                background: "var(--color-bg-sunk)",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 10, fontWeight: 500, letterSpacing: "0.1em",
                  textTransform: "uppercase", color: "var(--color-ink-3)",
                  marginBottom: 6,
                }}
              >
                {icon} {label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: raw !== null ? 26 : 22,
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  color: raw !== null ? "var(--color-ink)" : "var(--color-ink-4)",
                }}
              >
                {display}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
