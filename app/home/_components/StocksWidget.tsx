import { fetchQuotes } from "@/lib/stocks";
import { IconBadge, Icons } from "@/components/ios";

function fmt(n: number): string {
  return n.toFixed(2);
}

export default async function StocksWidget({ tickers }: { tickers: string[] }) {
  const quotes = await fetchQuotes(tickers);
  const missing = tickers.filter((t) => !quotes.some((q) => q.symbol.toUpperCase() === t.toUpperCase()));

  return (
    <div style={card}>
      <div style={header}>
        <span className="ios-headline">Stocks</span>
        <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
          {quotes[0]?.marketState ?? "—"}
        </span>
      </div>

      {tickers.length === 0 ? (
        <p className="ios-footnote" style={{ color: "var(--ios-label-3)", padding: "24px 16px", textAlign: "center" }}>
          No tickers set. Add some in{" "}
          <a href="/home/settings" style={{ color: "var(--ios-tint)" }}>Settings</a>.
        </p>
      ) : quotes.length === 0 ? (
        <div style={{ padding: "20px 16px", textAlign: "center" }}>
          <p className="ios-subhead" style={{ color: "var(--ios-label-2)", marginBottom: 6 }}>
            Stock quotes are temporarily unavailable.
          </p>
          <p className="ios-caption" style={{ color: "var(--ios-label-3)" }}>
            Tickers: {tickers.join(" · ")}<br />
            Try again in a few minutes.
          </p>
        </div>
      ) : (
        <div>
          {quotes.map((q) => {
            const positive = q.change >= 0;
            const tone = positive ? "var(--ios-green)" : "var(--ios-red)";
            return (
              <div key={q.symbol} className="ios-cell">
                <span className="ios-cell-lead">
                  <IconBadge color={tone}>
                    {positive ? <Icons.TrendUpIcon /> : <TrendDownIcon />}
                  </IconBadge>
                </span>
                <span className="ios-cell-body">
                  <span className="ios-cell-title ios-num" style={{ fontWeight: 600 }}>
                    {q.symbol}
                  </span>
                  <span className="ios-cell-sub ios-truncate">{q.shortName}</span>
                </span>
                <span className="ios-cell-trail" style={{ flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                  <span className="ios-num" style={{ fontSize: 15, color: "var(--ios-label)", fontWeight: 500 }}>
                    ${fmt(q.price)}
                  </span>
                  <span className="ios-num ios-caption" style={{ color: tone, fontWeight: 600 }}>
                    {positive ? "+" : ""}{fmt(q.changePercent)}%
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {quotes.length > 0 && missing.length > 0 && (
        <p className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "10px 16px", textAlign: "center" }}>
          Unavailable: {missing.join(", ")}
        </p>
      )}
    </div>
  );
}

function TrendDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" aria-hidden>
      <path d="M4 9l5 5 3-3 8 8M15 19h5v-5" />
    </svg>
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
