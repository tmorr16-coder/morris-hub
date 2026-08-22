export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import { getUserTimezone } from "@/lib/timezone";
import { getAllUpcomingReminders, type Reminder } from "@/lib/reminders";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import RemindersWidget from "../_components/RemindersWidget";
import TodosWidget from "../_components/TodosWidget";
import type { Todo } from "../actions";

// One logical home for reminders + to-dos, where every item can be added,
// completed, edited, snoozed, or deleted. The Today hub links here.
export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const prefs = await getPreferences(user.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const [todoResult, reminders] = await Promise.all([
    service.schema("hub").from("todos")
      .select("id, title, completed, notes, due_date, priority, created_at")
      .eq("user_id", user.id)
      .order("completed", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200),
    getAllUpcomingReminders(user.id).catch(() => [] as Reminder[]),
  ]);
  const todos = (todoResult.data ?? []) as Todo[];

  return (
    <IOSScreen>
      <LargeTitle brand title="Tasks & reminders" subtitle="Add, complete, edit, or delete — all in one place" />

      <div style={{ padding: "0 16px" }}>
        <RemindersWidget initialReminders={reminders} tz={getUserTimezone(user.user_metadata)} categories={prefs.reminder_categories} />
        <div style={{ height: 16 }} />
        <TodosWidget initialTodos={todos} />
      </div>

      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
