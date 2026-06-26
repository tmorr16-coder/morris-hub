"use client";

import { useState } from "react";
import type { InvestmentIdea } from "@/lib/investment-ideas-constants";
import type { Stock } from "@/lib/stock-research";
import InvestmentsClient from "./InvestmentsClient";
import StockSearch from "./StockSearch";
import StockDetail from "./StockDetail";
import Watchlist from "./Watchlist";
import { toggleWatchStock } from "../actions";

interface InvestmentsPageWrapperProps {
  savedIdeas: InvestmentIdea[];
  enabledCategories: string[];
  watchedStocks: string[];
}

type TabType = "ideas" | "stocks";

export default function InvestmentsPageWrapper({
  savedIdeas,
  enabledCategories,
  watchedStocks,
}: InvestmentsPageWrapperProps) {
  const [activeTab, setActiveTab] = useState<TabType>("ideas");
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);

  const handleAddToWatchlist = async () => {
    if (selectedStock) {
      await toggleWatchStock(selectedStock.ticker);
    }
  };

  const isStockWatched = selectedStock ? watchedStocks.includes(selectedStock.ticker) : false;

  return (
    <div>
      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--color-rule)",
          marginBottom: 32,
        }}
      >
        <button
          onClick={() => {
            setActiveTab("ideas");
            setSelectedStock(null);
          }}
          style={{
            flex: 0,
            padding: "14px 20px",
            border: "none",
            borderBottom: activeTab === "ideas" ? "2px solid var(--color-accent)" : "none",
            background: "transparent",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: activeTab === "ideas" ? 600 : 500,
            color: activeTab === "ideas" ? "var(--color-ink)" : "var(--color-ink-2)",
            transition: "all 0.2s",
          }}
        >
          💡 Investment Ideas
        </button>

        <button
          onClick={() => {
            setActiveTab("stocks");
            setSelectedStock(null);
          }}
          style={{
            flex: 0,
            padding: "14px 20px",
            border: "none",
            borderBottom: activeTab === "stocks" ? "2px solid var(--color-accent)" : "none",
            background: "transparent",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: activeTab === "stocks" ? 600 : 500,
            color: activeTab === "stocks" ? "var(--color-ink)" : "var(--color-ink-2)",
            transition: "all 0.2s",
          }}
        >
          📊 Stock Research
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "ideas" && (
        <InvestmentsClient
          savedIdeas={savedIdeas}
          enabledCategories={enabledCategories}
        />
      )}

      {activeTab === "stocks" && !selectedStock && (
        <div>
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
            {watchedStocks.length > 0 && (
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
                  ❤️ Your Watchlist ({watchedStocks.length})
                </h3>
                <Watchlist
                  initialTickers={watchedStocks}
                  onSelectStock={setSelectedStock}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "stocks" && selectedStock && (
        <StockDetail
          stock={selectedStock}
          onAddToWatchlist={handleAddToWatchlist}
          isWatched={isStockWatched}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}
