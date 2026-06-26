"use client";

import { useState, useEffect } from "react";
import type { Stock } from "@/lib/stock-research";

interface StockDetailProps {
  stock: Stock;
  onAddToWatchlist: () => void;
  isWatched: boolean;
  onClose: () => void;
}

export default function StockDetail({
  stock,
  onAddToWatchlist,
  isWatched,
  onClose,
}: StockDetailProps) {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/investments/stock-summary?ticker=${stock.ticker}`
        );

        if (!response.ok) {
          throw new Error("Failed to load summary");
        }

        const data = await response.json();
        setSummary(data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading summary");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [stock.ticker]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "20px 24px",
        maxWidth: 800,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1
            className="serif"
            style={{
              fontSize: 24,
              margin: "0 0 4px 0",
              color: "var(--color-ink)",
            }}
          >
            {stock.ticker}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--color-ink-2)",
            }}
          >
            {stock.name}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onAddToWatchlist}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--color-rule)",
              background: isWatched ? "var(--color-accent)" : "transparent",
              color: isWatched ? "#FFFDF8" : "var(--color-ink)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 500,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (!isWatched) {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--color-bg)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isWatched) {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
              }
            }}
          >
            {isWatched ? "❤️ Watched" : "🤍 Watch"}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--color-rule)",
              background: "transparent",
              color: "var(--color-ink-3)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Price Card */}
      <div
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "16px 20px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 32, fontWeight: 600, color: "var(--color-ink)" }}>
            ${stock.price.toFixed(2)}
          </span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 500,
              color:
                stock.changeDirection === "up"
                  ? "var(--color-green)"
                  : stock.changeDirection === "down"
                    ? "var(--color-red)"
                    : "var(--color-ink-3)",
            }}
          >
            {stock.changeDirection === "up" ? "↑" : "↓"} {Math.abs(stock.change).toFixed(2)}% today
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid var(--color-rule)",
            fontSize: 12,
          }}
        >
          {stock.peRatio && (
            <div>
              <span style={{ color: "var(--color-ink-3)" }}>P/E Ratio</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink)" }}>
                {stock.peRatio.toFixed(1)}
              </div>
            </div>
          )}
          {stock.dividend && (
            <div>
              <span style={{ color: "var(--color-ink-3)" }}>Dividend Yield</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink)" }}>
                {stock.dividend.toFixed(2)}%
              </div>
            </div>
          )}
          {stock.sector && (
            <div>
              <span style={{ color: "var(--color-ink-3)" }}>Sector</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink)" }}>
                {stock.sector}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Summary */}
      <div
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "16px 20px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            margin: "0 0 12px 0",
            color: "var(--color-ink)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          📊 AI Analysis
        </h3>

        {loading && (
          <div style={{ fontSize: 13, color: "var(--color-ink-3)" }}>
            Generating analysis...
          </div>
        )}

        {error && (
          <div
            style={{
              fontSize: 13,
              color: "var(--color-red)",
              padding: "8px 12px",
              background: "rgba(154,59,42,0.08)",
              borderRadius: 6,
            }}
          >
            {error}
          </div>
        )}

        {!loading && summary && (
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--color-ink-2)",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {summary}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          gap: 8,
          paddingTop: 8,
        }}
      >
        <button
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--color-rule)",
            background: "var(--color-accent)",
            color: "#FFFDF8",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          💬 Ask About This Stock
        </button>
      </div>
    </div>
  );
}
