import { createServiceClient } from "@/lib/supabase/server";
import type { MeDomainKey } from "@/lib/prefs-shared";

export interface RecommendedAction {
  text: string;
  estimatedMinutes: number;
  fitAdjustedText: string;
  fitStatus: "fits-now" | "shortened" | "deferred";
}

export interface DomainCardData {
  key: MeDomainKey;
  label: string;
  href: string;
  goal: string | null;
  progressPct: number | null;
  progressLabel: string;
  recommendedAction: RecommendedAction;
  disclaimer?: string;
}

interface FreeTimeWindow {
  freeMinutesNext2h: number;
}

interface RawAction {
  text: string;
  estimatedMinutes: number;
  shortText?: string;
}

export const MIND_DISCLAIMER_TEXT =
  "This is a personal coaching space, not clinical care. If you're struggling, please reach out to a mental health professional or crisis line.";

const DOMAIN_LABELS: Record<MeDomainKey, string> = {
  career: "Career",
  health: "Health",
  mind: "Mind",
  spirit: "Spirit",
};

const DOMAIN_HREFS: Record<MeDomainKey, string> = {
  career: "/career",
  health: "/health",
  mind: "/home/journal",
  spirit: "/bible/dashboard",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Svc = any;

/**
 * Deliberately simple density proxy for "does this fit the user's calendar" —
 * not a real free/busy engine. Counts reminders due in the next 2h and
 * whether anything is due today, and treats each as consuming a flat block.
 */
async function getFreeTimeWindow(db: Svc, userId: string, now: Date): Promise<FreeTimeWindow> {
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const todayStr = now.toISOString().slice(0, 10);

  const [remindersResult, todosResult] = await Promise.all([
    db.schema("hub").from("reminders")
      .select("id")
      .eq("user_id", userId)
      .is("completed_at", null)
      .gte("due_at", now.toISOString())
      .lte("due_at", in2h),
    db.schema("hub").from("todos")
      .select("id")
      .eq("user_id", userId)
      .eq("completed", false)
      .eq("due_date", todayStr)
      .limit(1),
  ]);

  const reminderCount = (remindersResult.data ?? []).length;
  const anyTodoToday = (todosResult.data ?? []).length > 0;

  const busyMinutes = Math.min(120, reminderCount * 15 + (anyTodoToday ? 15 : 0));
  return { freeMinutesNext2h: 120 - busyMinutes };
}

function applyCalendarFit(action: RawAction, freeWindow: FreeTimeWindow): RecommendedAction {
  if (freeWindow.freeMinutesNext2h >= action.estimatedMinutes) {
    return { ...action, fitAdjustedText: action.text, fitStatus: "fits-now" };
  }
  if (action.shortText) {
    return { ...action, fitAdjustedText: action.shortText, fitStatus: "shortened" };
  }
  return {
    ...action,
    fitAdjustedText: `${action.text} — when you have a free ${action.estimatedMinutes} min`,
    fitStatus: "deferred",
  };
}

async function getCareerDomain(db: Svc, userId: string, freeWindow: FreeTimeWindow): Promise<DomainCardData> {
  const { data: goal } = await db.schema("career").from("career_goals")
    .select("id, title, progress_pct")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!goal) {
    return {
      key: "career", label: DOMAIN_LABELS.career, href: DOMAIN_HREFS.career,
      goal: null, progressPct: null, progressLabel: "No active goal set",
      recommendedAction: applyCalendarFit({ text: "Set a career goal", estimatedMinutes: 5 }, freeWindow),
    };
  }

  const { data: nextMilestone } = await db.schema("career").from("career_milestones")
    .select("title")
    .eq("goal_id", goal.id)
    .eq("completed", false)
    .order("target_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const action: RawAction = nextMilestone
    ? { text: `Work on: ${nextMilestone.title}`, estimatedMinutes: 20, shortText: `Jot 2 quick notes on "${goal.title}"` }
    : { text: `Review progress on "${goal.title}"`, estimatedMinutes: 20, shortText: `Jot 2 quick notes on "${goal.title}"` };

  return {
    key: "career", label: DOMAIN_LABELS.career, href: DOMAIN_HREFS.career,
    goal: goal.title, progressPct: goal.progress_pct ?? 0,
    progressLabel: `${goal.progress_pct ?? 0}% complete`,
    recommendedAction: applyCalendarFit(action, freeWindow),
  };
}

// Health copy guardrail: tracking/coaching language only — never diagnostic.
// Do not introduce words like "symptoms," "condition," "diagnosis," or
// "you may have" into any string returned from this function.
async function getHealthDomain(db: Svc, userId: string, now: Date, freeWindow: FreeTimeWindow): Promise<DomainCardData> {
  const dow = now.getDay(); // 0 = Sunday
  const weekStart = new Date(now.getTime() - dow * 86_400_000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  const { data: weekWorkouts } = await db.from("scheduled_workouts")
    .select("id, label, scheduled_date, scheduled_time, completed")
    .eq("user_id", userId)
    .gte("scheduled_date", weekStartStr)
    .lte("scheduled_date", weekEndStr);

  const rows: { id: string; label: string; scheduled_date: string; completed: boolean }[] = weekWorkouts ?? [];
  const scheduledCount = rows.length;
  const completedCount = rows.filter((r) => r.completed).length;
  const nextWorkout = rows
    .filter((r) => !r.completed && r.scheduled_date >= todayStr)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))[0];

  const progressPct = scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : null;
  const progressLabel = scheduledCount > 0
    ? `${completedCount} of ${scheduledCount} workouts this week`
    : "No workouts scheduled this week";

  const action: RawAction = nextWorkout
    ? {
        text: nextWorkout.scheduled_date === todayStr ? `${nextWorkout.label} today` : `${nextWorkout.label} this week`,
        estimatedMinutes: 30,
        shortText: "Log today's meals",
      }
    : { text: "Schedule your next workout", estimatedMinutes: 10, shortText: "Log today's meals" };

  return {
    key: "health", label: DOMAIN_LABELS.health, href: DOMAIN_HREFS.health,
    goal: scheduledCount > 0 ? `${scheduledCount} workouts this week` : null,
    progressPct, progressLabel,
    recommendedAction: applyCalendarFit(action, freeWindow),
  };
}

async function getMindDomain(db: Svc, userId: string, now: Date, freeWindow: FreeTimeWindow): Promise<DomainCardData> {
  const todayStr = now.toISOString().slice(0, 10);

  const [{ data: lastEntry }, { data: lastMood }] = await Promise.all([
    db.schema("hub").from("journal_entries")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("wellness_entries")
      .select("date")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const loggedMoodToday = lastMood?.date === todayStr;
  const daysSinceJournal = lastEntry
    ? Math.floor((now.getTime() - new Date(lastEntry.created_at).getTime()) / 86_400_000)
    : null;

  const progressLabel = loggedMoodToday
    ? "Checked in today"
    : lastEntry
      ? `Last journal entry ${daysSinceJournal}d ago`
      : "No check-ins yet";

  const action: RawAction = loggedMoodToday
    ? { text: "Write a quick journal entry", estimatedMinutes: 10, shortText: "Rate your mood (10 seconds)" }
    : { text: "Log how you're feeling today", estimatedMinutes: 2, shortText: "Rate your mood (10 seconds)" };

  return {
    key: "mind", label: DOMAIN_LABELS.mind, href: DOMAIN_HREFS.mind,
    goal: "Daily check-in habit", progressPct: null, progressLabel,
    recommendedAction: applyCalendarFit(action, freeWindow),
    disclaimer: MIND_DISCLAIMER_TEXT,
  };
}

interface PlanDay {
  day: number;
  readings?: string[];
  reference?: string;
}

async function getSpiritDomain(db: Svc, userId: string, freeWindow: FreeTimeWindow): Promise<DomainCardData> {
  const { data: userPlan } = await db.schema("bible").from("user_plans")
    .select("plan_id, plan:reading_plans(title, duration_days, readings)")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!userPlan?.plan) {
    return {
      key: "spirit", label: DOMAIN_LABELS.spirit, href: DOMAIN_HREFS.spirit,
      goal: null, progressPct: null, progressLabel: "No active reading plan",
      recommendedAction: applyCalendarFit({ text: "Browse reading plans", estimatedMinutes: 5 }, freeWindow),
    };
  }

  const { data: completions } = await db.schema("bible").from("reading_completions")
    .select("day_number, reading_ref")
    .eq("user_id", userId)
    .eq("plan_id", userPlan.plan_id);

  const completedKeys = new Set(
    ((completions ?? []) as { day_number: number; reading_ref: string }[]).map((c) => `${c.day_number}:${c.reading_ref}`)
  );

  const readings: PlanDay[] = userPlan.plan.readings ?? [];
  let totalReadings = 0;
  let completedReadings = 0;
  let nextRef: string | null = null;

  for (const day of readings) {
    const dayRefs = day.readings ?? (day.reference ? [day.reference] : []);
    for (const ref of dayRefs) {
      totalReadings++;
      const done = completedKeys.has(`${day.day}:${ref}`);
      if (done) completedReadings++;
      else if (!nextRef) nextRef = ref;
    }
  }

  const progressPct = totalReadings > 0 ? Math.round((completedReadings / totalReadings) * 100) : 0;

  const action: RawAction = nextRef
    ? { text: `Read: ${nextRef}`, estimatedMinutes: 10 }
    : { text: "Plan complete — start a new one", estimatedMinutes: 5 };

  return {
    key: "spirit", label: DOMAIN_LABELS.spirit, href: DOMAIN_HREFS.spirit,
    goal: userPlan.plan.title, progressPct, progressLabel: `${completedReadings} of ${totalReadings} readings done`,
    recommendedAction: applyCalendarFit(action, freeWindow),
  };
}

export async function getMeDomainData(userId: string, now: Date): Promise<DomainCardData[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const freeWindow = await getFreeTimeWindow(db, userId, now);

  const [career, health, mind, spirit] = await Promise.all([
    getCareerDomain(db, userId, freeWindow),
    getHealthDomain(db, userId, now, freeWindow),
    getMindDomain(db, userId, now, freeWindow),
    getSpiritDomain(db, userId, freeWindow),
  ]);

  return [career, health, mind, spirit];
}
