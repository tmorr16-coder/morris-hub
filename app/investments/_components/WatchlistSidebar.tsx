"use client";

import { useState, useEffect } from "react";
import type { Stock } from "@/lib/stock-research";
import { Group, Sparkline } from "@/components/ios";
import { toggleWatchStock } from "../actions";

interface SuggestedStock {
  ticker: string;
  badge: string;
  rationale: string;
}

interface WatchlistItemData {
  stock: Stock;
  sparkline: number[];
}

interface WatchlistSidebarProps {
  initialTickers: string[];
  selectedTicker?: string;
  onSelectStock: (stock: Stock) => void;
  onWatchlistChange: (tickers: string[]) => void;
}

function TickerBadge({ sym }: { sym: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 40, height: 40, borderRadius: 10, background: "var(--ios-fill)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ios-label)", flexShrink: 0,
      }}
    >
      {sym.slice(0, 4)}
    </span>
  );
}

export default function WatchlistSidebar({
  initialTickers,
  selectedTicker,
  onSelectStock,
  onWatchlistChange,
}: WatchlistSidebarProps) {
  const [items, setItems] = useState<WatchlistItemData[]>([]);
  const [loading, setLoading] = useState(initialTickers.length > 0);
  const [notConfigured, setNotConfigured] = useState(false);
  const [suggested, setSuggested] = useState<SuggestedStock[]>([]);

  // Stable string key — doesn't change on every render if content is same
  const tickerKey = initialTickers.join(",");

  useEffect(() => {
    if (!initialTickers.length) {
      setLoading(false);
      setItems([]);
      return;
    }
    setLoading(true);

    Promise.all(
      initialTickers.map(async (ticker) => {
        // quote=1 → live Finnhub quote only, skips the slow AI summary the
        // watchlist never displays (keeps rows fast + resilient to AI failures).
        const [stockRes, candleRes] = await Promise.all([
          fetch(`/api/investments/stock-summary?ticker=${ticker}&quote=1`).then((r) => r.json()),
          fetch(`/api/investments/candle?ticker=${ticker}&range=1mo&interval=1d`).then((r) => r.json()),
        ]);
        const stock: Stock = {
          ticker: stockRes.ticker ?? ticker,
          name: stockRes.name ?? ticker,
          price: stockRes.price ?? 0,
          change: stockRes.change ?? 0,
          changeDirection: stockRes.changeDirection ?? "neutral",
          sector: stockRes.sector,
        };
        const sparkline: number[] = (candleRes.points || []).map((p: { close: number }) => p.close);
        return { stock, sparkline, notConfigured: !!stockRes.notConfigured };
      })
    )
      .then((data) => {
        setNotConfigured(data.some((d) => d.notConfigured));
        setItems(data.filter((d) => d.stock.price > 0).map(({ stock, sparkline }) => ({ stock, sparkline })));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey]);

  useEffect(() => {
    if (!initialTickers.length) return;
    fetch(`/api/investments/suggested?tickers=${tickerKey}`)
      .then((r) => r.json())
      .then((data) => setSuggested(data.suggestions || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey]);

  const handleRemove = async (ticker: string) => {
    const newTickers = initialTickers.filter((t) => t !== ticker);
    setItems((prev) => prev.filter((i) => i.stock.ticker !== ticker));
    onWatchlistChange(newTickers);
    await toggleWatchStock(ticker);
  };

  if (!initialTickers.length) {
    return (
      <Group header="Watchlist" footer="Search for a stock above and add it to start tracking.">
        <div className="ios-cell" style={{ color: "var(--ios-label-2)" }}>No stocks watched yet</div>
      </Group>
    );
  }

  return (
    <>
      <Group header={`Watchlist · ${initialTickers.length} tracked`}>
        {loading && (
          <div className="ios-cell" style={{ color: "var(--ios-label-2)" }}>Loading…</div>
        )}
        {!loading && items.length === 0 && notConfigured && (
          <div className="ios-cell" style={{ color: "var(--ios-label-2)" }}>Stock data isn&apos;t configured yet</div>
        )}
        {!loading && items.length === 0 && !notConfigured && (
          <div className="ios-cell" style={{ color: "var(--ios-label-2)" }}>No quotes available</div>
        )}
        {items.map(({ stock, sparkline }) => {
          const isSelected = stock.ticker === selectedTicker;
          const isUp = stock.changeDirection !== "down";
          const chg = isUp ? "var(--ios-green)" : "var(--ios-red)";
          return (
            <div
              key={stock.ticker}
              className="ios-cell"
              style={{ background: isSelected ? "var(--ios-fill-2)" : undefined, cursor: "pointer" }}
            >
              <button
                onClick={() => onSelectStock(stock)}
                aria-label={`Open ${stock.ticker}`}
                style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, textAlign: "left" }}
              >
                <TickerBadge sym={stock.ticker} />
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span className="ios-cell-title" style={{ fontWeight: 600 }}>{stock.ticker}</span>
                  <span className="ios-cell-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stock.name}</span>
                </span>
                {sparkline.length >= 2 && (
                  <Sparkline points={sparkline} color={chg} width={54} height={26} />
                )}
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, flexShrink: 0 }}>
                  <span className="ios-num" style={{ color: "var(--ios-label)", fontSize: 15 }}>${stock.price.toFixed(2)}</span>
                  <span className="ios-num" style={{ color: chg, fontSize: 13, fontWeight: 600 }}>
                    {isUp ? "▲" : "▼"} {Math.abs(stock.change).toFixed(2)}%
                  </span>
                </span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(stock.ticker); }}
                aria-label={`Remove ${stock.ticker}`}
                style={{ flexShrink: 0, marginLeft: 8, color: "var(--ios-label-3)", padding: 4, display: "flex" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="var(--ios-cell)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          );
        })}
      </Group>

      {suggested.length > 0 && (
        <Group header="Suggested research" footer="Ideas surfaced from your watchlist">
          {suggested.map((s) => (
            <button
              key={s.ticker}
              className="ios-cell"
              onClick={async () => {
                const res = await fetch(`/api/investments/stock-summary?ticker=${s.ticker}&quote=1`).then((r) => r.json());
                if (res.price) onSelectStock({ ticker: res.ticker, name: res.name, price: res.price, change: res.change, changeDirection: res.changeDirection, sector: res.sector });
              }}
            >
              <span className="ios-cell-body">
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span className="ios-cell-title" style={{ fontWeight: 700 }}>{s.ticker}</span>
                  <span className="ios-chip ios-chip--sm">{s.badge}</span>
                </span>
                <span className="ios-cell-sub">{s.rationale}</span>
              </span>
            </button>
          ))}
        </Group>
      )}
    </>
  );
}
