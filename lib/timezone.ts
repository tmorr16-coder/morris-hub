// Platform timezone handling. Defaults to US Eastern; each user can override it
// (stored in Supabase user_metadata.timezone) from Settings. Used to compute
// "today" boundaries so daily totals (steps, Move, distance) match the watch.

export const DEFAULT_TIMEZONE = "America/New_York";

// A small, friendly set of US timezones for the settings picker.
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Indiana/Indianapolis", label: "Eastern (Indiana)" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Mountain (Arizona)" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getUserTimezone(userMetadata: any): string {
  const tz = userMetadata?.timezone;
  return typeof tz === "string" && tz.length > 0 ? tz : DEFAULT_TIMEZONE;
}

/**
 * The UTC instant corresponding to 00:00 local time *today* in `tz`.
 * Filtering `timestamp >= startOfTodayInTz(tz)` yields exactly today's rows in
 * the user's timezone, regardless of the server's own timezone (UTC on Vercel).
 */
export function startOfTodayInTz(tz: string): Date {
  const now = new Date();
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  })
    .formatToParts(now)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});

  // Local wall-clock "now" expressed as if it were UTC, minus real UTC now = tz offset.
  const localNowAsUTC = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
  const offsetMs = localNowAsUTC - now.getTime();
  const localMidnightAsUTC = Date.UTC(+p.year, +p.month - 1, +p.day, 0, 0, 0);
  return new Date(localMidnightAsUTC - offsetMs);
}
