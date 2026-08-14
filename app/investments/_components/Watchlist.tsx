"use client";

import { useState, useEffect } from "react";
import type { Stock } from "@/lib/stock-research";
import { toggleWatchStock } from "../actions";

interface WatchlistProps {
  initialTickers: string[];
  onSelectStock: (stock: Stock) => void;
}

export default function Watchlist({ initialTickers, onSelectStock }: WatchlistProps) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWatchlistStocks = async () => {
      if (!initialTickers.length) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch prices for all watched stocks in parallel
        const responses = await Promise.all(
          initialTickers.map((ticker) =>
            fetch(`/api/investments/stock-summary?ticker=${ticker}`).then((res) => {
              if (!res.ok) throw new Error(`Failed to fetch ${ticker}`);
              return res.json();
            })
          )
        );

        setStocks(responses);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load watchlist");
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlistStocks();
  }, [initialTickers]);

  const handleRemove = async (ticker: string) => {
    await toggleWatchStock(ticker);
    setStocks((prev) => prev.filter((s) => s.ticker !== ticker));
  };

  if (!initialTickers.length) {
    return (
      <div style={{ textAlign: "center", padding: "36px 20px" }}>
        <p className="ios-body" style={{ marginBottom: 4, color: "var(--ios-label)" }}>Track stocks you care about</p>
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 14 }}>Add a ticker to watch its price, news, and AI analysis.</p>
        <a href="/investments/stocks" style={{ display: "inline-block", padding: "10px 18px", borderRadius: 10, background: "var(--ios-tint)", color: "var(--ios-on-tint)", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
          Add a stock →
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "24px", color: "var(--ios-label-3)" }} className="ios-footnote">
        Loading watchlist…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "12px 16px",
          background: "color-mix(in srgb, var(--ios-red) 10%, transparent)",
          borderRadius: "var(--ios-radius-card)",
          color: "var(--ios-red)",
          fontSize: 13,
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {stocks.map((stock) => {
        const dir = stock.changeDirection;
        const changeColor =
          dir === "up" ? "var(--ios-green)" : dir === "down" ? "var(--ios-red)" : "var(--ios-label-3)";
        return (
          <div
            key={stock.ticker}
            style={{
              background: "var(--ios-cell)",
              borderRadius: "var(--ios-radius-card)",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <button
              onClick={() => onSelectStock(stock)}
              style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
            >
              <div className="ios-headline" style={{ color: "var(--ios-label)" }}>{stock.ticker}</div>
              <div
                className="ios-footnote"
                style={{ color: "var(--ios-label-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {stock.name}
              </div>
              {stock.peRatio ? (
                <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 3 }}>
                  PE {stock.peRatio.toFixed(1)}
                  {stock.dividend ? ` · Div ${stock.dividend.toFixed(2)}%` : ""}
                </div>
              ) : null}
            </button>

            <button
              onClick={() => onSelectStock(stock)}
              style={{ textAlign: "right", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
            >
              <div className="ios-num" style={{ fontSize: 17, fontWeight: 600, color: "var(--ios-label)" }}>
                ${stock.price.toFixed(2)}
              </div>
              <div className="ios-num" style={{ fontSize: 13, fontWeight: 600, color: changeColor }}>
                {dir === "up" ? "▲" : dir === "down" ? "▼" : ""} {Math.abs(stock.change).toFixed(2)}%
              </div>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(stock.ticker);
              }}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ios-label-3)", padding: 4, display: "flex", flexShrink: 0 }}
              title="Remove from watchlist"
              aria-label={`Remove ${stock.ticker} from watchlist`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
