"use client";

import { useState, useCallback } from "react";
import type { Stock } from "@/lib/stock-research";
import WatchlistSidebar from "./WatchlistSidebar";
import StockMainView from "./StockMainView";
import NewsPanel from "./NewsPanel";
import StockSearch from "./StockSearch";
import AccountDashboard from "./AccountDashboard";
import TickerBar from "./TickerBar";
import MarketBar from "./MarketBar";
import { toggleWatchStock } from "../actions";

interface ResearchLayoutProps {
  watchedTickers: string[];
}

export default function ResearchLayout({ watchedTickers }: ResearchLayoutProps) {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [localWatched, setLocalWatched] = useState<string[]>(watchedTickers);
  const [showSearch, setShowSearch] = useState(false);
  const [watchError, setWatchError] = useState<string | null>(null);

  const handleSelectStock = useCallback((stock: Stock) => {
    setSelectedStock(stock);
    setShowSearch(false);
  }, []);

  const handleToggleWatch = useCallback(async () => {
    if (!selectedStock) return;
    const ticker = selectedStock.ticker.toUpperCase();
    const isWatched = localWatched.includes(ticker);
    // Optimistic update
    setLocalWatched((prev) =>
      isWatched ? prev.filter((t) => t !== ticker) : [...prev, ticker]
    );
    setWatchError(null);
    const result = await toggleWatchStock(ticker);
    if (result?.error) {
      // Roll back optimistic update on failure
      setLocalWatched((prev) =>
        isWatched ? [...prev, ticker] : prev.filter((t) => t !== ticker)
      );
      setWatchError(`Could not save watchlist: ${result.error}`);
    }
  }, [selectedStock, localWatched]);

  const isWatched = selectedStock
    ? localWatched.includes(selectedStock.ticker.toUpperCase())
    : false;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100dvh - 101px)",
        overflow: "hidden",
      }}
    >
      {/* Market indices — always visible */}
      <MarketBar />

      {/* Live ticker — only shown when stocks are watched */}
      {localWatched.length > 0 && <TickerBar symbols={localWatched} />}

      {/* 3-column layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Left: Watchlist sidebar */}
      <WatchlistSidebar
        initialTickers={localWatched}
        selectedTicker={selectedStock?.ticker}
        onSelectStock={handleSelectStock}
        onWatchlistChange={setLocalWatched}
      />

      {/* Center: Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {/* Watch error banner */}
        {watchError && (
          <div style={{ padding: "8px 20px", background: "rgba(154,59,42,0.08)", borderBottom: "1px solid rgba(154,59,42,0.2)", fontSize: 12, color: "var(--color-red)", display: "flex", justifyContent: "space-between" }}>
            {watchError}
            <button onClick={() => setWatchError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-red)", fontSize: 14 }}>✕</button>
          </div>
        )}
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
          <div style={{ flex: 1, overflowY: "auto" }}>
            <AccountDashboard onSelectStock={handleSelectStock} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                color: "var(--color-ink-3)",
                padding: "32px 20px",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--color-ink-3)" }}>
                Search for a stock above or select one from your watchlist.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: News panel */}
      <NewsPanel ticker={selectedStock?.ticker} tickerName={selectedStock?.name} />
      </div> {/* end 3-column */}
    </div>
  );
}
