import { fetchQuotes } from "@/lib/stocks";
import { fetchTickerNews } from "@/lib/news";
import { Group, Cell, IconBadge, Icons } from "@/components/ios";

// Company watch — the employer ticker's price + latest headlines, streamed.
export default async function TodayMarkets({ ticker }: { ticker: string }) {
  const t = (ticker || "LLY").toUpperCase();
  const [quote, news] = await Promise.all([
    fetchQuotes([t]).then((q) => q[0] ?? null).catch(() => null),
    fetchTickerNews(t, t).then((n) => n.slice(0, 2)).catch(() => []),
  ]);
  if (!quote && news.length === 0) return null;

  return (
    <Group header={`${t} · company watch`}>
      {quote && (
        <Cell
          chevron={false}
          href="/investments/stocks"
          lead={<IconBadge color="var(--ios-finance)"><Icons.TrendUpIcon /></IconBadge>}
          title={quote.shortName || t}
          subtitle={quote.marketState ?? undefined}
          trailing={
            <span className="ios-num" style={{ fontWeight: 600, color: quote.change >= 0 ? "var(--ios-green)" : "var(--ios-red)" }}>
              ${quote.price.toFixed(2)} {quote.change >= 0 ? "▲" : "▼"}{Math.abs(quote.changePercent).toFixed(2)}%
            </span>
          }
        />
      )}
      {news.map((n, i) => (
        <Cell key={i} href={n.url} lead={<IconBadge color="#9A3B2A"><Icons.NewsIcon /></IconBadge>} title={n.headline} subtitle={n.source} />
      ))}
    </Group>
  );
}
