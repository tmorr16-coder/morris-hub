"use client";

import { useState, useEffect } from "react";
import type { AlpacaAccount, AlpacaPosition, AlpacaClock } from "@/lib/alpaca";
import type { Stock } from "@/lib/stock-research";
import { Group } from "@/components/ios";

interface AccountData {
  account: AlpacaAccount;
  positions: AlpacaPosition[];
  clock: AlpacaClock;
}

interface AccountDashboardProps {
  onSelectStock?: (stock: Stock) => void;
}

function fmt(n: number | string, prefix = "$"): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(v)) return "—";
  return prefix + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n: number | string): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(v)) return "—";
  return (v >= 0 ? "+" : "") + (v * 100).toFixed(2) + "%";
}

function MarketDot({ open }: { open: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 12, fontWeight: 600,
        color: open ? "var(--ios-green)" : "var(--ios-label-2)",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: open ? "var(--ios-green)" : "var(--ios-label-3)" }} />
      {open ? "Market open" : "Market closed"}
    </span>
  );
}

function TickerBadge({ sym }: { sym: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 38, height: 38, borderRadius: 9, background: "var(--ios-fill)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ios-label)", flexShrink: 0,
      }}
    >
      {sym.slice(0, 4)}
    </span>
  );
}

export default function AccountDashboard({ onSelectStock }: AccountDashboardProps) {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/investments/alpaca/account");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load account");
      if (json.connected === false) {
        setNotConnected(true);
        setData(null);
      } else {
        setData(json);
        setNotConnected(false);
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <Group header="Paper account">
        <div className="ios-cell" style={{ color: "var(--ios-label-2)" }}>Loading account…</div>
      </Group>
    );
  }

  if (notConnected) {
    return (
      <Group header="Brokerage" footer="Connect your own Alpaca keys to enable paper or live trading.">
        <a className="ios-cell" href="/investments" style={{ color: "var(--ios-tint)" }}>
          Connect a brokerage
        </a>
      </Group>
    );
  }

  if (error) {
    return (
      <Group header="Alpaca paper trading">
        <div className="ios-cell" style={{ color: "var(--ios-red)" }}>{error}</div>
      </Group>
    );
  }

  if (!data) return null;

  const { account, positions, clock } = data;
  const portfolioValue = parseFloat(account.portfolio_value);
  const lastEquity = parseFloat(account.last_equity);
  const dayPnl = portfolioValue - lastEquity;
  const dayPnlPct = lastEquity ? ((dayPnl / lastEquity) * 100).toFixed(2) : "0.00";
  const buyingPower = parseFloat(account.buying_power);
  const dayPnlColor = dayPnl >= 0 ? "var(--ios-green)" : "var(--ios-red)";

  return (
    <>
      <Group header="Alpaca paper account">
        {/* Hero summary */}
        <button
          className="ios-cell"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          style={{ alignItems: "flex-start" }}
        >
          <span className="ios-cell-body">
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <MarketDot open={clock.is_open} />
              <span className="ios-footnote" style={{ color: "var(--ios-tint)" }}>{collapsed ? "Show positions" : "Hide"}</span>
            </span>
            <span className="ios-num" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ios-label)" }}>
              {fmt(portfolioValue)}
            </span>
            <span className="ios-subhead" style={{ color: dayPnlColor, marginTop: 2 }}>
              {dayPnl >= 0 ? "▲" : "▼"} {fmt(Math.abs(dayPnl))} ({dayPnl >= 0 ? "+" : ""}{dayPnlPct}%) today
            </span>
          </span>
        </button>

        {/* Stat row */}
        <div className="ios-cell" style={{ gap: 0 }}>
          <span className="ios-cell-body" style={{ flexDirection: "row", gap: 0 }}>
            {[
              { label: "Buying power", value: fmt(buyingPower), color: "var(--ios-label)" },
              { label: "Day P&L", value: (dayPnl >= 0 ? "+" : "") + fmt(Math.abs(dayPnl)), color: dayPnlColor },
              { label: "Positions", value: String(positions.length), color: "var(--ios-label)" },
            ].map((m) => (
              <span key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                <span className="ios-caption" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{m.label}</span>
                <span className="ios-num" style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.value}</span>
              </span>
            ))}
          </span>
        </div>
      </Group>

      {!collapsed && positions.length > 0 && (
        <Group header="Positions">
          {positions.map((pos) => {
            const dayGain = parseFloat(pos.unrealized_intraday_pl);
            const totalGain = parseFloat(pos.unrealized_pl);
            const price = parseFloat(pos.current_price);
            const mktVal = parseFloat(pos.market_value);
            const qty = parseFloat(pos.qty);
            const dayPct = parseFloat(pos.unrealized_intraday_plpc);
            const totalPct = parseFloat(pos.unrealized_plpc);
            return (
              <button
                key={pos.symbol}
                className="ios-cell"
                onClick={() => onSelectStock?.({
                  ticker: pos.symbol,
                  name: pos.symbol,
                  price,
                  change: dayPct * 100,
                  changeDirection: dayGain >= 0 ? "up" : "down",
                })}
              >
                <span className="ios-cell-lead"><TickerBadge sym={pos.symbol} /></span>
                <span className="ios-cell-body">
                  <span className="ios-cell-title" style={{ fontWeight: 600 }}>{pos.symbol}</span>
                  <span className="ios-cell-sub">{qty.toLocaleString()} sh · {fmt(mktVal)}</span>
                </span>
                <span className="ios-cell-trail" style={{ flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                  <span className="ios-num" style={{ color: "var(--ios-label)", fontSize: 15 }}>{fmt(price)}</span>
                  <span className="ios-num" style={{ color: totalGain >= 0 ? "var(--ios-green)" : "var(--ios-red)", fontSize: 13, fontWeight: 600 }}>
                    {(totalGain >= 0 ? "+" : "−")}{fmt(Math.abs(totalGain))} ({pct(totalPct)})
                  </span>
                </span>
              </button>
            );
          })}
        </Group>
      )}

      {!collapsed && positions.length === 0 && (
        <Group footer="Paper trading account ready · no real money">
          <div className="ios-cell" style={{ color: "var(--ios-label-2)" }}>No open positions</div>
        </Group>
      )}
    </>
  );
}
