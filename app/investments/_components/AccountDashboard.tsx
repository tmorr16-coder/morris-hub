"use client";

import { useState, useEffect } from "react";
import type { ETradeBalance, ETradePosition } from "@/lib/etrade";
import type { Stock } from "@/lib/stock-research";

interface PortfolioData {
  accountName: string;
  accountIdKey: string;
  balance: ETradeBalance | null;
  positions: ETradePosition[];
}

interface ETradeStatus {
  connected: boolean;
  expired?: boolean;
  accountName?: string;
  connectedAt?: string;
}

interface AccountDashboardProps {
  onSelectStock?: (stock: Stock) => void;
}

function fmt(n: number, prefix = "$"): string {
  return `${prefix}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export default function AccountDashboard({ onSelectStock }: AccountDashboardProps) {
  const [status, setStatus] = useState<ETradeStatus | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch("/api/investments/etrade/status")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        if (data.connected && !data.expired) loadPortfolio();
        else setLoading(false);
      })
      .catch(() => { setStatus({ connected: false }); setLoading(false); });
  }, []);

  const loadPortfolio = async () => {
    setPortfolioLoading(true);
    try {
      const res = await fetch("/api/investments/etrade/portfolio");
      const data = await res.json();
      if (res.ok) setPortfolio(data);
    } catch {}
    setPortfolioLoading(false);
    setLoading(false);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    await fetch("/api/investments/etrade/disconnect", { method: "POST" });
    setStatus({ connected: false });
    setPortfolio(null);
    setDisconnecting(false);
  };

  const totalDayGain = portfolio?.positions.reduce((s, p) => s + p.daysGain, 0) ?? 0;

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!loading && (!status?.connected || status.expired)) {
    return (
      <div
        style={{
          padding: "28px 28px 20px",
          borderBottom: "1px solid var(--color-rule)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>
              E*TRADE
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>
              {status?.expired ? "Session expired — reconnect to continue" : "Connect your brokerage account"}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 3 }}>
              {status?.expired
                ? "E*TRADE sessions reset at midnight ET each trading day."
                : "See your positions, buying power, and day P&L alongside research."}
            </div>
          </div>
          <a
            href="/api/investments/etrade/connect"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 16px",
              borderRadius: 8,
              background: "var(--color-accent)",
              color: "#FFFDF8",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            {status?.expired ? "Reconnect" : "Connect E*TRADE"} →
          </a>
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading || portfolioLoading) {
    return (
      <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--color-rule)", fontSize: 12, color: "var(--color-ink-3)" }}>
        Loading account…
      </div>
    );
  }

  // ── Connected ──────────────────────────────────────────────────────────────
  const b = portfolio?.balance;

  return (
    <div style={{ borderBottom: "1px solid var(--color-rule)" }}>
      {/* Account header */}
      <div style={{ padding: "16px 28px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "rgba(74,107,58,0.1)", color: "var(--color-green)" }}>
            ● Live
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>
            {portfolio?.accountName ?? status?.accountName ?? "E*TRADE"}
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--color-ink-4)", padding: 0 }}
        >
          {disconnecting ? "Disconnecting…" : "Disconnect"}
        </button>
      </div>

      {/* Key metrics */}
      {b && (
        <div style={{ display: "flex", gap: 0, padding: "0 28px 12px" }}>
          {[
            {
              label: "Buying Power",
              value: fmt(b.dayTradingBuyingPower || b.cashBuyingPower),
              sub: b.dayTradingBuyingPower ? "day trading" : "cash",
              color: "var(--color-ink)",
            },
            {
              label: "Day P&L",
              value: (totalDayGain >= 0 ? "+" : "") + fmt(totalDayGain),
              sub: `${b.dayChangePct >= 0 ? "+" : ""}${b.dayChangePct.toFixed(2)}% acct`,
              color: totalDayGain >= 0 ? "var(--color-green)" : "var(--color-red)",
            },
            {
              label: "Total Value",
              value: fmt(b.totalAccountValue),
              sub: "portfolio",
              color: "var(--color-ink)",
            },
          ].map((m) => (
            <div key={m.label} style={{ flex: 1, paddingRight: 16 }}>
              <div style={{ fontSize: 9, color: "var(--color-ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                {m.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: m.color, letterSpacing: "-0.01em" }}>
                {m.value}
              </div>
              <div style={{ fontSize: 10, color: "var(--color-ink-4)" }}>{m.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Positions table */}
      {portfolio && portfolio.positions.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderTop: "1px solid var(--color-rule)", borderBottom: "1px solid var(--color-rule)" }}>
                {["Symbol", "Qty", "Avg Cost", "Price", "Mkt Value", "Day P&L", "Total P&L"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "6px 28px 6px 0",
                      textAlign: h === "Symbol" ? "left" : "right",
                      fontWeight: 600,
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--color-ink-4)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h === "Symbol" ? <span style={{ paddingLeft: 28 }}>{h}</span> : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {portfolio.positions.map((pos) => (
                <tr
                  key={pos.symbol}
                  style={{ borderBottom: "1px solid var(--color-rule-soft)", cursor: onSelectStock ? "pointer" : "default" }}
                  onClick={() => {
                    if (onSelectStock) {
                      onSelectStock({
                        ticker: pos.symbol,
                        name: pos.description,
                        price: pos.currentPrice,
                        change: pos.daysGainPct,
                        changeDirection: pos.daysGain >= 0 ? "up" : "down",
                      });
                    }
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-bg-deep)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                >
                  <td style={{ padding: "8px 0 8px 28px", fontWeight: 700, color: "var(--color-ink)" }}>
                    {pos.symbol}
                    <div style={{ fontSize: 10, fontWeight: 400, color: "var(--color-ink-4)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pos.description}
                    </div>
                  </td>
                  <td style={{ padding: "8px 28px 8px 0", textAlign: "right", color: "var(--color-ink)" }}>{pos.quantity.toLocaleString()}</td>
                  <td style={{ padding: "8px 28px 8px 0", textAlign: "right", color: "var(--color-ink-2)" }}>{fmt(pos.pricePaid)}</td>
                  <td style={{ padding: "8px 28px 8px 0", textAlign: "right", color: "var(--color-ink)" }}>{fmt(pos.currentPrice)}</td>
                  <td style={{ padding: "8px 28px 8px 0", textAlign: "right", color: "var(--color-ink)" }}>{fmt(pos.marketValue)}</td>
                  <td style={{ padding: "8px 28px 8px 0", textAlign: "right", color: pos.daysGain >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                    {(pos.daysGain >= 0 ? "+" : "") + fmt(pos.daysGain)}
                    <div style={{ fontSize: 10 }}>{pct(pos.daysGainPct)}</div>
                  </td>
                  <td style={{ padding: "8px 28px 8px 0", textAlign: "right", color: pos.totalGain >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                    {(pos.totalGain >= 0 ? "+" : "") + fmt(pos.totalGain)}
                    <div style={{ fontSize: 10 }}>{pct(pos.totalGainPct)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {portfolio && portfolio.positions.length === 0 && (
        <div style={{ padding: "12px 28px 16px", fontSize: 12, color: "var(--color-ink-3)" }}>
          No open positions
        </div>
      )}
    </div>
  );
}
