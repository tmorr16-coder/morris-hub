import { createServiceClient } from "@/lib/supabase/server";
import { evaluateResult } from "@/lib/health/biomarkers";

/**
 * Turns raw health rows into an assessment a coach could reason from.
 *
 * The existing health chat takes its entire system prompt from the client, so
 * the advice was only ever as good as whatever the calling screen happened to
 * paste in — usually one screen's worth of today's numbers. Asking "how is my
 * training going?" got an answer built from a snapshot with no history in it.
 *
 * Everything here is computed, not generated. Trends, averages and adherence
 * are arithmetic; the model's job is to interpret them, which it can only do
 * honestly if the numbers arrive already correct. It also means the page can
 * show the same figures without paying for a model call.
 */

// Metric names vary by source (Apple, Oura, Withings all spell things
// differently), so every read goes through one alias list.
const ALIASES = {
  steps: ["step_count", "steps", "Step Count", "Steps"],
  activeEnergy: ["active_energy", "active_energy_burned", "calories", "Active Energy", "Active Energy Burned"],
  weight: ["weight", "Weight", "body_mass"],
  bodyFat: ["body_fat_percent", "body_fat", "Body Fat Percentage"],
  sleepMin: ["sleep_duration_min", "sleep_duration", "Sleep Analysis"],
  sleepScore: ["sleep_score"],
  readiness: ["readiness_score"],
  restingHr: ["resting_heart_rate", "Resting Heart Rate"],
  hrv: ["heart_rate_variability", "hrv", "Heart Rate Variability"],
} as const;

const ALL_METRICS = Object.values(ALIASES).flat();

export interface Trend {
  /** Mean over the recent window. Null when nothing was recorded. */
  recent: number | null;
  /** Mean over the window before it, for comparison. */
  previous: number | null;
  /** recent − previous. Positive means it went up. */
  change: number | null;
  /** How many days actually carry data — the honesty check on the average. */
  days: number;
}

export interface HealthAssessment {
  windowDays: number;
  weight: Trend;
  bodyFat: Trend;
  sleepMinutes: Trend;
  sleepScore: Trend;
  steps: Trend;
  activeEnergy: Trend;
  restingHr: Trend;
  hrv: Trend;
  readiness: Trend;
  /** Strength sessions logged in the app, per week. */
  strengthPerWeek: number;
  /** Device-recorded workouts (cardio and everything else), per week. */
  deviceWorkoutsPerWeek: number;
  /** Days in the window with at least one meal logged. */
  nutritionLoggedDays: number;
  /** Mean calories on days that were logged — not on all days. */
  avgCaloriesOnLoggedDays: number | null;
  /** Medication doses recorded in the window. */
  dosesLogged: number;
  /** Most recent lab panel, with each analyte's change since the draw before. */
  labs: LabSnapshot | null;
  /** Plain-language observations, strongest signal first. */
  signals: Signal[];
}

export interface LabResult {
  analyte: string;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  flag: string;
  /** Change from the previous panel that measured the same analyte. */
  change: number | null;
}

export interface LabSnapshot {
  collectedOn: string;
  panelName: string;
  results: LabResult[];
  outOfRange: LabResult[];
  /** In the lab's range but outside the optimal one — often the earlier signal. */
  borderline: LabResult[];
}

export interface Signal {
  kind: "good" | "watch" | "gap";
  area: "weight" | "sleep" | "activity" | "recovery" | "training" | "nutrition" | "medication" | "labs";
  text: string;
}

const dayKey = (iso: string) => iso.slice(0, 10);

/** Mean of a day→value map restricted to a date range. */
function meanBetween(byDay: Map<string, number[]>, fromKey: string, toKey: string): { mean: number | null; days: number } {
  let sum = 0;
  let days = 0;
  for (const [k, vals] of byDay) {
    if (k < fromKey || k >= toKey) continue;
    if (!vals.length) continue;
    // One value per day: several readings a day should not outweigh a day with
    // a single reading when we average across days.
    sum += vals.reduce((a, b) => a + b, 0) / vals.length;
    days += 1;
  }
  return { mean: days ? sum / days : null, days };
}

function trend(byDay: Map<string, number[]>, midKey: string, startKey: string, endKey: string): Trend {
  const recent = meanBetween(byDay, midKey, endKey);
  const previous = meanBetween(byDay, startKey, midKey);
  return {
    recent: recent.mean,
    previous: previous.mean,
    change: recent.mean != null && previous.mean != null ? recent.mean - previous.mean : null,
    days: recent.days,
  };
}

/**
 * Build the assessment for one user.
 *
 * `windowDays` is the recent window; the same length immediately before it is
 * used as the comparison, so "change" always compares like with like.
 */
export async function buildAssessment(userId: string, windowDays = 30): Promise<HealthAssessment> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const now = new Date();
  const endKey = dayKey(new Date(now.getTime() + 86_400_000).toISOString()); // exclusive
  const midKey = dayKey(new Date(now.getTime() - windowDays * 86_400_000).toISOString());
  const startKey = dayKey(new Date(now.getTime() - 2 * windowDays * 86_400_000).toISOString());
  const sinceIso = new Date(now.getTime() - 2 * windowDays * 86_400_000).toISOString();

  const [metricsRes, strengthRes, deviceRes, mealsRes, dosesRes, labs] = await Promise.all([
    db.from("apple_health_metrics")
      .select("metric_name, value, timestamp")
      .eq("user_id", userId)
      .in("metric_name", ALL_METRICS)
      .gte("timestamp", sinceIso),
    db.from("workout_sessions").select("date").eq("user_id", userId).gte("date", startKey),
    db.from("apple_health_workouts").select("timestamp").eq("user_id", userId).gte("timestamp", sinceIso),
    db.from("meals").select("date, calories_est").eq("user_id", userId).gte("date", midKey),
    db.from("doses").select("id").eq("user_id", userId).gte("date", startKey),
    loadLabs(db, userId),
  ]);

  // Bucket every metric by name → day → values.
  const byMetric = new Map<string, Map<string, number[]>>();
  for (const key of Object.keys(ALIASES)) byMetric.set(key, new Map());
  const aliasToKey = new Map<string, string>();
  for (const [key, names] of Object.entries(ALIASES)) for (const n of names) aliasToKey.set(n, key);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of ((metricsRes?.data ?? []) as any[])) {
    const key = aliasToKey.get(row.metric_name);
    if (!key) continue;
    const v = typeof row.value === "number" ? row.value : parseFloat(row.value);
    if (!Number.isFinite(v)) continue;
    const map = byMetric.get(key)!;
    const d = dayKey(String(row.timestamp));
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(v);
  }

  const t = (key: keyof typeof ALIASES) => trend(byMetric.get(key)!, midKey, startKey, endKey);

  // Sessions per week over the recent window.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const strengthDays = new Set(((strengthRes?.data ?? []) as any[]).filter((r) => dayKey(String(r.date)) >= midKey).map((r) => dayKey(String(r.date))));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceDays = new Set(((deviceRes?.data ?? []) as any[]).filter((r) => dayKey(String(r.timestamp)) >= midKey).map((r) => dayKey(String(r.timestamp))));
  const weeks = windowDays / 7;

  // Nutrition: averaged over days that were actually logged, because averaging
  // over all days would read as starvation on days nobody wrote anything down.
  const calByDay = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of ((mealsRes?.data ?? []) as any[])) {
    const d = dayKey(String(m.date));
    calByDay.set(d, (calByDay.get(d) ?? 0) + (Number(m.calories_est) || 0));
  }
  const loggedDays = [...calByDay.values()].filter((c) => c > 0);

  const assessment: HealthAssessment = {
    windowDays,
    weight: t("weight"),
    bodyFat: t("bodyFat"),
    sleepMinutes: t("sleepMin"),
    sleepScore: t("sleepScore"),
    steps: t("steps"),
    activeEnergy: t("activeEnergy"),
    restingHr: t("restingHr"),
    hrv: t("hrv"),
    readiness: t("readiness"),
    strengthPerWeek: +(strengthDays.size / weeks).toFixed(1),
    deviceWorkoutsPerWeek: +(deviceDays.size / weeks).toFixed(1),
    nutritionLoggedDays: loggedDays.length,
    avgCaloriesOnLoggedDays: loggedDays.length ? Math.round(loggedDays.reduce((a, b) => a + b, 0) / loggedDays.length) : null,
    dosesLogged: (dosesRes?.data ?? []).length,
    labs,
    signals: [],
  };

  assessment.signals = deriveSignals(assessment);
  return assessment;
}

/**
 * The latest labs, with each marker's change since it was last measured.
 *
 * Reads the health-records tables rather than a second set of its own: the
 * records module already models documents, a biomarker catalog and per-marker
 * reference ranges, and duplicating that would have produced two answers to
 * "what is my ApoB?".
 *
 * Status comes from evaluateResult, which trusts the lab's printed flag first,
 * then the range on that report, then the catalog — and distinguishes
 * "borderline" (inside the reference range, outside the optimal one) from
 * "normal". For markers like ApoB and hs-CRP that distinction is most of the
 * signal, and a plain in-range check would throw it away.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadLabs(db: any, userId: string): Promise<LabSnapshot | null> {
  try {
    const { data: rows } = await db
      .from("health_lab_results")
      .select("name, biomarker_key, panel, collected_on, value, value_text, unit, ref_low, ref_high, ref_text, flag")
      .eq("user_id", userId)
      .order("collected_on", { ascending: false })
      .limit(600);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = (rows ?? []) as any[];
    if (!all.length) return null;

    const latestDate = String(all[0].collected_on);
    const latest = all.filter((r) => String(r.collected_on) === latestDate);

    // The previous time each marker was measured — which is not necessarily the
    // previous panel, since panels do not all test the same things.
    const priorByKey = new Map<string, number>();
    for (const r of all) {
      if (String(r.collected_on) === latestDate) continue;
      const key = String(r.biomarker_key ?? r.name).toLowerCase();
      if (priorByKey.has(key)) continue; // rows are newest-first
      if (typeof r.value === "number") priorByKey.set(key, r.value);
    }

    const results: LabResult[] = latest.map((r) => {
      const value = typeof r.value === "number" ? r.value : null;
      const status = evaluateResult({
        value,
        refLow: r.ref_low,
        refHigh: r.ref_high,
        refText: r.ref_text,
        biomarkerKey: r.biomarker_key,
        labFlag: r.flag,
      });
      const prior = priorByKey.get(String(r.biomarker_key ?? r.name).toLowerCase());
      return {
        analyte: String(r.name),
        value,
        valueText: (r.value_text ?? null) as string | null,
        unit: (r.unit ?? null) as string | null,
        refLow: typeof r.ref_low === "number" ? r.ref_low : null,
        refHigh: typeof r.ref_high === "number" ? r.ref_high : null,
        refText: (r.ref_text ?? null) as string | null,
        flag: status,
        change: value != null && prior != null ? +(value - prior).toFixed(2) : null,
      };
    });

    return {
      collectedOn: latestDate,
      panelName: String(latest[0].panel ?? "Lab results"),
      results,
      outOfRange: results.filter((r) => r.flag === "high" || r.flag === "low"),
      borderline: results.filter((r) => r.flag === "borderline"),
    };
  } catch {
    // Records not set up — the rest of the assessment stands on its own.
    return null;
  }
}

const round = (n: number, p = 1) => +n.toFixed(p);

/**
 * The observations worth leading with.
 *
 * Deliberately conservative: a trend is only called out when there is enough
 * data behind it to mean something, and a gap in the data is reported as a gap
 * rather than as a health finding. Nothing here is a diagnosis — these are
 * descriptions of what the numbers did.
 */
function deriveSignals(a: HealthAssessment): Signal[] {
  const out: Signal[] = [];
  const enough = (tr: Trend, min = 5) => tr.days >= min && tr.recent != null;

  if (enough(a.weight) && a.weight.change != null && Math.abs(a.weight.change) >= 1) {
    const dir = a.weight.change < 0 ? "down" : "up";
    out.push({
      kind: "watch",
      area: "weight",
      text: `Weight is ${dir} ${Math.abs(round(a.weight.change))} lb versus the previous ${a.windowDays} days (now averaging ${round(a.weight.recent!)}).`,
    });
  }

  if (enough(a.sleepMinutes)) {
    const hrs = a.sleepMinutes.recent! / 60;
    out.push({
      kind: hrs >= 7 ? "good" : "watch",
      area: "sleep",
      text: `Averaging ${round(hrs)} hours of sleep across ${a.sleepMinutes.days} nights${
        a.sleepMinutes.change != null && Math.abs(a.sleepMinutes.change) >= 15
          ? `, ${a.sleepMinutes.change > 0 ? "up" : "down"} ${Math.abs(Math.round(a.sleepMinutes.change))} min on the previous period`
          : ""
      }.`,
    });
  }

  if (enough(a.restingHr) && a.restingHr.change != null && Math.abs(a.restingHr.change) >= 2) {
    const up = a.restingHr.change > 0;
    out.push({
      kind: up ? "watch" : "good",
      area: "recovery",
      text: `Resting heart rate is ${up ? "up" : "down"} ${Math.abs(round(a.restingHr.change))} bpm (now ${round(a.restingHr.recent!)}). ${
        up ? "Often follows harder training, worse sleep, or illness." : "Usually a sign recovery is keeping up with training."
      }`,
    });
  }

  if (enough(a.hrv) && a.hrv.change != null && Math.abs(a.hrv.change) >= 3) {
    const up = a.hrv.change > 0;
    out.push({
      kind: up ? "good" : "watch",
      area: "recovery",
      text: `HRV is ${up ? "up" : "down"} ${Math.abs(round(a.hrv.change))} ms (now ${round(a.hrv.recent!)}).`,
    });
  }

  const totalSessions = a.strengthPerWeek + a.deviceWorkoutsPerWeek;
  out.push({
    kind: totalSessions >= 3 ? "good" : "watch",
    area: "training",
    text: `${round(totalSessions)} sessions a week — ${a.strengthPerWeek} strength, ${a.deviceWorkoutsPerWeek} recorded by device.`,
  });

  if (enough(a.steps)) {
    out.push({
      kind: a.steps.recent! >= 8000 ? "good" : "watch",
      area: "activity",
      text: `${Math.round(a.steps.recent!).toLocaleString()} steps a day on average.`,
    });
  }

  // Gaps are reported as gaps. An empty log is not a health finding, and
  // treating it as one is how these tools start lying to people.
  if (a.nutritionLoggedDays < a.windowDays * 0.3) {
    out.push({
      kind: "gap",
      area: "nutrition",
      text: `Only ${a.nutritionLoggedDays} of the last ${a.windowDays} days have meals logged, so anything about diet is guesswork.`,
    });
  } else if (a.avgCaloriesOnLoggedDays) {
    out.push({
      kind: "good",
      area: "nutrition",
      text: `${a.avgCaloriesOnLoggedDays.toLocaleString()} kcal on the ${a.nutritionLoggedDays} days you logged.`,
    });
  }

  if (!enough(a.sleepMinutes)) {
    out.push({ kind: "gap", area: "sleep", text: "Not enough sleep data in this window to say anything useful." });
  }

  if (a.labs) {
    const when = a.labs.collectedOn;
    if (a.labs.outOfRange.length > 0) {
      out.push({
        kind: "watch",
        area: "labs",
        text: `${a.labs.outOfRange.length} result${a.labs.outOfRange.length === 1 ? "" : "s"} outside the reference range on ${when}: ${a.labs.outOfRange
          .slice(0, 6)
          .map((r) => `${r.analyte} ${r.value ?? r.valueText ?? "?"}${r.unit ? ` ${r.unit}` : ""}`)
          .join(", ")}. Worth your doctor's read, not mine.`,
      });
    } else {
      out.push({ kind: "good", area: "labs", text: `Nothing on the ${when} panel was flagged by the lab.` });
    }

    // Inside the lab's range but outside the optimal one. For markers like ApoB
    // and hs-CRP this is most of the signal, and "not flagged" hides it.
    if (a.labs.borderline.length > 0) {
      out.push({
        kind: "watch",
        area: "labs",
        text: `${a.labs.borderline.length} result${a.labs.borderline.length === 1 ? " is" : "s are"} inside the lab's range but outside the optimal one: ${a.labs.borderline
          .slice(0, 5)
          .map((r) => `${r.analyte} ${r.value ?? r.valueText ?? "?"}${r.unit ? ` ${r.unit}` : ""}`)
          .join(", ")}.`,
      });
    }

    // Movement inside the range is often the earlier signal, and nothing flags it.
    const movers = a.labs.results
      .filter((r) => r.change != null && r.value != null && r.refLow != null && r.refHigh != null)
      .map((r) => ({ r, frac: Math.abs(r.change!) / Math.max(1e-6, r.refHigh! - r.refLow!) }))
      .filter((m) => m.frac >= 0.25)
      .sort((x, y) => y.frac - x.frac)
      .slice(0, 3);
    if (movers.length) {
      out.push({
        kind: "watch",
        area: "labs",
        text: `Moved noticeably since the previous panel: ${movers
          .map(({ r }) => `${r.analyte} ${r.change! > 0 ? "+" : ""}${r.change}${r.unit ? ` ${r.unit}` : ""}`)
          .join(", ")}.`,
      });
    }
  }

  // Watch items first — the point of the list is what to act on.
  const order = { watch: 0, gap: 1, good: 2 };
  return out.sort((x, y) => order[x.kind] - order[y.kind]);
}

/** The assessment as compact prose, for a model's system prompt. */
export function assessmentToPrompt(a: HealthAssessment): string {
  const fmt = (t: Trend, unit: string, digits = 1) =>
    t.recent == null
      ? "no data"
      : `${t.recent.toFixed(digits)}${unit}${t.change != null ? ` (${t.change >= 0 ? "+" : ""}${t.change.toFixed(digits)}${unit} vs prior ${a.windowDays}d)` : ""} across ${t.days} days`;

  return [
    `Measured data for the last ${a.windowDays} days, compared with the ${a.windowDays} before it.`,
    `Weight: ${fmt(a.weight, " lb")}`,
    `Body fat: ${fmt(a.bodyFat, "%")}`,
    `Sleep: ${fmt(a.sleepMinutes, " min", 0)}`,
    `Sleep score: ${fmt(a.sleepScore, "", 0)}`,
    `Readiness: ${fmt(a.readiness, "", 0)}`,
    `Resting HR: ${fmt(a.restingHr, " bpm", 0)}`,
    `HRV: ${fmt(a.hrv, " ms", 0)}`,
    `Steps: ${fmt(a.steps, "/day", 0)}`,
    `Active energy: ${fmt(a.activeEnergy, " kcal/day", 0)}`,
    `Training: ${a.strengthPerWeek} strength sessions/week, ${a.deviceWorkoutsPerWeek} device-recorded workouts/week`,
    `Nutrition: ${a.nutritionLoggedDays} of ${a.windowDays} days logged${a.avgCaloriesOnLoggedDays ? `, averaging ${a.avgCaloriesOnLoggedDays} kcal on those days` : ""}`,
    `Medication doses recorded: ${a.dosesLogged}`,
    a.labs
      ? [
          "",
          `Most recent labs (${a.labs.panelName}, collected ${a.labs.collectedOn}):`,
          ...a.labs.results.map((r) => {
            const v = r.value != null ? `${r.value}${r.unit ? ` ${r.unit}` : ""}` : r.valueText ?? "—";
            const range = r.refLow != null && r.refHigh != null ? ` [ref ${r.refLow}–${r.refHigh}]` : r.refText ? ` [ref ${r.refText}]` : "";
            const delta = r.change != null ? ` (${r.change > 0 ? "+" : ""}${r.change} since previous panel)` : "";
            const flag = r.flag !== "normal" && r.flag !== "unknown" ? ` **${r.flag.toUpperCase()}**` : "";
            return `- ${r.analyte}: ${v}${range}${flag}${delta}`;
          }),
        ].join("\n")
      : "No lab results have been added.",
    "",
    "Where a figure says 'no data', say so rather than estimating it.",
    "Lab values are the person's own records. You may describe what a value measures and whether it moved, but interpreting an abnormal result is a clinician's job — say so plainly rather than offering a likely cause.",
  ].join("\n");
}
