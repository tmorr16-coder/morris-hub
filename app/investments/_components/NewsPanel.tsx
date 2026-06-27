"use client";

import { useState, useEffect, useCallback } from "react";

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  timeAgo: string;
  related: string;
  url: string;
  sentiment: "bullish" | "bearish" | "neutral";
}

interface NewsPanelProps {
  ticker?: string;
  tickerName?: string;
}

const SENTIMENT_STYLES = {
  bullish: { color: "var(--color-green)", dot: "●" },
  bearish: { color: "var(--color-red)", dot: "●" },
  neutral: { color: "var(--color-ink-4)", dot: "●" },
};

const FILTER_TABS = ["All", "Bullish", "Bearish"] as const;
type FilterTab = (typeof FILTER_TABS)[number];

export default function NewsPanel({ ticker, tickerName }: NewsPanelProps) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("All");
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (ticker) params.set("ticker", ticker);
      if (tickerName) params.set("name", tickerName);
      const res = await fetch(`/api/investments/news?${params}`);
      const data = await res.json();
      setItems(data.news || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [ticker, tickerName, refreshKey]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const filtered =
    filter === "All"
      ? items
      : items.filter((item) => item.sentiment === filter.toLowerCase());

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        borderLeft: "1px solid var(--color-rule)",
        background: "var(--color-bg-deep)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px 10px",
          borderBottom: "1px solid var(--color-rule)",
          position: "sticky",
          top: 0,
          background: "var(--color-bg-deep)",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-ink)",
            }}
          >
            News & Signals
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                color: "var(--color-ink-3)",
                padding: 0,
                lineHeight: 1,
              }}
              title="Refresh"
            >
              ↻
            </button>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "var(--color-green)",
                background: "rgba(74,107,58,0.1)",
                padding: "2px 6px",
                borderRadius: 10,
              }}
            >
              LIVE
            </span>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 4 }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--color-rule)",
                background: filter === tab ? "var(--color-ink)" : "transparent",
                color: filter === tab ? "var(--color-bg)" : "var(--color-ink-3)",
                fontSize: 11,
                fontFamily: "inherit",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* News list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && (
          <div
            style={{
              padding: "20px 16px",
              fontSize: 12,
              color: "var(--color-ink-3)",
              textAlign: "center",
            }}
          >
            Loading news…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div
            style={{
              padding: "20px 16px",
              fontSize: 12,
              color: "var(--color-ink-3)",
              textAlign: "center",
            }}
          >
            No {filter !== "All" ? filter.toLowerCase() + " " : ""}news found
          </div>
        )}

        {!loading &&
          filtered.map((item, i) => {
            const sent = SENTIMENT_STYLES[item.sentiment];
            return (
              <a
                key={item.id + i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--color-rule-soft)",
                  textDecoration: "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--color-bg-card)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {/* Source + time + ticker */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 5,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--color-ink-3)",
                    }}
                  >
                    {item.source}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
                      {item.timeAgo}
                    </span>
                    {item.related && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: "var(--color-accent)",
                          background: "var(--color-accent-soft)",
                          padding: "1px 5px",
                          borderRadius: 4,
                        }}
                      >
                        {item.related.split(",")[0]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Headline */}
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--color-ink)",
                    margin: "0 0 6px 0",
                    lineHeight: 1.45,
                  }}
                >
                  {item.headline}
                </p>

                {/* Sentiment */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 8, color: sent.color }}>{sent.dot}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: sent.color,
                      textTransform: "capitalize",
                    }}
                  >
                    {item.sentiment}
                  </span>
                </div>
              </a>
            );
          })}
      </div>
    </aside>
  );
}
