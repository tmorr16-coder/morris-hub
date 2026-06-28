"use client";

import { useState, useEffect, useRef } from "react";
import type { Stock } from "@/lib/stock-research";

interface QuickTradePanelProps {
  stock: Stock;
  onClose: () => void;
}

interface PlacedOrder {
  id: string;
  symbol: string;
  qty: string;
  side: string;
  type: string;
  status: string;
}

const QTY_PRESETS = [1, 5, 10, 25, 100];
type Side = "buy" | "sell";
type OrderType = "market" | "limit";
type Tif = "day" | "gtc";

export default function QuickTradePanel({ stock, onClose }: QuickTradePanelProps) {
  const [visible, setVisible] = useState(false);
  const [side, setSide] = useState<Side>("buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [qty, setQty] = useState("10");
  const [limitPrice, setLimitPrice] = useState((stock.price ?? 0).toFixed(2));
  const [tif, setTif] = useState<Tif>("day");
  const [confirming, setConfirming] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const quantity = parseInt(qty) || 0;
  const lp = parseFloat(limitPrice) || (stock.price ?? 0);
  const estimatedCost = quantity * (orderType === "limit" ? lp : (stock.price ?? 0));
  const isUp = (stock.changeDirection ?? "neutral") !== "down";

  const handlePlace = async () => {
    if (!quantity || quantity <= 0) { setError("Enter a valid quantity"); return; }
    setPlacing(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        symbol: stock.ticker,
        qty: quantity,
        side,
        type: orderType,
        time_in_force: tif,
      };
      if (orderType === "limit") body.limit_price = lp;

      const res = await fetch("/api/investments/alpaca/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Order failed");
      setPlaced(data);
      setConfirming(false);
    } catch (e) {
      setError((e as Error).message);
    }
    setPlacing(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", pointerEvents: "auto" }}>
      <div onClick={handleClose} style={{ flex: 1, background: "rgba(0,0,0,0.2)", transition: "opacity 0.22s", opacity: visible ? 1 : 0 }} />
      <div style={{ width: 360, maxWidth: "90vw", height: "100%", background: "var(--color-bg-card)", borderLeft: "1px solid var(--color-rule)", display: "flex", flexDirection: "column", transform: visible ? "translateX(0)" : "translateX(100%)", transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)", boxShadow: "-8px 0 32px rgba(0,0,0,0.08)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-accent)", marginBottom: 2 }}>Paper Trade · Alpaca</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--color-ink)" }}>
              {stock.ticker}
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--color-ink-3)", marginLeft: 8 }}>${(stock.price ?? 0).toFixed(2)}</span>
              <span style={{ fontSize: 12, marginLeft: 6, color: isUp ? "var(--color-green)" : "var(--color-red)" }}>
                {isUp ? "+" : ""}{(stock.change ?? 0).toFixed(2)}%
              </span>
            </div>
          </div>
          <button onClick={handleClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--color-ink-3)", padding: "4px 8px" }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {placed ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-ink)", marginBottom: 8 }}>Order submitted</div>
              <div style={{ fontSize: 13, color: "var(--color-ink-2)", marginBottom: 4 }}>
                {placed.side.toUpperCase()} {placed.qty} {placed.symbol} · {placed.type}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginBottom: 4 }}>Status: {placed.status}</div>
              <div style={{ fontSize: 10, color: "var(--color-ink-4)" }}>Order ID: {placed.id.slice(0, 8)}…</div>
              <button onClick={() => { setPlaced(null); setQty("10"); }} style={{ marginTop: 20, padding: "8px 20px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-2)", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
                New order
              </button>
            </div>
          ) : (
            <>
              {/* Buy / Sell */}
              <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 10, overflow: "hidden", border: "1px solid var(--color-rule)" }}>
                {(["buy", "sell"] as Side[]).map((s) => (
                  <button key={s} onClick={() => { setSide(s); setError(null); }}
                    style={{ flex: 1, padding: "12px 0", border: "none", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", background: side === s ? (s === "buy" ? "var(--color-green)" : "var(--color-red)") : "transparent", color: side === s ? "#FFFDF8" : "var(--color-ink-3)", transition: "all 0.15s", textTransform: "uppercase" }}>
                    {s}
                  </button>
                ))}
              </div>

              {/* Qty */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", display: "block", marginBottom: 6 }}>Shares</label>
                <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                  {QTY_PRESETS.map((p) => (
                    <button key={p} onClick={() => setQty(String(p))}
                      style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: `1px solid ${qty === String(p) ? "var(--color-accent)" : "var(--color-rule)"}`, background: qty === String(p) ? "var(--color-accent-soft)" : "transparent", color: qty === String(p) ? "var(--color-accent)" : "var(--color-ink-3)", fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                      {p}
                    </button>
                  ))}
                </div>
                <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg)", fontSize: 16, fontFamily: "inherit", color: "var(--color-ink)", outline: "none", boxSizing: "border-box" }} />
              </div>

              {/* Order type */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", display: "block", marginBottom: 6 }}>Type</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["market", "limit"] as OrderType[]).map((t) => (
                    <button key={t} onClick={() => setOrderType(t)}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${orderType === t ? "var(--color-accent)" : "var(--color-rule)"}`, background: orderType === t ? "var(--color-accent-soft)" : "transparent", color: orderType === t ? "var(--color-accent)" : "var(--color-ink-3)", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", textTransform: "uppercase" }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {orderType === "limit" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", display: "block", marginBottom: 6 }}>Limit Price</label>
                  <input type="number" step="0.01" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg)", fontSize: 14, fontFamily: "inherit", color: "var(--color-ink)", outline: "none", boxSizing: "border-box" }} />
                </div>
              )}

              {/* Duration */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", display: "block", marginBottom: 6 }}>Duration</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {([{ v: "day", l: "Day" }, { v: "gtc", l: "GTC" }] as { v: Tif; l: string }[]).map(({ v, l }) => (
                    <button key={v} onClick={() => setTif(v)}
                      style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${tif === v ? "var(--color-accent)" : "var(--color-rule)"}`, background: tif === v ? "var(--color-accent-soft)" : "transparent", color: tif === v ? "var(--color-accent)" : "var(--color-ink-3)", fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estimated cost */}
              <div style={{ padding: "12px 14px", background: "var(--color-bg-deep)", borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-ink-3)", marginBottom: 4 }}>
                  <span>{quantity || 0} shares × {orderType === "limit" ? `$${lp.toFixed(2)}` : `~$${(stock.price ?? 0).toFixed(2)}`}</span>
                  <span style={{ fontSize: 11, color: "var(--color-ink-4)" }}>Commission: $0</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 11, color: "var(--color-ink-3)" }}>Estimated {side === "buy" ? "cost" : "proceeds"}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "var(--color-ink)" }}>{quantity > 0 ? "$" + estimatedCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</span>
                </div>
              </div>

              {error && <div style={{ padding: "10px 12px", background: "rgba(154,59,42,0.06)", border: "1px solid rgba(154,59,42,0.2)", borderRadius: 8, fontSize: 12, color: "var(--color-red)", marginBottom: 16 }}>{error}</div>}

              {!confirming ? (
                <button onClick={() => { if (quantity > 0) { setConfirming(true); setError(null); } else setError("Enter a valid quantity"); }}
                  disabled={!quantity}
                  style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none", background: side === "buy" ? "var(--color-green)" : "var(--color-red)", color: "#FFFDF8", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: !quantity ? "not-allowed" : "pointer", opacity: !quantity ? 0.5 : 1 }}>
                  Review {side.toUpperCase()} {quantity || 0} {stock.ticker}
                </button>
              ) : (
                <div>
                  <div style={{ padding: "12px 14px", background: "rgba(59,92,127,0.06)", border: "1px solid rgba(59,92,127,0.2)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: "var(--color-ink)", marginBottom: 6 }}>Confirm paper order</div>
                    <div style={{ color: "var(--color-ink-2)" }}>{side.toUpperCase()} {quantity} {stock.ticker} · {orderType.toUpperCase()} · {tif.toUpperCase()}</div>
                    {orderType === "limit" && <div style={{ color: "var(--color-ink-3)", fontSize: 12, marginTop: 3 }}>Limit: ${lp.toFixed(2)}</div>}
                    <div style={{ color: "var(--color-ink-3)", fontSize: 12, marginTop: 3 }}>Est. {side === "buy" ? "cost" : "proceeds"}: ${estimatedCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setConfirming(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-2)", fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}>Edit</button>
                    <button onClick={handlePlace} disabled={placing} style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: side === "buy" ? "var(--color-green)" : "var(--color-red)", color: "#FFFDF8", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: placing ? "wait" : "pointer", opacity: placing ? 0.6 : 1 }}>
                      {placing ? "Placing…" : `Place ${side.toUpperCase()} Order`}
                    </button>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 12, fontSize: 10, color: "var(--color-ink-4)", textAlign: "center" }}>Paper trading · Alpaca Markets · No real money</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
