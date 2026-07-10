"use client";

import { useState, useEffect, useCallback } from "react";
import { Group, Segmented } from "@/components/ios";

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

const SENTIMENT_COLOR: Record<NewsItem["sentiment"], string> = {
  bullish: "var(--ios-green)",
  bearish: "var(--ios-red)",
  neutral: "var(--ios-label-3)",
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
    <>
      <Segmented
        ariaLabel="Filter news"
        value={filter}
        onChange={setFilter}
        options={FILTER_TABS.map((t) => ({ value: t, label: t }))}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px var(--ios-gutter) 0" }}>
        <span className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
          News &amp; signals
        </span>
        <button onClick={() => setRefreshKey((k) => k + 1)} className="ios-footnote" style={{ color: "var(--ios-tint)" }}>
          Refresh
        </button>
      </div>

      <Group>
        {loading && (
          <div className="ios-cell" style={{ color: "var(--ios-label-2)", justifyContent: "center" }}>Loading news…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="ios-cell" style={{ color: "var(--ios-label-2)", justifyContent: "center" }}>
            No {filter !== "All" ? filter.toLowerCase() + " " : ""}news found
          </div>
        )}
        {!loading &&
          filtered.map((item, i) => (
            <a
              key={item.id + i}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ios-cell"
              style={{ alignItems: "flex-start" }}
            >
              <span className="ios-cell-body">
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span className="ios-caption" style={{ color: "var(--ios-label-2)", fontWeight: 600 }}>{item.source}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>{item.timeAgo}</span>
                    {item.related && (
                      <span className="ios-chip ios-chip--sm">{item.related.split(",")[0]}</span>
                    )}
                  </span>
                </span>
                <span className="ios-cell-title" style={{ fontSize: 15, lineHeight: "20px", color: "var(--ios-label)" }}>
                  {item.headline}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: SENTIMENT_COLOR[item.sentiment] }} />
                  <span className="ios-caption" style={{ color: SENTIMENT_COLOR[item.sentiment], textTransform: "capitalize", fontWeight: 500 }}>
                    {item.sentiment}
                  </span>
                </span>
              </span>
            </a>
          ))}
      </Group>
    </>
  );
}
