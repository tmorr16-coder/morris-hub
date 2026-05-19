import { fetchTickerNews } from "@/lib/news";

export default async function LLYNewsWidget() {
  const items = await fetchTickerNews("LLY", "Eli Lilly and Company");

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 20 }}>
          LLY <span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>news</span>
        </h2>
        <span style={{ fontSize: 10, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Eli Lilly
        </span>
      </div>

      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "20px 0", textAlign: "center" }}>
          No recent LLY headlines.
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
                padding: "10px 0",
                borderTop: idx === 0 ? undefined : "1px solid var(--color-rule-soft)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--color-ink)", fontWeight: 500, lineHeight: 1.4, marginBottom: 3 }}>
                {it.headline}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-ink-3)", lineHeight: 1.5 }}>
                {it.summary}
              </div>
              <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 4, display: "flex", gap: 8 }}>
                <span>{it.source}</span>
                {it.publishedAt && <span>· {it.publishedAt}</span>}
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
  padding: "18px 20px",
  boxShadow: "var(--shadow-card)",
  minHeight: 320,
  height: "100%",
  boxSizing: "border-box" as const,
};
