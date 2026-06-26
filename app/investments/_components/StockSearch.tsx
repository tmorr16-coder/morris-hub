"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Stock } from "@/lib/stock-research";

interface StockSearchProps {
  onSelectStock: (stock: Stock) => void;
}

export default function StockSearch({ onSelectStock }: StockSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>();

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
      searchTimeout.current = setTimeout(() => {
        performSearch(value);
      }, 300);
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
    <div style={{ position: "relative" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by ticker or company name (e.g., NVDA, Apple)..."
            style={{
              flex: 1,
              padding: "10px 14px",
              border: "1px solid var(--color-rule)",
              borderRadius: 8,
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              color: "var(--color-ink)",
              background: "var(--color-bg)",
            }}
            autoComplete="off"
          />
        </div>

        {error && (
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(154,59,42,0.08)",
              border: "1px solid #9A3B2A",
              borderRadius: 6,
              fontSize: 12,
              color: "#9A3B2A",
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {showResults && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 8,
            boxShadow: "var(--shadow-card)",
            maxHeight: 400,
            overflowY: "auto",
            zIndex: 10,
            marginTop: 4,
          }}
        >
          {loading && (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                fontSize: 13,
                color: "var(--color-ink-3)",
              }}
            >
              Searching...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                fontSize: 13,
                color: "var(--color-ink-3)",
              }}
            >
              No stocks found
            </div>
          )}

          {!loading &&
            results.map((stock) => (
              <button
                key={stock.ticker}
                onClick={() => handleSelectStock(stock)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 16px",
                  border: "none",
                  borderBottom: "1px solid var(--color-rule)",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "inherit",
                  color: "var(--color-ink)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  (
                    e.currentTarget as HTMLElement
                  ).style.background = "var(--color-bg)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{stock.ticker}</span>
                  <span
                    style={{
                      fontSize: 12,
                      color:
                        stock.changeDirection === "up"
                          ? "var(--color-green)"
                          : stock.changeDirection === "down"
                            ? "var(--color-red)"
                            : "var(--color-ink-3)",
                    }}
                  >
                    ${stock.price.toFixed(2)} {stock.changeDirection === "up" ? "↑" : "↓"}{" "}
                    {Math.abs(stock.change).toFixed(2)}%
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "var(--color-ink-3)",
                    gap: 8,
                  }}
                >
                  <span>{stock.name}</span>
                  {stock.sector && (
                    <span style={{ whiteSpace: "nowrap" }}>{stock.sector}</span>
                  )}
                  {stock.peRatio && (
                    <span style={{ whiteSpace: "nowrap" }}>
                      PE: {stock.peRatio.toFixed(1)}
                    </span>
                  )}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
