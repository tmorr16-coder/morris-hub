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
      <div
        style={{
          textAlign: "center",
          padding: "40px 20px",
          color: "var(--color-ink-3)",
        }}
      >
        <p style={{ fontSize: 14, marginBottom: 8 }}>No stocks in your watchlist yet</p>
        <p style={{ fontSize: 12 }}>Search for a stock and add it to get started</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "var(--color-ink-3)" }}>
        Loading watchlist...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "12px 16px",
          background: "rgba(154,59,42,0.08)",
          border: "1px solid #9A3B2A",
          borderRadius: 8,
          color: "#9A3B2A",
          fontSize: 13,
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 12,
      }}
    >
      {stocks.map((stock) => (
        <div
          key={stock.ticker}
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 12,
            padding: "16px",
            boxShadow: "var(--shadow-card)",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 12,
            }}
          >
            <div onClick={() => onSelectStock(stock)} style={{ flex: 1, cursor: "pointer" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px 0" }}>
                {stock.ticker}
              </h3>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--color-ink-3)",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {stock.name}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(stock.ticker);
              }}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--color-ink-3)",
                fontSize: 18,
                padding: 0,
                lineHeight: 1,
              }}
              title="Remove from watchlist"
            >
              ✕
            </button>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "12px 0",
              borderTop: "1px solid var(--color-rule)",
              cursor: "pointer",
            }}
            onClick={() => onSelectStock(stock)}
          >
            <span style={{ fontSize: 18, fontWeight: 600, color: "var(--color-ink)" }}>
              ${stock.price.toFixed(2)}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color:
                  stock.changeDirection === "up"
                    ? "var(--color-green)"
                    : stock.changeDirection === "down"
                      ? "var(--color-red)"
                      : "var(--color-ink-3)",
              }}
            >
              {stock.changeDirection === "up" ? "↑" : "↓"} {Math.abs(stock.change).toFixed(2)}%
            </span>
          </div>

          {stock.peRatio && (
            <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 8 }}>
              PE: {stock.peRatio.toFixed(1)}
              {stock.dividend && ` • Div: ${stock.dividend.toFixed(2)}%`}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
