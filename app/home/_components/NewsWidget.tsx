import { fetchNews } from "@/lib/news";

const TOPIC_COLORS: Record<string, string> = {
  politics: "#9A3B2A",
  ai: "#3B5C7F",
  claude: "#7B5BA2",
};

export default async function NewsWidget({ topics }: { topics: string[] }) {
  // Use Next.js fetch revalidate elsewhere; here we just call once per server render.
  // For real caching, this could be wrapped with unstable_cache.
  const items = await fetchNews(topics);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 22 }}>News</h2>
        <span style={{ fontSize: 10, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {topics.map((t) => t).join(" · ")}
        </span>
      </div>

      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "30px 0", textAlign: "center" }}>
          No news fetched yet. Claude refreshes this on each cold render.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map((it, idx) => (
            <a
              key={`${it.url}-${idx}`}
              href={it.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                padding: "12px 0",
                borderTop: idx === 0 ? undefined : "1px solid var(--color-rule-soft)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: TOPIC_COLORS[it.topic] ?? "var(--color-ink-3)",
                    minWidth: 60,
                  }}
                >
                  {it.topic}
                </span>
                <span style={{ fontSize: 13, color: "var(--color-ink)", fontWeight: 500, lineHeight: 1.4 }}>
                  {it.headline}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginLeft: 70, lineHeight: 1.5 }}>
                {it.summary}
              </div>
              <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginLeft: 70, marginTop: 3 }}>
                {it.source}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: 12,
  padding: "20px 24px",
  boxShadow: "var(--shadow-card)",
  minHeight: 220,
};
