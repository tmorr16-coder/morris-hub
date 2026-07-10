import { fetchNews } from "@/lib/news";
import NewsClient from "./NewsClient";

export default async function NewsWidget({ topics }: { topics: string[] }) {
  const items = await fetchNews(topics);

  // Group by topic, keep up to 5 per topic for the client-side next/prev
  const byTopic: Record<string, typeof items> = {};
  for (const it of items) {
    if (!byTopic[it.topic]) byTopic[it.topic] = [];
    if (byTopic[it.topic].length < 5) byTopic[it.topic].push(it);
  }

  return (
    <div style={card}>
      <div style={header}>
        <span className="ios-headline">News</span>
        <span
          className="ios-footnote ios-truncate"
          style={{ color: "var(--ios-label-2)", maxWidth: "55%" }}
        >
          {topics.join(" · ")}
        </span>
      </div>
      <NewsClient byTopic={byTopic} />
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ios-cell)",
  borderRadius: "var(--ios-radius-card)",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
  padding: "12px 16px 6px",
};
