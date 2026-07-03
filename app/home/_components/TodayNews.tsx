import { fetchSubscriptionFeeds } from "@/lib/news";
import { Group, Cell, IconBadge, Icons } from "@/components/ios";

type Source = { id: string; name: string; rss: string; enabled: boolean };

// News up front — latest articles from Terry's subscription feeds, streamed.
export default async function TodayNews({ sources }: { sources: Source[] }) {
  const enabled = (sources ?? []).filter((s) => s?.enabled);
  if (enabled.length === 0) return null;
  const items = await fetchSubscriptionFeeds(enabled).then((x) => x.slice(0, 4)).catch(() => []);
  if (items.length === 0) return null;

  return (
    <Group header="News" footer="From your subscriptions.">
      {items.map((n, i) => (
        <Cell key={i} href={n.url} lead={<IconBadge color="#9A3B2A"><Icons.NewsIcon /></IconBadge>} title={n.title} subtitle={n.sourceName} />
      ))}
    </Group>
  );
}
