"use client";

import { useState, useCallback } from "react";
import type { Stock } from "@/lib/stock-research";
import WatchlistSidebar from "./WatchlistSidebar";
import StockMainView from "./StockMainView";
import NewsPanel from "./NewsPanel";
import StockSearch from "./StockSearch";
import { toggleWatchStock } from "../actions";

interface ResearchLayoutProps {
  watchedTickers: string[];
}

export default function ResearchLayout({ watchedTickers }: ResearchLayoutProps) {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [localWatched, setLocalWatched] = useState<string[]>(watchedTickers);
  const [showSearch, setShowSearch] = useState(false);

  const handleSelectStock = useCallback((stock: Stock) => {
    setSelectedStock(stock);
    setShowSearch(false);
  }, []);

  const handleToggleWatch = useCallback(async () => {
    if (!selectedStock) return;
    const ticker = selectedStock.ticker.toUpperCase();
    const isWatched = localWatched.includes(ticker);
    setLocalWatched((prev) =>
      isWatched ? prev.filter((t) => t !== ticker) : [...prev, ticker]
    );
    await toggleWatchStock(ticker);
  }, [selectedStock, localWatched]);

  const isWatched = selectedStock
    ? localWatched.includes(selectedStock.ticker.toUpperCase())
    : false;

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100dvh - 101px)", // PlatformMenu ~52px + InvestmentsNav ~49px
        overflow: "hidden",
      }}
    >
      {/* Left: Watchlist sidebar */}
      <WatchlistSidebar
        initialTickers={localWatched}
        selectedTicker={selectedStock?.ticker}
        onSelectStock={handleSelectStock}
        onWatchlistChange={setLocalWatched}
      />

      {/* Center: Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {/* Search bar */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--color-rule)",
            background: "var(--color-bg)",
            position: "relative",
            zIndex: 10,
          }}
        >
          {showSearch ? (
            <div style={{ position: "relative" }}>
              <StockSearch onSelectStock={handleSelectStock} />
              <button
                onClick={() => setShowSearch(false)}
                style={{
                  position: "absolute",
                  right: 0,
                  top: 8,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-ink-3)",
                  fontSize: 16,
                  padding: "0 8px",
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid var(--color-rule)",
                background: "var(--color-bg-deep)",
                color: "var(--color-ink-3)",
                fontSize: 13,
                fontFamily: "inherit",
                textAlign: "left",
                cursor: "text",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>🔍</span>
              <span>Search any stock, ETF or topic to research…</span>
            </button>
          )}
        </div>

        {/* Main panel: stock view or empty state */}
        {selectedStock ? (
          <StockMainView
            stock={selectedStock}
            isWatched={isWatched}
            onToggleWatch={handleToggleWatch}
            onClose={() => setSelectedStock(null)}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              color: "var(--color-ink-3)",
              padding: "40px 20px",
            }}
          >
            <div style={{ fontSize: 40 }}>📊</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-ink-2)" }}>
              Select a stock to research
            </div>
            <div style={{ fontSize: 13, textAlign: "center", maxWidth: 300, lineHeight: 1.6 }}>
              Search for a ticker above, click a stock in your watchlist, or explore suggested ideas.
            </div>
          </div>
        )}
      </div>

      {/* Right: News panel */}
      <NewsPanel ticker={selectedStock?.ticker} tickerName={selectedStock?.name} />
    </div>
  );
}
