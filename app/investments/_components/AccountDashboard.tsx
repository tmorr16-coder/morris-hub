"use client";

import { useState, useEffect } from "react";
import type { AlpacaAccount, AlpacaPosition, AlpacaClock } from "@/lib/alpaca";
import type { Stock } from "@/lib/stock-research";

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

export default function AccountDashboard({ onSelectStock }: AccountDashboardProps) {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/investments/alpaca/account");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load account");
      setData(json);
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
      <div style={{ padding: "16px 28px", fontSize: 12, color: "var(--color-ink-3)", borderBottom: "1px solid var(--color-rule)" }}>
        Loading account…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "16px 28px", borderBottom: "1px solid var(--color-rule)" }}>
        <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginBottom: 4 }}>Alpaca Paper Trading</div>
        <div style={{ fontSize: 12, color: "var(--color-red)" }}>{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const { account, positions, clock } = data;
  const portfolioValue = parseFloat(account.portfolio_value);
  const lastEquity = parseFloat(account.last_equity);
  const dayPnl = portfolioValue - lastEquity;
  const dayPnlPct = lastEquity ? ((dayPnl / lastEquity) * 100).toFixed(2) : "0.00";
  const buyingPower = parseFloat(account.buying_power);
  const dayPnlColor = dayPnl >= 0 ? "var(--color-green)" : "var(--color-red)";

  // ── Collapsed: single-line summary bar ──────────────────────────────────────
  if (collapsed) {
    return (
      <div
        style={{ borderBottom: "1px solid var(--color-rule)", background: "var(--color-bg)", cursor: "pointer" }}
        onClick={() => setCollapsed(false)}
      >
        <div style={{ padding: "8px 20px", display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 8, background: clock.is_open ? "rgba(74,107,58,0.1)" : "rgba(138,130,120,0.1)", color: clock.is_open ? "var(--color-green)" : "var(--color-ink-3)", whiteSpace: "nowrap" }}>
            {clock.is_open ? "● Open" : "○ Closed"}
          </span>
          <span style={{ fontWeight: 600, color: "var(--color-ink)", whiteSpace: "nowrap" }}>Alpaca Paper</span>
          <span style={{ color: "var(--color-ink-3)", fontSize: 11 }}>BP: <span style={{ color: "var(--color-ink)", fontWeight: 500 }}>{fmt(buyingPower)}</span></span>
          <span style={{ color: "var(--color-ink-3)", fontSize: 11 }}>Day: <span style={{ color: dayPnlColor, fontWeight: 500 }}>{(dayPnl >= 0 ? "+" : "") + fmt(Math.abs(dayPnl))}</span> <span style={{ color: dayPnlColor }}>({dayPnl >= 0 ? "+" : ""}{dayPnlPct}%)</span></span>
          {positions.length > 0 && <span style={{ color: "var(--color-ink-4)", fontSize: 11 }}>{positions.length} position{positions.length !== 1 ? "s" : ""}</span>}
          <span style={{ marginLeft: "auto", color: "var(--color-ink-4)", fontSize: 13 }}>▼</span>
        </div>
      </div>
    );
  }

  // ── Expanded ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ borderBottom: "1px solid var(--color-rule)" }}>
      {/* Header */}
      <div style={{ padding: "12px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: clock.is_open ? "rgba(74,107,58,0.1)" : "rgba(138,130,120,0.12)", color: clock.is_open ? "var(--color-green)" : "var(--color-ink-3)" }}>
            {clock.is_open ? "● Market Open" : "○ Market Closed"}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink)" }}>Alpaca Paper</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--color-ink-4)", padding: 0 }}>↻</button>
          <button onClick={() => setCollapsed(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-ink-4)", padding: 0 }}>▲</button>
        </div>
      </div>

      {/* Key metrics */}
      <div style={{ display: "flex", gap: 0, padding: "0 20px 12px" }}>
        {[
          { label: "Buying Power", value: fmt(buyingPower), sub: "available cash", color: "var(--color-ink)" },
          { label: "Day P&L", value: (dayPnl >= 0 ? "+" : "") + fmt(Math.abs(dayPnl)), sub: (parseFloat(dayPnlPct) >= 0 ? "+" : "") + dayPnlPct + "%", color: dayPnl >= 0 ? "var(--color-green)" : "var(--color-red)" },
          { label: "Portfolio Value", value: fmt(portfolioValue), sub: `${positions.length} positions`, color: "var(--color-ink)" },
        ].map((m) => (
          <div key={m.label} style={{ flex: 1, paddingRight: 16 }}>
            <div style={{ fontSize: 9, color: "var(--color-ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{m.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: m.color, letterSpacing: "-0.01em" }}>{m.value}</div>
            <div style={{ fontSize: 10, color: "var(--color-ink-4)" }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Positions table */}
      {positions.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderTop: "1px solid var(--color-rule)", borderBottom: "1px solid var(--color-rule)" }}>
                {["Symbol", "Qty", "Avg Cost", "Price", "Mkt Value", "Day P&L", "Total P&L"].map((h) => (
                  <th key={h} style={{ padding: "6px 12px 6px 0", textAlign: h === "Symbol" ? "left" : "right", fontWeight: 600, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-4)", whiteSpace: "nowrap" }}>
                    {h === "Symbol" ? <span style={{ paddingLeft: 28 }}>{h}</span> : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const dayGain = parseFloat(pos.unrealized_intraday_pl);
                const totalGain = parseFloat(pos.unrealized_pl);
                const price = parseFloat(pos.current_price);
                const mktVal = parseFloat(pos.market_value);
                const avgCost = parseFloat(pos.avg_entry_price);
                const qty = parseFloat(pos.qty);
                const dayPct = parseFloat(pos.unrealized_intraday_plpc);
                const totalPct = parseFloat(pos.unrealized_plpc);
                return (
                  <tr
                    key={pos.symbol}
                    style={{ borderBottom: "1px solid var(--color-rule-soft)", cursor: onSelectStock ? "pointer" : "default" }}
                    onClick={() => onSelectStock?.({
                      ticker: pos.symbol,
                      name: pos.symbol,
                      price,
                      change: dayPct * 100,
                      changeDirection: dayGain >= 0 ? "up" : "down",
                    })}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-bg-deep)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                  >
                    <td style={{ padding: "8px 0 8px 20px", fontWeight: 700, color: "var(--color-ink)" }}>{pos.symbol}</td>
                    <td style={{ padding: "8px 12px 8px 0", textAlign: "right", color: "var(--color-ink)" }}>{qty.toLocaleString()}</td>
                    <td style={{ padding: "8px 12px 8px 0", textAlign: "right", color: "var(--color-ink-2)" }}>{fmt(avgCost)}</td>
                    <td style={{ padding: "8px 12px 8px 0", textAlign: "right", color: "var(--color-ink)" }}>{fmt(price)}</td>
                    <td style={{ padding: "8px 12px 8px 0", textAlign: "right", color: "var(--color-ink)" }}>{fmt(mktVal)}</td>
                    <td style={{ padding: "8px 12px 8px 0", textAlign: "right", color: dayGain >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                      {(dayGain >= 0 ? "+" : "") + fmt(Math.abs(dayGain))}
                      <div style={{ fontSize: 10 }}>{pct(dayPct)}</div>
                    </td>
                    <td style={{ padding: "8px 12px 8px 0", textAlign: "right", color: totalGain >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                      {(totalGain >= 0 ? "+" : "") + fmt(Math.abs(totalGain))}
                      <div style={{ fontSize: 10 }}>{pct(totalPct)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {positions.length === 0 && (
        <div style={{ padding: "8px 20px 14px", fontSize: 12, color: "var(--color-ink-3)" }}>
          No open positions · Paper trading account ready
        </div>
      )}
    </div>
  );
}
