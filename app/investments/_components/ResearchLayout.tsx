"use client";

import { useState, useCallback } from "react";
import type { Stock } from "@/lib/stock-research";
import WatchlistSidebar from "./WatchlistSidebar";
import StockMainView from "./StockMainView";
import StockSearch from "./StockSearch";
import AccountDashboard from "./AccountDashboard";
import TickerBar from "./TickerBar";
import MarketBar from "./MarketBar";
import { LargeTitle } from "@/components/ios";
import { toggleWatchStock } from "../actions";

interface ResearchLayoutProps {
  watchedTickers: string[];
}

export default function ResearchLayout({ watchedTickers }: ResearchLayoutProps) {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [localWatched, setLocalWatched] = useState<string[]>(watchedTickers);
  const [watchError, setWatchError] = useState<string | null>(null);

  const handleSelectStock = useCallback((stock: Stock) => {
    setSelectedStock(stock);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
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

  // ── Detail view (pushed) ─────────────────────────────────────────────
  if (selectedStock) {
    return (
      <div className="ios-scroll">
        <StockMainView
          stock={selectedStock}
          isWatched={isWatched}
          onToggleWatch={handleToggleWatch}
          onClose={() => setSelectedStock(null)}
        />
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────
  return (
    <div className="ios-scroll">
      {/* Market indices — always visible */}
      <MarketBar />

      {/* Live ticker — only shown when stocks are watched */}
      {localWatched.length > 0 && <TickerBar symbols={localWatched} />}

      <LargeTitle title="Stocks" subtitle="Research · watchlist · paper trading" />

      {watchError && (
        <div
          className="ios-list"
          style={{ margin: "8px var(--ios-gutter) 0", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
        >
          <span className="ios-footnote" style={{ color: "var(--ios-red)" }}>{watchError}</span>
          <button onClick={() => setWatchError(null)} className="ios-footnote" style={{ color: "var(--ios-tint)" }}>Dismiss</button>
        </div>
      )}

      {/* Search */}
      <StockSearch onSelectStock={handleSelectStock} />

      {/* Alpaca paper account */}
      <AccountDashboard onSelectStock={handleSelectStock} />

      {/* Watchlist */}
      <WatchlistSidebar
        initialTickers={localWatched}
        onSelectStock={handleSelectStock}
        onWatchlistChange={setLocalWatched}
      />

      <div style={{ height: 16 }} />
    </div>
  );
}
