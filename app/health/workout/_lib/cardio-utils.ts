// Cardio utility functions — pure client-safe helpers, no server dependency

export function hrZone(hrAvg: number, ageYears = 40): 1 | 2 | 3 | 4 | 5 {
  const maxHr = 220 - ageYears;
  const pct = hrAvg / maxHr;
  if (pct < 0.60) return 1;
  if (pct < 0.70) return 2;
  if (pct < 0.80) return 3;
  if (pct < 0.90) return 4;
  return 5;
}

const ZONE_LABEL: Record<number, string> = {
  1: "Zone 1 · Recovery",
  2: "Zone 2 · Aerobic base",
  3: "Zone 3 · Endurance",
  4: "Zone 4 · Threshold",
  5: "Zone 5 · VO₂ max",
};

export function hrZoneLabel(zone: number): string {
  return ZONE_LABEL[zone] ?? "";
}

export function formatPace(paceMinPerMile: number): string {
  const mins = Math.floor(paceMinPerMile);
  const secs = Math.round((paceMinPerMile % 1) * 60);
  return `${mins}:${String(secs).padStart(2, "0")}/mi`;
}
