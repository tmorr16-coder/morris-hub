"use client";

import { useState, useEffect } from "react";
import type { Stock } from "@/lib/stock-research";
import SparklineChart from "./SparklineChart";
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

const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  "Earnings soon": { bg: "rgba(184,138,46,0.12)", color: "var(--color-amber)" },
  "New idea": { bg: "rgba(59,92,127,0.1)", color: "var(--color-accent)" },
  "Watchlist gap": { bg: "rgba(74,107,58,0.1)", color: "var(--color-green)" },
};

function getBadgeStyle(badge: string) {
  if (badge.startsWith("Up ")) return { bg: "rgba(74,107,58,0.1)", color: "var(--color-green)" };
  return BADGE_COLORS[badge] ?? { bg: "var(--color-bg-deep)", color: "var(--color-ink-3)" };
}

export default function WatchlistSidebar({
  initialTickers,
  selectedTicker,
  onSelectStock,
  onWatchlistChange,
}: WatchlistSidebarProps) {
  const [items, setItems] = useState<WatchlistItemData[]>([]);
  const [loading, setLoading] = useState(initialTickers.length > 0);
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
        const [stockRes, candleRes] = await Promise.all([
          fetch(`/api/investments/stock-summary?ticker=${ticker}`).then((r) => r.json()),
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
        return { stock, sparkline };
      })
    )
      .then((data) => setItems(data.filter((d) => d.stock.price > 0)))
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

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        borderRight: "1px solid var(--color-rule)",
        background: "var(--color-bg-deep)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      <div style={{ padding: "16px 16px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>
            Your Watchlist
          </span>
          {initialTickers.length > 0 && (
            <span style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
              {initialTickers.length} tracked
            </span>
          )}
        </div>

        {loading && (
          <div style={{ fontSize: 11, color: "var(--color-ink-3)", padding: "8px 0" }}>Loading…</div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--color-ink-3)", padding: "8px 0" }}>
            No stocks watched yet. Search and add some.
          </div>
        )}

        {items.map(({ stock, sparkline }) => {
          const isSelected = stock.ticker === selectedTicker;
          const isUp = stock.changeDirection !== "down";
          return (
            <div
              key={stock.ticker}
              onClick={() => onSelectStock(stock)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                cursor: "pointer",
                background: isSelected ? "var(--color-accent-soft)" : "transparent",
                borderLeft: isSelected ? "2px solid var(--color-accent)" : "2px solid transparent",
                marginBottom: 2,
                transition: "all 0.15s",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink)", letterSpacing: "-0.01em" }}>
                    {stock.ticker}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-ink)" }}>
                    ${stock.price.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "var(--color-ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>
                    {stock.name}
                  </span>
                  <span style={{ fontSize: 10, color: isUp ? "var(--color-green)" : "var(--color-red)" }}>
                    {isUp ? "+" : ""}{stock.change.toFixed(2)}%
                  </span>
                </div>
              </div>

              {sparkline.length >= 2 && (
                <div style={{ flexShrink: 0 }}>
                  <SparklineChart prices={sparkline} width={48} height={20} />
                </div>
              )}

              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(stock.ticker); }}
                style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--color-ink-4)", fontSize: 12, padding: 0, lineHeight: 1, opacity: 0.6 }}
                title="Remove"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {suggested.length > 0 && (
        <>
          <div style={{ height: 1, background: "var(--color-rule)", margin: "4px 0" }} />
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 4 }}>
              Suggested Research
            </div>
            <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginBottom: 10 }}>
              Ideas surfaced from your watchlist
            </div>
            {suggested.map((s) => {
              const { bg, color } = getBadgeStyle(s.badge);
              return (
                <div
                  key={s.ticker}
                  style={{ padding: "8px 10px", borderRadius: 8, background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", marginBottom: 6, cursor: "pointer" }}
                  onClick={async () => {
                    const res = await fetch(`/api/investments/stock-summary?ticker=${s.ticker}`).then((r) => r.json());
                    if (res.price) onSelectStock({ ticker: res.ticker, name: res.name, price: res.price, change: res.change, changeDirection: res.changeDirection, sector: res.sector });
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-ink)", letterSpacing: "-0.01em" }}>{s.ticker}</span>
                    <span style={{ fontSize: 9, fontWeight: 500, padding: "2px 6px", borderRadius: 10, background: bg, color, whiteSpace: "nowrap" }}>{s.badge}</span>
                  </div>
                  <p style={{ fontSize: 10, color: "var(--color-ink-3)", margin: 0, lineHeight: 1.4 }}>{s.rationale}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

    </aside>
  );
}
