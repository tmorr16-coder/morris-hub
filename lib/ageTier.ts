// Age-tier cutoffs for the Children workspace — tunable in one place.
export type AgeTier = "elementary" | "teen" | "college";

const ELEMENTARY_MAX_AGE = 10; // <=10
const TEEN_MAX_AGE = 17;       // 11-17; 18+ = college

export function computeAgeTier(
  birthYear: number | null,
  overrideTier: AgeTier | null,
  now: Date = new Date()
): AgeTier {
  if (overrideTier) return overrideTier;
  if (!birthYear) return "teen"; // safe middle default when age unknown
  const age = now.getFullYear() - birthYear;
  if (age <= ELEMENTARY_MAX_AGE) return "elementary";
  if (age <= TEEN_MAX_AGE) return "teen";
  return "college";
}

export function computeAge(birthYear: number | null, now: Date = new Date()): number | null {
  return birthYear ? now.getFullYear() - birthYear : null;
}
