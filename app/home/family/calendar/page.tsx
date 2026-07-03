export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFamilyCalendarEvents, getMonthGridRange, getWeekRange } from "@/lib/familyCalendar";
import { IOSScreen, LargeTitle, TabBar, Icons } from "@/components/ios";
import CalendarClient from "./_components/CalendarClient";

const userTz = "America/Indiana/Indianapolis";

export default async function FamilyCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const view = params.view === "week" ? "week" : "month";
  const todayStr = new Date().toLocaleDateString("sv", { timeZone: userTz });
  const anchorDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayStr;

  const { start, end } = view === "week" ? getWeekRange(anchorDate) : getMonthGridRange(anchorDate);
  const { events, members } = await getFamilyCalendarEvents(user.id, start, end, userTz);

  return (
    <IOSScreen>      <LargeTitle
        title="Calendar"
        subtitle="Reminders, tasks & kids' assignments across your circle"
        trailing={<Icons.CalendarIcon style={{ width: 26, height: 26, color: "var(--ios-label-2)" }} />}
      />

      <div style={{ padding: "0 16px" }}>
        <CalendarClient
          view={view}
          anchorDate={anchorDate}
          todayStr={todayStr}
          rangeStart={start}
          rangeEnd={end}
          events={events}
          members={members.map((m) => ({ id: m.id, label: m.label }))}
        />
      </div>

      <div style={{ height: 12 }} />
      <TabBar current="family" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
