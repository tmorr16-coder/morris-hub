export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import { getUserTimezone } from "@/lib/timezone";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";
import { renderWidget } from "@/app/home/_lib/renderWidget";
import { WIDGET_LABELS } from "@/app/home/settings/_components/SettingsForm";

const NEWS_PAGE_WIDGETS = new Set(["news", "city_news", "lly_news", "news_subscriptions", "sports"]);

export default async function NewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const prefs = await getPreferences(user.id);
  const newsWids = prefs.visible_widgets.filter((w) => NEWS_PAGE_WIDGETS.has(w));

  const ctx = {
    prefs,
    todos: [],
    reminders: null,
    userTz: getUserTimezone(user.user_metadata),
    activeCareerGoals: 0,
    user,
  };

  return (
    <div className="ios-scroll">
      <LargeTitle brand title="News" subtitle="Topics, subscriptions, sports & company" />

      {newsWids.length === 0 ? (
        <Group header="Your feed" footer="You've turned off all news widgets.">
          <Cell
            lead={<IconBadge color="#9A3B2A"><Icons.NewsIcon /></IconBadge>}
            title="Enable news widgets"
            subtitle="Choose topics, sources & sports"
            href="/home/settings"
          />
        </Group>
      ) : (
        newsWids.map((widgetId) => {
          const widget = renderWidget(widgetId, ctx);
          if (!widget) return null;
          return (
            <section key={widgetId} aria-label={WIDGET_LABELS[widgetId]} style={{ marginTop: 18 }}>
              <h2 className="ios-group-header">{WIDGET_LABELS[widgetId]}</h2>
              <div style={{ padding: "0 16px" }}>{widget}</div>
            </section>
          );
        })
      )}

      <Group header="Following">
        <Cell
          lead={<IconBadge color="#9A3B2A"><Icons.NewsIcon /></IconBadge>}
          title="Manage sources & topics"
          subtitle="Customize your feed"
          href="/home/settings"
        />
      </Group>

      <div style={{ height: 12 }} />
    </div>
  );
}
