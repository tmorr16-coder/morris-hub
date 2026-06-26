import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_USER_ID } from "@/lib/health/auth";

const BASE = "https://api.ouraring.com/v2/usercollection";

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type MetricRow = {
  user_id:     string;
  timestamp:   string;
  metric_name: string;
  value:       number;
  unit:        string;
  source:      string;
};

async function ouraGet(path: string, params: Record<string, string>, token: string) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Oura ${path} returned ${res.status}`);
  return res.json() as Promise<{ data: Record<string, unknown>[] }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncOneUser(db: any, userId: string, token: string): Promise<number> {
  const { count } = await db
    .from("apple_health_metrics")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "oura");

  const isFirstSync = !count || count === 0;
  const today     = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (isFirstSync ? 7 : 2));

  const dateParams = { start_date: dateStr(startDate), end_date: dateStr(today) };
  const dtParams   = { start_datetime: startDate.toISOString(), end_datetime: today.toISOString() };

  const [dailySleepResult, detailSleepResult, readinessResult, activityResult, hrResult] =
    await Promise.allSettled([
      ouraGet("daily_sleep",      dateParams, token),
      ouraGet("sleep",            dateParams, token),
      ouraGet("daily_readiness",  dateParams, token),
      ouraGet("daily_activity",   dateParams, token),
      ouraGet("heartrate",        dtParams,   token),
    ]);

  const rows: MetricRow[] = [];

  if (dailySleepResult.status === "fulfilled") {
    for (const item of dailySleepResult.value.data) {
      if (item.score == null) continue;
      rows.push({ user_id: userId, timestamp: `${item.day}T00:00:00Z`, metric_name: "sleep_score", value: item.score as number, unit: "score", source: "oura" });
    }
  } else { console.error(`[oura/sync] ${userId} daily_sleep:`, detailSleepResult); }

  if (detailSleepResult.status === "fulfilled") {
    for (const item of detailSleepResult.value.data) {
      const ts = `${item.day}T00:00:00Z`;
      const push = (metric_name: string, raw: unknown, unit: string, scale = 1) => {
        if (raw == null) return;
        rows.push({ user_id: userId, timestamp: ts, metric_name, value: parseFloat(((raw as number) * scale).toFixed(2)), unit, source: "oura" });
      };
      push("sleep_duration_min", item.total_sleep_duration, "min", 1 / 60);
      push("rem_sleep_min",      item.rem_sleep_duration,   "min", 1 / 60);
      push("deep_sleep_min",     item.deep_sleep_duration,  "min", 1 / 60);
      push("hrv",                item.average_hrv,           "ms");
      push("resting_heart_rate", item.lowest_heart_rate,     "bpm");
    }
  }

  if (readinessResult.status === "fulfilled") {
    for (const item of readinessResult.value.data) {
      if (item.score == null) continue;
      rows.push({ user_id: userId, timestamp: `${item.day}T00:00:00Z`, metric_name: "readiness_score", value: item.score as number, unit: "score", source: "oura" });
    }
  }

  if (activityResult.status === "fulfilled") {
    for (const item of activityResult.value.data) {
      if (item.score == null) continue;
      rows.push({ user_id: userId, timestamp: `${item.day}T00:00:00Z`, metric_name: "activity_score", value: item.score as number, unit: "score", source: "oura" });
    }
  }

  if (hrResult.status === "fulfilled") {
    for (const item of hrResult.value.data) {
      if (!["sleep", "rest"].includes(item.source as string)) continue;
      if (item.bpm == null) continue;
      rows.push({ user_id: userId, timestamp: item.timestamp as string, metric_name: "heart_rate_bpm", value: item.bpm as number, unit: "bpm", source: "oura" });
    }
  }

  if (rows.length === 0) return 0;

  let inserted = 0;
  for (const batch of chunk(rows, 500)) {
    const { data, error } = await db
      .from("apple_health_metrics")
      .upsert(batch, { onConflict: "user_id,timestamp,metric_name,source", ignoreDuplicates: true })
      .select("id");
    if (error) console.error(`[oura/sync] Upsert error for ${userId}:`, error.message);
    else inserted += (data as unknown[]).length;
  }
  return inserted;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const { searchParams } = new URL(request.url);
  const specificUserId = searchParams.get("userId");

  // Try per-user tokens from DB first
  type OuraTokenRow = { user_id: string; access_token: string };
  const baseQuery = db.from("oura_tokens").select("user_id, access_token");
  const { data: tokenRows } = specificUserId
    ? await baseQuery.eq("user_id", specificUserId)
    : await baseQuery;

  let usersToSync: OuraTokenRow[] = (tokenRows as OuraTokenRow[] | null) ?? [];

  // Fall back to env var token — write data to the requesting user's account
  const envToken = process.env.OURA_ACCESS_TOKEN;
  if (envToken && usersToSync.length === 0) {
    usersToSync = [{ user_id: specificUserId ?? DEV_USER_ID, access_token: envToken }];
  }

  if (usersToSync.length === 0) {
    return Response.json({ metrics_inserted: 0, users_synced: 0 });
  }

  let totalInserted = 0;
  for (const { user_id, access_token } of usersToSync) {
    try {
      const inserted = await syncOneUser(db, user_id, access_token);
      totalInserted += inserted;
    } catch (err) {
      console.error(`[oura/sync] Failed for user ${user_id}:`, err);
    }
  }

  // Daily cleanup: delete apple_health_metrics older than 14 days to control egress.
  // Only runs during the cron (no specificUserId), not on manual user syncs.
  let deleted = 0;
  if (!specificUserId) {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("apple_health_metrics")
      .delete({ count: "exact" })
      .lt("timestamp", cutoff);
    deleted = count ?? 0;
    if (deleted > 0) console.log(`[oura/sync] Cleaned up ${deleted} records older than 14 days`);
  }

  const result = { metrics_inserted: totalInserted, users_synced: usersToSync.length, cleaned_up: deleted };
  console.log("[oura/sync] Complete:", result);
  return Response.json(result);
}
