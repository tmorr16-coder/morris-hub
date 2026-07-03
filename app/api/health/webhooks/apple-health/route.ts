import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_USER_ID } from "@/lib/health/auth";

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const BATCH = 500;

// ── route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Authentication ────────────────────────────────────────────────────────
  // Health Auto Export sends the secret in the "api-key" header.
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
  const userId = searchParams.get("userId") || DEV_USER_ID;

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
          ignoreDuplicates: true,
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
  // There is no unique index on apple_health_workouts, so we dedupe in code:
  // fetch the (start, type) keys already stored for the incoming timestamps and
  // skip anything already present, plus guard against duplicates within a single
  // payload (Health Auto Export can repeat a workout in the same batch).
  const seenWorkoutKeys = new Set<string>();
  if (workouts.length > 0) {
    const incomingTs = Array.from(new Set(workouts.map((w) => w.start)));
    const { data: existing } = await db
      .from("apple_health_workouts")
      .select("timestamp, workout_type")
      .eq("user_id", userId)
      .in("timestamp", incomingTs);
    for (const r of (existing ?? []) as { timestamp: string; workout_type: string }[]) {
      seenWorkoutKeys.add(`${r.timestamp}|${r.workout_type}`);
    }
  }

  for (const workout of workouts) {
    const key = `${workout.start}|${workout.name}`;
    if (seenWorkoutKeys.has(key)) {
      console.log(`[apple-health] Workout duplicate skipped: ${workout.name} @ ${workout.start}`);
      continue;
    }
    seenWorkoutKeys.add(key);

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
  console.log("[apple-health] Complete:", result);
  return NextResponse.json(result, { status: 200 });
}
