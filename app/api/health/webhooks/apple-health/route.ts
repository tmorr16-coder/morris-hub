import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_USER_ID } from "@/lib/health/auth";
import { createHash } from "crypto";

// URL format: /api/health/webhooks/apple-health?userId=<uuid>
// The shared HEALTH_AUTO_EXPORT_SECRET authenticates the sender;
// userId identifies whose data to store.

// ── payload types (Health Auto Export REST format) ────────────────────────────
// Top-level: { data: { metrics?, workouts? } }
// Ref: https://github.com/Lybron/health-auto-export

interface MetricPoint {
  date: string;
  source?: string;
  units?: string;
  // Standard metric (steps, calories, etc.)
  qty?: number;
  // Aggregated metric (heart rate summary: Min/Avg/Max)
  Min?: number;
  Avg?: number;
  Max?: number;
  // Blood pressure
  systolic?: number;
  diastolic?: number;
  [key: string]: unknown;
}

interface MetricGroup {
  name: string;
  units: string;
  data: MetricPoint[];
}

interface WorkoutPayload {
  name: string;                                    // workout type, e.g. "Running"
  start: string;                                   // ISO timestamp
  end?: string;
  duration?: number;                               // seconds
  distance?: { qty: number; units: string };
  activeEnergyBurned?: { qty: number; units: string };
  activeEnergy?: { qty: number; units: string };
  heartRateData?: unknown[];
  route?: unknown[];
  [key: string]: unknown;
}

interface HealthPayload {
  data?: {
    metrics?: MetricGroup[];
    workouts?: WorkoutPayload[];
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

// Extract a scalar value from the polymorphic metric point format.
// Priority: qty (standard) → Avg (heart rate / aggregated) → systolic (blood pressure)
function extractValue(point: MetricPoint): number | null {
  if (typeof point.qty === "number") return point.qty;
  if (typeof point.Avg === "number") return point.Avg;
  if (typeof point.systolic === "number") return point.systolic;
  return null;
}

// Normalize Health Auto Export metric names to canonical forms used by the dashboard queries.
function normalizeMetricName(name: string): string {
  const lower = name.toLowerCase().trim();

  // Weight
  if (["weight", "bodymass", "body mass", "hkquantitytypeidentifierbodymass"].includes(lower)) return "weight";

  // Heart Rate Variability
  if (["hrv", "heart_rate_variability", "heart rate variability", "heartratevariabilitysdnn",
       "heart rate variability (sdnn)"].includes(lower)) return "hrv";

  // Resting Heart Rate
  if (["resting_heart_rate", "resting heart rate", "restingheartrate"].includes(lower)) return "resting_heart_rate";

  // Heart Rate (instantaneous)
  if (["heart_rate", "heart rate", "heartrate", "hr"].includes(lower)) return "heart_rate";

  // Steps — canonical: step_count (matches DB + dashboard query)
  if (["steps", "step count", "step_count", "stepcount"].includes(lower)) return "step_count";

  // Active energy — canonical: active_energy (matches dashboard query)
  if (["active energy", "active energy burned", "active_energy", "active_energy_burned",
       "activeenergyburned", "calories"].includes(lower)) return "active_energy";

  // Basal / resting energy (keep separate from active)
  if (["basal energy burned", "basal_energy_burned", "basalenergyburned",
       "resting energy burned", "resting_energy_burned"].includes(lower)) return "basal_energy_burned";

  // Distance
  if (["walking + running distance", "walking running distance",
       "walking_running_distance", "distance"].includes(lower)) return "walking_running_distance";

  // Return original name lowercased+underscored as fallback for consistency
  return lower.replace(/\s+/g, "_");
}

// Health Auto Export exports distance in km or mi; schema stores meters.
function toMeters(qty: number, units: string): number {
  switch (units.toLowerCase()) {
    case "km":
      return qty * 1000;
    case "mi":
    case "miles":
      return qty * 1609.344;
    default:
      return qty; // assume meters
  }
}

/** Milliseconds since the epoch for an ISO string or Health Auto Export's "2026-09-26 06:19:38 -0400". */
function toEpochMs(s: string | undefined | null): number | null {
  if (!s) return null;
  let t = Date.parse(s);
  if (Number.isNaN(t)) {
    const m = s.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s*([+-]\d{2}):?(\d{2})$/);
    if (m) t = Date.parse(`${m[1]}T${m[2]}${m[3]}:${m[4]}`);
  }
  return Number.isNaN(t) ? null : t;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const BATCH = 500;

// ── route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Authentication ────────────────────────────────────────────────────────
  // Two senders. The native app presents its own token, paired to one person
  // and revocable on its own; Health Auto Export presents the shared secret in
  // an "api-key" header and names the person in the URL.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authDb = createAdminClient() as any;
  const bearer = request.headers.get("authorization");
  let deviceId: string | null = null;
  let deviceUserId: string | null = null;
  if (bearer?.toLowerCase().startsWith("bearer ")) {
    const hash = createHash("sha256").update(bearer.slice(7).trim()).digest("hex");
    const { data: dev } = await authDb.from("health_devices")
      .select("id, user_id, revoked_at").eq("token_hash", hash).maybeSingle();
    if (!dev || dev.revoked_at) {
      return NextResponse.json({ error: "This phone is no longer paired." }, { status: 401 });
    }
    deviceId = dev.id as string;
    deviceUserId = dev.user_id as string;
  } else {
    const secret   = process.env.HEALTH_AUTO_EXPORT_SECRET;
    const provided = request.headers.get("api-key");
    if (!secret) {
      console.error("[apple-health] HEALTH_AUTO_EXPORT_SECRET is not set");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    if (!provided || provided !== secret) {
      console.warn("[apple-health] 401 — bad or missing api-key header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: HealthPayload;
  try {
    body = (await request.json()) as HealthPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const metrics  = body.data?.metrics  ?? [];
  const workouts = body.data?.workouts ?? [];

  // Log the incoming structure so Vercel logs show what arrived
  console.log("[apple-health] Received payload:", {
    metricGroups: metrics.length,
    metrics: metrics.map((m) => `${m.name}(${m.data?.length ?? 0})`),
    workouts: workouts.length,
    workoutTypes: workouts.map((w) => w.name),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const { searchParams } = new URL(request.url);
  const userId = deviceUserId ?? (searchParams.get("userId") || DEV_USER_ID);
  // The native app re-sends the current hour as it fills, so its rows must
  // replace what is there. Health Auto Export sends finished buckets and keeps
  // the old behaviour: first write wins.
  const replaceExisting = deviceId !== null;

  let metricsInserted  = 0;
  let workoutsInserted = 0;

  // ── Insert metrics ────────────────────────────────────────────────────────
  for (const group of metrics) {
    if (!group.data?.length) continue;

    const rows = group.data
      .map((pt) => {
        // Skip rows that originated from Oura or Withings devices — we already
        // ingest those via dedicated API integrations and don't want duplicates.
        const src = (pt.source ?? "").toLowerCase();
        if (src.includes("oura") || src.includes("withings")) return null;

        const value = extractValue(pt);
        if (value === null) return null;
        return {
          user_id:     userId,
          timestamp:   pt.date,
          metric_name: normalizeMetricName(group.name),
          value,
          unit:        pt.units ?? group.units,
          // Always tag rows coming through this webhook as 'apple_health' so
          // the integrations page and dashboard queries match. The device-level
          // source (e.g. "Terry's iPhone") from Health Auto Export isn't useful
          // for our queries — we identify the integration by the webhook itself.
          source:      "apple_health",
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) continue;

    for (const batch of chunk(rows, BATCH)) {
      // ON CONFLICT (user_id, timestamp, metric_name, source) DO NOTHING
      // The unique index ahm_dedup must exist on the table (see supabase/schema.sql).
      const { data: inserted, error } = await db
        .from("apple_health_metrics")
        .upsert(batch, {
          onConflict:       "user_id,timestamp,metric_name,source",
          ignoreDuplicates: !replaceExisting,
        })
        .select("id");

      if (error) {
        console.error(`[apple-health] Metrics error (${group.name}):`, error.message);
      } else {
        metricsInserted += (inserted as unknown[]).length;
      }
    }
  }

  // ── Insert workouts ───────────────────────────────────────────────────────
  // A workout is the same workout when it starts within a minute of one
  // already stored. The old check compared the sender's date string with the
  // database's rendering of it, which never match ("2026-09-26 06:19:38 -0400"
  // against "2026-09-26T10:19:38+00:00"), and compared names, which differ
  // between senders.
  const storedStarts: number[] = [];
  const startsOf = workouts.map((w) => toEpochMs(w.start)).filter((n): n is number => n !== null);
  if (startsOf.length > 0) {
    const lo = new Date(Math.min(...startsOf) - 120_000).toISOString();
    const hi = new Date(Math.max(...startsOf) + 120_000).toISOString();
    const { data: existing } = await db
      .from("apple_health_workouts")
      .select("timestamp")
      .eq("user_id", userId)
      .gte("timestamp", lo)
      .lte("timestamp", hi);
    for (const r of (existing ?? []) as { timestamp: string }[]) {
      const t = toEpochMs(r.timestamp);
      if (t !== null) storedStarts.push(t);
    }
  }

  for (const workout of workouts) {
    const startMs = toEpochMs(workout.start);
    if (startMs === null) continue;
    if (storedStarts.some((t) => Math.abs(t - startMs) < 60_000)) {
      console.log(`[apple-health] Workout duplicate skipped: ${workout.name} @ ${workout.start}`);
      continue;
    }
    storedStarts.push(startMs);

    const calories =
      workout.activeEnergyBurned?.qty ??
      workout.activeEnergy?.qty ??
      null;

    const row = {
      user_id:      userId,
      timestamp:    workout.start,
      workout_type: workout.name,
      duration_sec: workout.duration ?? null,
      distance_m:   workout.distance
        ? toMeters(workout.distance.qty, workout.distance.units)
        : null,
      calories,
      source:       "apple_health",
      raw_data:     workout,
    };

    const { error } = await db.from("apple_health_workouts").insert(row);

    if (error) {
      // 23505 = unique_violation — expected on duplicate sends, skip silently
      if ((error as { code?: string }).code === "23505") {
        console.log(`[apple-health] Workout duplicate skipped: ${workout.name} @ ${workout.start}`);
      } else {
        console.error(
          `[apple-health] Workout error (${workout.name} @ ${workout.start}):`,
          error.message
        );
      }
    } else {
      workoutsInserted++;
    }
  }

  // ── Response ──────────────────────────────────────────────────────────────
  const result = { metrics_inserted: metricsInserted, workouts_inserted: workoutsInserted };
  if (deviceId) {
    await authDb.from("health_devices")
      .update({ last_seen_at: new Date().toISOString(), last_result: result })
      .eq("id", deviceId);
  }
  console.log("[apple-health] Complete:", result);
  return NextResponse.json(result, { status: 200 });
}
