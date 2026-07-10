"use client";

import { useState } from "react";
import type { Stock } from "@/lib/stock-research";
import StockSearch from "./StockSearch";
import StockDetail from "./StockDetail";
import Watchlist from "./Watchlist";
import { toggleWatchStock } from "../actions";

interface StockSearchPageProps {
  watchedStocks: string[];
}

export default function StockSearchPage({ watchedStocks }: StockSearchPageProps) {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [localWatched, setLocalWatched] = useState<string[]>(watchedStocks);

  const handleAddToWatchlist = async () => {
    if (!selectedStock) return;
    const ticker = selectedStock.ticker.toUpperCase();
    setLocalWatched((prev) =>
      prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker]
    );
    await toggleWatchStock(ticker);
  };

  const isStockWatched = selectedStock ? localWatched.includes(selectedStock.ticker.toUpperCase()) : false;

  if (selectedStock) {
    return (
      <StockDetail
        stock={selectedStock}
        onAddToWatchlist={handleAddToWatchlist}
        isWatched={isStockWatched}
        onClose={() => setSelectedStock(null)}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* Search Section */}
      <div>
        <h3 className="ios-group-header" style={{ padding: "0 0 7px" }}>
          Find a Stock
        </h3>
        <div
          style={{
            background: "var(--ios-cell)",
            borderRadius: "var(--ios-radius-card)",
            padding: 16,
          }}
        >
          <StockSearch onSelectStock={setSelectedStock} />
        </div>
      </div>

      {/* Watchlist Section */}
      {localWatched.length > 0 && (
        <div>
          <h3 className="ios-group-header" style={{ padding: "0 0 7px" }}>
            Your Watchlist ({localWatched.length})
          </h3>
          <Watchlist
            initialTickers={localWatched}
            onSelectStock={setSelectedStock}
          />
        </div>
      )}
    </div>
  );
}
