"use client";

import { useState, useEffect } from "react";
import type { Stock } from "@/lib/stock-research";
import { NavBar, Segmented, Group, Icons } from "@/components/ios";
import PriceChart from "./PriceChart";
import DeepResearchPanel from "./DeepResearchPanel";
import QuickTradePanel from "./QuickTradePanel";
import NewsPanel from "./NewsPanel";

interface StockMetrics {
  weekHigh52: number | null;
  weekLow52: number | null;
  avgVolume: string | null;
  peRatio: number | null;
  marketCap: string | null;
  exchange: string | null;
}

interface StockMainViewProps {
  stock: Stock;
  isWatched: boolean;
  onToggleWatch: () => void;
  onClose: () => void;
  /** Whether the user has a connected Alpaca brokerage. Gates the Trade tab. */
  brokerageConnected: boolean;
}

type Tab = "overview" | "research" | "news" | "trade";

export default function StockMainView({
  stock,
  isWatched,
  onToggleWatch,
  onClose,
  brokerageConnected,
}: StockMainViewProps) {
  const [metrics, setMetrics] = useState<StockMetrics | null>(null);
  const [showTrade, setShowTrade] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    fetch(`/api/investments/metrics?ticker=${stock.ticker}`)
      .then((r) => r.json())
      .then((data) => setMetrics(data))
      .catch(() => {});
  }, [stock.ticker]);

  const isUp = stock.changeDirection !== "down";
  const trendColor = isUp ? "var(--ios-green)" : "var(--ios-red)";

  const weekRange =
    metrics?.weekHigh52 && metrics?.weekLow52
      ? `$${metrics.weekLow52.toFixed(0)} – $${metrics.weekHigh52.toFixed(0)}`
      : null;

  const statRows: { label: string; value: string | null }[] = [
    { label: "Market cap", value: metrics?.marketCap ?? null },
    { label: "P/E (TTM)", value: metrics?.peRatio ? metrics.peRatio.toFixed(1) : null },
    { label: "Avg volume", value: metrics?.avgVolume ?? null },
    { label: "52-week range", value: weekRange },
    { label: "Exchange", value: metrics?.exchange ?? null },
    { label: "Sector", value: stock.sector ?? null },
  ];

  return (
    <div>
      <NavBar
        back={{ label: "Stocks", onBack: onClose }}
        trailing={
          <button
            onClick={onToggleWatch}
            aria-label={isWatched ? "Remove from watchlist" : "Add to watchlist"}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, color: isWatched ? "var(--ios-red)" : "var(--ios-tint)" }}
          >
            <Icons.HeartIcon style={{ width: 22, height: 22 }} />
          </button>
        }
      />

      {/* Price hero */}
      <div style={{ padding: "4px var(--ios-gutter) 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h1 className="ios-large-title" style={{ margin: 0 }}>{stock.ticker}</h1>
          {metrics?.exchange && <span className="ios-chip ios-chip--sm">{metrics.exchange}</span>}
        </div>
        <div className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>{stock.name}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
          <span className="ios-num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.01em" }}>
            ${(stock.price ?? 0).toFixed(2)}
          </span>
          <span className="ios-num ios-headline" style={{ color: trendColor }}>
            {isUp ? "▲" : "▼"} {Math.abs(stock.change ?? 0).toFixed(2)}% today
          </span>
        </div>
      </div>

      {/* Price chart hero */}
      <div className="ios-list" style={{ margin: "14px var(--ios-gutter) 0", padding: "14px 16px" }}>
        <PriceChart
          ticker={stock.ticker}
          currentPrice={stock.price}
          changeDirection={stock.changeDirection}
        />
      </div>

      <Segmented
        ariaLabel="Section"
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Overview" },
          { value: "research", label: "Research" },
          { value: "news", label: "News" },
          { value: "trade", label: "Trade" },
        ]}
      />

      {tab === "overview" && (
        <Group header="Key statistics">
          {statRows.map((r) => (
            <div key={r.label} className="ios-cell">
              <span className="ios-cell-body"><span className="ios-cell-title" style={{ fontSize: 16 }}>{r.label}</span></span>
              <span className="ios-cell-trail ios-num" style={{ color: "var(--ios-label)" }}>{r.value ?? "—"}</span>
            </div>
          ))}
        </Group>
      )}

      {tab === "research" && (
        <div style={{ padding: "16px var(--ios-gutter) 0" }}>
          <DeepResearchPanel stock={stock} />
        </div>
      )}

      {tab === "news" && <NewsPanel ticker={stock.ticker} tickerName={stock.name} />}

      {tab === "trade" && (
        brokerageConnected ? (
          <Group header="Paper trade" footer="Orders route to your Alpaca paper account — no real money.">
            <button className="ios-cell" onClick={() => setShowTrade(true)}>
              <span className="ios-cell-body">
                <span className="ios-cell-title" style={{ color: "var(--ios-tint)", fontWeight: 600 }}>
                  Trade {stock.ticker}
                </span>
                <span className="ios-cell-sub">Buy or sell at ${(stock.price ?? 0).toFixed(2)}</span>
              </span>
              <Icons.ChevronRight className="ios-chevron" />
            </button>
          </Group>
        ) : (
          <Group header="Paper trade" footer="Connect a brokerage to place paper trades.">
            <a className="ios-cell" href="/investments">
              <span className="ios-cell-body">
                <span className="ios-cell-title" style={{ color: "var(--ios-tint)", fontWeight: 600 }}>
                  Connect a brokerage
                </span>
                <span className="ios-cell-sub">Set up your Alpaca paper account to trade {stock.ticker}</span>
              </span>
              <Icons.ChevronRight className="ios-chevron" />
            </a>
          </Group>
        )
      )}

      <div style={{ height: 20 }} />

      {showTrade && brokerageConnected && <QuickTradePanel stock={stock} onClose={() => setShowTrade(false)} />}
    </div>
  );
}
