export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import { getFamilyCalendarEvents, getMonthGridRange, getWeekRange } from "@/lib/familyCalendar";
import PlatformMenu from "@/components/PlatformMenu";
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

  const prefs = await getPreferences(user.id);

  const params = await searchParams;
  const view = params.view === "week" ? "week" : "month";
  const todayStr = new Date().toLocaleDateString("sv", { timeZone: userTz });
  const anchorDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayStr;

  const { start, end } = view === "week" ? getWeekRange(anchorDate) : getMonthGridRange(anchorDate);
  const { events, members } = await getFamilyCalendarEvents(user.id, start, end, userTz);

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    appAccess: prefs.app_access ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="hub" user={menuUser} />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 100px" }}>
        <h1 className="serif" style={{ fontSize: 32, marginBottom: 6 }}>
          Family Calendar
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 24, lineHeight: 1.6, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          Reminders, tasks, and kids&apos; assignments across your family circle.
        </p>

        <CalendarClient
          view={view}
          anchorDate={anchorDate}
          todayStr={todayStr}
          rangeStart={start}
          rangeEnd={end}
          events={events}
          members={members.map((m) => ({ id: m.id, label: m.label }))}
        />
      </main>
    </div>
  );
}
