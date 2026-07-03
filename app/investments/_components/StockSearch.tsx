"use client";

import { useState, useCallback, useRef } from "react";
import type { Stock } from "@/lib/stock-research";

interface StockSearchProps {
  onSelectStock: (stock: Stock) => void;
}

function SearchGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}

export default function StockSearch({ onSelectStock }: StockSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/investments/stock-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Search failed");
      }

      const data = await response.json();
      setResults(data.stocks || []);
      setShowResults(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search error");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);

    // Debounce search
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (value.length >= 1) {
      setLoading(true);
      // Longer debounce for multi-word topic queries so Claude isn't called mid-phrase
      const delay = value.includes(" ") ? 800 : 300;
      searchTimeout.current = setTimeout(() => {
        performSearch(value);
      }, delay);
    } else {
      setResults([]);
      setShowResults(false);
    }
  };

  const handleSelectStock = (stock: Stock) => {
    onSelectStock(stock);
    setQuery("");
    setResults([]);
    setShowResults(false);
  };

  return (
    <div style={{ position: "relative", margin: "12px var(--ios-gutter) 0" }}>
      {/* iOS search field */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "9px 12px",
          borderRadius: 10,
          background: "var(--ios-fill)",
          color: "var(--ios-label-2)",
        }}
      >
        <SearchGlyph />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search stocks, ETFs or a topic"
          autoComplete="off"
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 17,
            color: "var(--ios-label)",
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setShowResults(false); }}
            aria-label="Clear search"
            style={{ display: "flex", color: "var(--ios-label-3)", padding: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="var(--ios-cell)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <p className="ios-footnote" style={{ color: "var(--ios-red)", margin: "6px 4px 0" }}>
          {error}
        </p>
      )}

      {showResults && (
        <div
          className="ios-list"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            margin: "6px 0 0",
            maxHeight: 380,
            overflowY: "auto",
            zIndex: 20,
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
          }}
        >
          {loading && (
            <div className="ios-cell" style={{ justifyContent: "center", color: "var(--ios-label-2)" }}>
              Searching…
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="ios-cell" style={{ justifyContent: "center", color: "var(--ios-label-2)" }}>
              No stocks found
            </div>
          )}

          {!loading &&
            results.map((stock) => {
              const dir = stock.changeDirection;
              const chgColor = dir === "up" ? "var(--ios-green)" : dir === "down" ? "var(--ios-red)" : "var(--ios-label-2)";
              return (
                <button
                  key={stock.ticker}
                  onClick={() => handleSelectStock(stock)}
                  className="ios-cell"
                >
                  <span className="ios-cell-body">
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span className="ios-cell-title" style={{ fontWeight: 600 }}>{stock.ticker}</span>
                      <span className="ios-num" style={{ color: chgColor, fontSize: 15 }}>
                        ${(stock.price ?? 0).toFixed(2)} {dir === "up" ? "▲" : dir === "down" ? "▼" : "•"} {Math.abs(stock.change ?? 0).toFixed(2)}%
                      </span>
                    </span>
                    {stock.reason ? (
                      <span className="ios-cell-sub">
                        <span style={{ color: "var(--ios-label)", fontWeight: 500 }}>{stock.name}</span>
                        {" · "}{stock.reason}
                      </span>
                    ) : (
                      <span className="ios-cell-sub" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stock.name}</span>
                        <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                          {stock.sector}
                          {stock.peRatio ? `${stock.sector ? " · " : ""}PE ${stock.peRatio.toFixed(1)}` : ""}
                        </span>
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
