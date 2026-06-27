"use client";

import { useState, useEffect } from "react";
import type { Stock } from "@/lib/stock-research";
import PriceChart from "./PriceChart";
import DeepResearchPanel from "./DeepResearchPanel";

interface StockMetrics {
  weekHigh52: number | null;
  weekLow52: number | null;
  avgVolume: string | null;
  peRatio: number | null;
  marketCap: string | null;
  exchange: string | null;
}

interface StockMainViewProps {
  stock: Stock;
  isWatched: boolean;
  onToggleWatch: () => void;
  onClose: () => void;
}

function MetricBox({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

export default function StockMainView({
  stock,
  isWatched,
  onToggleWatch,
  onClose,
}: StockMainViewProps) {
  const [metrics, setMetrics] = useState<StockMetrics | null>(null);

  useEffect(() => {
    fetch(`/api/investments/metrics?ticker=${stock.ticker}`)
      .then((r) => r.json())
      .then((data) => setMetrics(data))
      .catch(() => {});
  }, [stock.ticker]);

  const isUp = stock.changeDirection !== "down";

  const weekRange =
    metrics?.weekHigh52 && metrics?.weekLow52
      ? `$${metrics.weekLow52.toFixed(0)}–${metrics.weekHigh52.toFixed(0)}`
      : null;

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      {/* Stock header */}
      <div
        style={{
          padding: "20px 28px 16px",
          borderBottom: "1px solid var(--color-rule)",
          background: "var(--color-bg)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          {/* Left: ticker + name */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
              <h1
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  margin: 0,
                  color: "var(--color-ink)",
                }}
              >
                {stock.ticker}
              </h1>
              {metrics?.exchange && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--color-ink-3)",
                    background: "var(--color-bg-deep)",
                    padding: "2px 7px",
                    borderRadius: 5,
                  }}
                >
                  {metrics.exchange}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "var(--color-ink-3)" }}>{stock.name}</div>
          </div>

          {/* Right: price + controls */}
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end", marginBottom: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "var(--color-ink)", letterSpacing: "-0.03em" }}>
                ${stock.price.toFixed(2)}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={onToggleWatch}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-rule)",
                    background: isWatched ? "var(--color-accent)" : "transparent",
                    color: isWatched ? "#FFFDF8" : "var(--color-ink)",
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {isWatched ? "❤️ Watching" : "🤍 Watch"}
                </button>
                <button
                  onClick={onClose}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--color-rule)",
                    background: "transparent",
                    color: "var(--color-ink-3)",
                    fontSize: 16,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: isUp ? "var(--color-green)" : "var(--color-red)",
              }}
            >
              {isUp ? "+" : ""}
              {stock.change.toFixed(2)}% today
            </div>
          </div>
        </div>

        {/* Metrics row */}
        <div
          style={{
            display: "flex",
            gap: 32,
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid var(--color-rule)",
          }}
        >
          <MetricBox label="Mkt Cap" value={metrics?.marketCap ?? null} />
          <MetricBox
            label="P/E (TTM)"
            value={metrics?.peRatio ? metrics.peRatio.toFixed(1) : null}
          />
          <MetricBox label="Avg Vol" value={metrics?.avgVolume ?? null} />
          <MetricBox label="52-Wk" value={weekRange} />
          {stock.sector && (
            <MetricBox label="Sector" value={stock.sector} />
          )}
        </div>
      </div>

      {/* Content area */}
      <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Price chart */}
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 12,
            padding: "16px 20px",
          }}
        >
          <PriceChart
            ticker={stock.ticker}
            currentPrice={stock.price}
            changeDirection={stock.changeDirection}
          />
        </div>

        {/* Deep Research */}
        <DeepResearchPanel stock={stock} />
      </div>
    </div>
  );
}
