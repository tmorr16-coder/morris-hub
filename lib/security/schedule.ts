export type ReviewSchedule = { enabled: boolean; frequency: "daily" | "weekly"; time: string; weekday: number };
export type ReviewConfig = ReviewSchedule & { id: boolean; version: number; next_due: string | null };
export const REVIEW_TIMEZONE = "America/Indiana/Indianapolis";
const formatter = new Intl.DateTimeFormat("en-US", { timeZone: REVIEW_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function local(instant: number) { const p = Object.fromEntries(formatter.formatToParts(instant).map(p => [p.type,p.value])); return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, day: days.indexOf(p.weekday) }; }
export function localReviewDate(instant: string): string { return local(Date.parse(instant)).date; }
export function parseSchedule(input: Record<string, unknown>): ReviewSchedule {
  if (typeof input.enabled !== "boolean" || !["daily","weekly"].includes(String(input.frequency)) || typeof input.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time) || !Number.isInteger(input.weekday) || Number(input.weekday) < 0 || Number(input.weekday) > 6) throw Error("Choose a valid frequency, time and weekday.");
  return { enabled: input.enabled, frequency: input.frequency as ReviewSchedule["frequency"], time: input.time, weekday: Number(input.weekday) };
}
/** Search actual local minutes, so DST offsets never become a hard-coded UTC offset. */
export function nextReview(schedule: ReviewSchedule, now = Date.now(), skipLocalDate?: string): string | null {
  if (!schedule.enabled) return null;
  const start = Math.floor(now / 60_000) * 60_000 + 60_000;
  for (let offset = 0; offset < 9 * 1440; offset++) {
    const instant = start + offset * 60_000; const p = local(instant);
    if (p.date !== skipLocalDate && p.time === schedule.time && (schedule.frequency === "daily" || p.day === schedule.weekday)) return new Date(instant).toISOString();
  }
  throw Error("The next review time could not be calculated.");
}
