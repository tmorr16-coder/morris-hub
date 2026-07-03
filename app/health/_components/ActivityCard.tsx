import type { ReactNode } from "react";

interface Props {
  steps: number | null;
  activeEnergyCal: number | null;
  distanceMiles: number | null;
  heartRateBpm: number | null;
  heartRateLabel?: string;
  source?: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  apple_health: "Apple Watch",
  oura:         "Oura",
  withings:     "Withings",
};

function StepsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4c1.5 0 2.5 1.2 2.5 3.5S10.5 13 9 13s-2.5-1.2-2.5-3.5S7.5 4 9 4Z" />
      <path d="M7 15c2 0 3 1 3 2.5S9 21 7 21s-3-1-3-2.5S5 15 7 15Z" />
      <path d="M17 7c1.3 0 2.2 1 2.2 3s-.9 3-2.2 3-2.2-1-2.2-3 .9-3 2.2-3Z" />
    </svg>
  );
}
function FlameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2c1 3-2 4-2 7a2 2 0 0 0 4 0c2 2 3 4 3 6a5 5 0 0 1-10 0c0-4 3-6 5-13Z" />
    </svg>
  );
}
function WalkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="13" cy="4" r="1.6" />
      <path d="M12 8l-2 4 3 2 1 6M10 12l-3 2-1 4M13 10l3 1" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3 1 6 4 3-3 4-4 6-4 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20Z" />
    </svg>
  );
}

const STATS: {
  key: "steps" | "activeEnergyCal" | "distanceMiles" | "heartRateBpm";
  label: string;
  Icon: () => ReactNode;
  format: (v: number) => string;
  suffix: string;
}[] = [
  {
    key: "steps",
    label: "Steps",
    Icon: StepsIcon,
    format: (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 }),
    suffix: "",
  },
  {
    key: "activeEnergyCal",
    label: "Active Energy",
    Icon: FlameIcon,
    format: (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 }),
    suffix: " kcal",
  },
  {
    key: "distanceMiles",
    label: "Distance",
    Icon: WalkIcon,
    format: (v: number) => v.toFixed(2),
    suffix: " mi",
  },
  {
    key: "heartRateBpm",
    label: "Heart Rate",
    Icon: HeartIcon,
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
        background: "var(--ios-cell)",
        borderRadius: "var(--ios-radius-card)",
        padding: "16px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div className="ios-footnote" style={{ fontWeight: 600, color: "var(--ios-label)" }}>
          Today&apos;s Activity
        </div>
        {hasData && sourceLabel && (
          <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>
            via {sourceLabel}
          </div>
        )}
        {!hasData && (
          <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>
            No data today
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {stats.map(({ key, label, Icon, format, suffix }) => {
          const raw = values[key];
          const display = raw !== null ? `${format(raw)}${suffix}` : "—";
          return (
            <div
              key={key}
              style={{
                background: "var(--ios-bg)",
                borderRadius: 10,
                padding: "12px 12px",
              }}
            >
              <div
                className="ios-caption"
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  color: "var(--ios-label-2)", marginBottom: 6,
                }}
              >
                <span style={{ display: "flex", color: "var(--ios-tint)" }}><Icon /></span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
              </div>
              <div
                className="ios-num"
                style={{
                  fontSize: raw !== null ? 22 : 19,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  color: raw !== null ? "var(--ios-label)" : "var(--ios-label-3)",
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
