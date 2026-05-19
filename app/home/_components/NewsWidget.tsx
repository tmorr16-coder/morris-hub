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
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 22 }}>News</h2>
        <span style={{ fontSize: 10, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {topics.join(" · ")}
        </span>
      </div>
      <NewsClient byTopic={byTopic} />
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: 12,
  padding: "20px 24px",
  boxShadow: "var(--shadow-card)",
  height: "100%",
  boxSizing: "border-box",
};
