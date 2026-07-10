import { fetchSubscriptionFeeds, fetchNews } from "@/lib/news";
import { Group, Cell, IconBadge, Icons } from "@/components/ios";

type Source = { id: string; name: string; rss: string; enabled: boolean };

type Item = { title: string; url: string; source: string };

// News up front — a MIX of the user's subscription feeds and topic headlines,
// interleaved so it's never just one source (e.g. not only Medium). Streamed.
export default async function TodayNews({ sources, topics }: { sources: Source[]; topics?: string[] }) {
  const enabled = (sources ?? []).filter((s) => s?.enabled);
  const topicList = (topics ?? []).filter(Boolean);

  const [subs, topical] = await Promise.all([
    enabled.length > 0
      ? fetchSubscriptionFeeds(enabled).then((x) => x.slice(0, 4)).catch(() => [])
      : Promise.resolve([]),
    topicList.length > 0
      ? fetchNews(topicList).then((x) => x.slice(0, 4)).catch(() => [])
      : Promise.resolve([]),
  ]);

  const subItems: Item[] = subs.map((n) => ({ title: n.title, url: n.url, source: n.sourceName }));
  const topicItems: Item[] = topical.map((n) => ({ title: n.headline, url: n.url, source: n.source }));

  // Interleave topic + subscription items so the feed is a genuine mix.
  const mixed: Item[] = [];
  const max = Math.max(subItems.length, topicItems.length);
  for (let i = 0; i < max; i++) {
    if (topicItems[i]) mixed.push(topicItems[i]);
    if (subItems[i]) mixed.push(subItems[i]);
  }
  const items = mixed.slice(0, 6);
  if (items.length === 0) return null;

  return (
    <Group header="News" footer="A mix of your topics and subscriptions.">
      {items.map((n, i) => (
        <Cell key={i} href={n.url} lead={<IconBadge color="#9A3B2A"><Icons.NewsIcon /></IconBadge>} title={n.title} subtitle={n.source} />
      ))}
    </Group>
  );
}
