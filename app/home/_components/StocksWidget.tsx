import { fetchQuotes } from "@/lib/stocks";

function fmt(n: number): string {
  return n.toFixed(2);
}

export default async function StocksWidget({ tickers }: { tickers: string[] }) {
  const quotes = await fetchQuotes(tickers);
  const missing = tickers.filter((t) => !quotes.some((q) => q.symbol.toUpperCase() === t.toUpperCase()));

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 20 }}>Stocks</h2>
        <span style={{ fontSize: 10, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {quotes[0]?.marketState ?? "—"}
        </span>
      </div>

      {tickers.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "20px 0", textAlign: "center" }}>
          No tickers set. Add some in <a href="/home/settings" style={{ color: "var(--color-accent-dark)" }}>Settings</a>.
        </p>
      ) : quotes.length === 0 ? (
        <div style={{ padding: "16px 0", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 8 }}>
            Stock quotes are temporarily unavailable.
          </p>
          <p style={{ fontSize: 11, color: "var(--color-ink-4)" }}>
            Tickers: {tickers.join(" · ")}<br />
            Try again in a few minutes.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {quotes.map((q, idx) => {
            const positive = q.change >= 0;
            return (
              <div
                key={q.symbol}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
                  borderTop: idx === 0 ? undefined : "1px solid var(--color-rule-soft)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 13, color: "var(--color-ink)", fontWeight: 600 }}>
                    {q.symbol}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--color-ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {q.shortName}
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 14, color: "var(--color-ink)", textAlign: "right" }}>
                  ${fmt(q.price)}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: positive ? "var(--color-green)" : "var(--color-red)",
                    textAlign: "right",
                    minWidth: 60,
                  }}
                >
                  {positive ? "+" : ""}{fmt(q.changePercent)}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      {quotes.length > 0 && missing.length > 0 && (
        <p style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 10, textAlign: "center" }}>
          Unavailable: {missing.join(", ")}
        </p>
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
