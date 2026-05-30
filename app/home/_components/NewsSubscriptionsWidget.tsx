import { fetchSubscriptionFeeds } from "@/lib/news";
import type { NewsSource } from "@/lib/prefs-shared";
import NewsSubscriptionsClient from "./NewsSubscriptionsClient";

interface Props {
  sources: NewsSource[];
}

export default async function NewsSubscriptionsWidget({ sources }: Props) {
  const articles = await fetchSubscriptionFeeds(sources);
  const enabledSources = sources.filter((s) => s.enabled);

  return (
    <NewsSubscriptionsClient
      articles={articles}
      sources={enabledSources}
    />
  );
}
