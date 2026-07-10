import Link from "next/link";
import { fetchTickerNews } from "@/lib/news";
import { IconBadge, Icons } from "@/components/ios";

interface Props {
  ticker: string; // e.g. "LLY", "NVDA"
}

export default async function CompanyNewsWidget({ ticker }: Props) {
  const upper = ticker.toUpperCase();
  const items = await fetchTickerNews(upper, upper);

  return (
    <div style={card}>
      <div style={header}>
        <span className="ios-headline">{upper} news</span>
        <Link href="/home/settings" className="ios-footnote" style={{ color: "var(--ios-tint)" }}>
          Company news
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="ios-footnote" style={{ color: "var(--ios-label-3)", padding: "24px 16px", textAlign: "center" }}>
          No recent {upper} headlines.
        </p>
      ) : (
        <div>
          {items.map((it, idx) => (
            <a
              key={`${it.url}-${idx}`}
              href={it.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ios-cell"
              style={{ alignItems: "flex-start", color: "inherit" }}
            >
              <span className="ios-cell-lead" style={{ marginTop: 2 }}>
                <IconBadge color="#3B5C7F">
                  <Icons.NewsIcon />
                </IconBadge>
              </span>
              <span className="ios-cell-body">
                <span
                  className="ios-cell-title"
                  style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}
                >
                  {it.headline}
                </span>
                <span className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
                  {it.summary}
                </span>
                <span
                  className="ios-caption"
                  style={{ color: "var(--ios-label-3)", marginTop: 3, display: "flex", gap: 6 }}
                >
                  <span>{it.source}</span>
                  {it.publishedAt && <span>· {it.publishedAt}</span>}
                </span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--ios-cell)",
  borderRadius: "var(--ios-radius-card)",
  overflow: "hidden",
  minHeight: 320,
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
  padding: "12px 16px 6px",
};
