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
      <div
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "20px 24px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            margin: "0 0 16px 0",
            color: "var(--color-ink)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          🔍 Find a Stock
        </h3>
        <StockSearch onSelectStock={setSelectedStock} />
      </div>

      {/* Watchlist Section */}
      {localWatched.length > 0 && (
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              margin: "0 0 16px 0",
              color: "var(--color-ink)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            ❤️ Your Watchlist ({localWatched.length})
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
