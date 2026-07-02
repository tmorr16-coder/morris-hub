import { createServiceClient } from "@/lib/supabase/server";
import { computeAgeTier, computeAge, type AgeTier } from "@/lib/ageTier";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Svc = any;

export interface ChildCardSummary {
  childId: string;
  memberUserId: string | null;
  name: string;
  initial: string;
  ageTier: AgeTier;
  age: number | null;
  todaysScheduleItem: string | null;
  upcomingDeadline: { title: string; dueDate: string } | null;
  currentGoal: string | null;
  attentionItem: string | null;
}

export interface ChildActivity {
  id: string;
  category: "school" | "sports" | "church" | "other";
  title: string;
  notes: string | null;
  dueAt: string | null;
  completed: boolean;
}

export interface ChildHealthNote {
  id: string;
  note: string;
  targetVisitDate: string | null;
  resolved: boolean;
}

export interface AcademicsSummary {
  courses: { id: string; name: string; instructor: string | null }[];
  upcomingAssignments: { id: string; title: string; dueDate: string }[];
}

export interface ChildWorkspaceData {
  childId: string;
  memberUserId: string | null;
  name: string;
  ageTier: AgeTier;
  age: number | null;
  hasOwnAccount: boolean;
  activities: ChildActivity[];
  healthNotes: ChildHealthNote[];
  goals: { title: string; progressPct: number | null }[];
  academicsSummary: AcademicsSummary | null;
}

function nameFor(row: { display_name: string | null; member_user_id: string | null }, userMap: Map<string, { full_name: string | null; email: string | null }>): string {
  return row.display_name
    ?? (row.member_user_id ? userMap.get(row.member_user_id)?.full_name : null)
    ?? (row.member_user_id ? userMap.get(row.member_user_id)?.email : null)
    ?? "Child";
}

/** Only genuine exceptions surface here — never a running feed of normal activity. */
async function computeAttentionItem(db: Svc, childFamilyMemberId: string, now: Date): Promise<string | null> {
  const [{ data: overdueActivity }, { data: overdueHealthNote }] = await Promise.all([
    db.schema("hub").from("child_activities")
      .select("title")
      .eq("child_id", childFamilyMemberId)
      .eq("completed", false)
      .lt("due_at", now.toISOString())
      .order("due_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    db.schema("hub").from("child_health_notes")
      .select("note")
      .eq("child_id", childFamilyMemberId)
      .eq("resolved", false)
      .lt("target_visit_date", now.toISOString().slice(0, 10))
      .order("target_visit_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (overdueActivity) return `Overdue: ${overdueActivity.title}`;
  if (overdueHealthNote) return `Health note past target date`;
  return null;
}

export async function listChildrenForParent(parentUserId: string, now: Date): Promise<ChildCardSummary[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: rows } = await db.schema("hub").from("family_members")
    .select("id, member_user_id, display_name, birth_year, life_stage_override")
    .eq("user_id", parentUserId)
    .eq("role", "child");

  const children = (rows ?? []) as {
    id: string; member_user_id: string | null; display_name: string | null;
    birth_year: number | null; life_stage_override: AgeTier | null;
  }[];
  if (children.length === 0) return [];

  const accountIds = children.map((c) => c.member_user_id).filter((id): id is string => !!id);
  const userMap = new Map<string, { full_name: string | null; email: string | null }>();
  if (accountIds.length > 0) {
    const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const u of (users?.users ?? []) as any[]) {
      userMap.set(u.id, {
        full_name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
        email: u.email ?? null,
      });
    }
  }

  const todayStr = now.toISOString().slice(0, 10);
  const horizonStr = new Date(now.getTime() + 14 * 86_400_000).toISOString();

  return Promise.all(children.map(async (c) => {
    const name = nameFor(c, userMap);
    const ageTier = computeAgeTier(c.birth_year, c.life_stage_override, now);
    const age = computeAge(c.birth_year, now);

    const [{ data: todayActivity }, { data: nextDeadline }, attentionItem] = await Promise.all([
      db.schema("hub").from("child_activities")
        .select("title")
        .eq("child_id", c.id)
        .eq("completed", false)
        .gte("due_at", `${todayStr}T00:00:00`)
        .lt("due_at", `${todayStr}T23:59:59`)
        .order("due_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      db.schema("hub").from("child_activities")
        .select("title, due_at")
        .eq("child_id", c.id)
        .eq("completed", false)
        .gte("due_at", now.toISOString())
        .lte("due_at", horizonStr)
        .order("due_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      computeAttentionItem(db, c.id, now),
    ]);

    return {
      childId: c.id,
      memberUserId: c.member_user_id,
      name,
      initial: name.slice(0, 1).toUpperCase(),
      ageTier,
      age,
      todaysScheduleItem: todayActivity?.title ?? null,
      upcomingDeadline: nextDeadline ? { title: nextDeadline.title, dueDate: nextDeadline.due_at } : null,
      currentGoal: null,
      attentionItem,
    };
  }));
}

export async function getChildWorkspace(childId: string, viewerUserId: string, now: Date): Promise<ChildWorkspaceData | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: row } = await db.schema("hub").from("family_members")
    .select("id, user_id, member_user_id, display_name, birth_year, life_stage_override")
    .eq("id", childId)
    .maybeSingle();
  if (!row) return null;

  // Defense in depth: viewer must be the owning parent or the child themselves.
  const isParent = row.user_id === viewerUserId;
  const isSelf = row.member_user_id === viewerUserId;
  if (!isParent && !isSelf) return null;

  let name = row.display_name;
  if (!name && row.member_user_id) {
    const { data: authUser } = await db.auth.admin.getUserById(row.member_user_id);
    name = authUser?.user?.user_metadata?.full_name ?? authUser?.user?.user_metadata?.name ?? authUser?.user?.email ?? "Child";
  }
  name = name ?? "Child";

  const ageTier = computeAgeTier(row.birth_year, row.life_stage_override, now);
  const age = computeAge(row.birth_year, now);

  const [{ data: activityRows }, { data: healthRows }] = await Promise.all([
    db.schema("hub").from("child_activities")
      .select("id, category, title, notes, due_at, completed")
      .eq("child_id", childId)
      .order("due_at", { ascending: true, nullsFirst: false }),
    db.schema("hub").from("child_health_notes")
      .select("id, note, target_visit_date, resolved")
      .eq("child_id", childId)
      .order("created_at", { ascending: false }),
  ]);

  const activities: ChildActivity[] = ((activityRows ?? []) as { id: string; category: string; title: string; notes: string | null; due_at: string | null; completed: boolean }[])
    .map((a) => ({
      id: a.id,
      category: a.category as ChildActivity["category"],
      title: a.title,
      notes: a.notes,
      dueAt: a.due_at,
      completed: a.completed,
    }));

  const healthNotes: ChildHealthNote[] = ((healthRows ?? []) as { id: string; note: string; target_visit_date: string | null; resolved: boolean }[])
    .map((h) => ({ id: h.id, note: h.note, targetVisitDate: h.target_visit_date, resolved: h.resolved }));

  let academicsSummary: AcademicsSummary | null = null;
  if (ageTier === "college" && row.member_user_id) {
    const { data: shares } = await db.schema("student_support").from("course_shares")
      .select("course:courses(id, name, instructor)")
      .eq("owner_user_id", row.member_user_id)
      .eq("shared_with_user_id", isParent ? viewerUserId : row.user_id);
    const sharedCourses = ((shares ?? []) as { course: { id: string; name: string; instructor: string | null } | null }[])
      .filter((s) => s.course)
      .map((s) => s.course as { id: string; name: string; instructor: string | null });

    let upcomingAssignments: { id: string; title: string; dueDate: string }[] = [];
    if (sharedCourses.length > 0) {
      const { data: reminders } = await db.schema("student_support").from("course_reminders")
        .select("id, title, due_date")
        .in("course_id", sharedCourses.map((c) => c.id))
        .eq("is_completed", false)
        .order("due_date", { ascending: true })
        .limit(5);
      upcomingAssignments = ((reminders ?? []) as { id: string; title: string; due_date: string }[])
        .map((r) => ({ id: r.id, title: r.title, dueDate: r.due_date }));
    }
    academicsSummary = { courses: sharedCourses, upcomingAssignments };
  }

  return {
    childId,
    memberUserId: row.member_user_id,
    name,
    ageTier,
    age,
    hasOwnAccount: !!row.member_user_id,
    activities,
    healthNotes,
    goals: [],
    academicsSummary,
  };
}
