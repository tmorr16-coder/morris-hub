"use client";

import { useState, useEffect } from "react";
import type { Stock } from "@/lib/stock-research";
import { Chip } from "@/components/ios";

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

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  background: "var(--ios-fill-2)",
  fontSize: 17,
  fontFamily: "inherit",
  color: "var(--ios-label)",
  outline: "none",
  boxSizing: "border-box",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 7 }}>
      {children}
    </div>
  );
}

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
    setTimeout(onClose, 240);
  };

  const quantity = parseInt(qty) || 0;
  const lp = parseFloat(limitPrice) || (stock.price ?? 0);
  const estimatedCost = quantity * (orderType === "limit" ? lp : (stock.price ?? 0));
  const isUp = (stock.changeDirection ?? "neutral") !== "down";
  const sideColor = side === "buy" ? "var(--ios-green)" : "var(--ios-red)";

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
    <>
      <div
        className="ios-sheet-backdrop"
        onClick={handleClose}
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.24s", animation: "none" }}
      />
      <div
        className="ios-sheet"
        style={{
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.28s cubic-bezier(0.32,0.72,0,1)",
          animation: "none",
        }}
      >
        <div className="ios-grabber" />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 0 4px" }}>
          <div>
            <div className="ios-title-3">{stock.ticker}</div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
              <span className="ios-num">${(stock.price ?? 0).toFixed(2)}</span>
              <span style={{ color: isUp ? "var(--ios-green)" : "var(--ios-red)", marginLeft: 6 }}>
                {isUp ? "▲" : "▼"} {Math.abs(stock.change ?? 0).toFixed(2)}%
              </span>
              {" · Paper trade"}
            </div>
          </div>
          <button onClick={handleClose} aria-label="Close" style={{ color: "var(--ios-label-3)", padding: 4, display: "flex" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="12" cy="12" r="11" />
              <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="var(--ios-bg-elevated)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {placed ? (
          <div style={{ textAlign: "center", padding: "28px 0 12px" }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--ios-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px" }} aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12.5l2.5 2.5L16 9" />
            </svg>
            <div className="ios-title-3" style={{ marginBottom: 6 }}>Order submitted</div>
            <div className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>
              {placed.side.toUpperCase()} {placed.qty} {placed.symbol} · {placed.type}
            </div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-3)", marginTop: 4 }}>Status: {placed.status}</div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>Order ID: {placed.id.slice(0, 8)}…</div>
            <button
              className="ios-btn ios-btn--primary"
              style={{ marginTop: 20 }}
              onClick={() => { setPlaced(null); setQty("10"); }}
            >
              New order
            </button>
          </div>
        ) : (
          <div style={{ paddingTop: 8 }}>
            {/* Buy / Sell */}
            <div className="ios-segmented" role="tablist" aria-label="Side" style={{ margin: "0 0 18px" }}>
              {(["buy", "sell"] as Side[]).map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={side === s}
                  onClick={() => { setSide(s); setError(null); }}
                  style={{
                    textTransform: "uppercase", fontWeight: 700,
                    background: side === s ? (s === "buy" ? "var(--ios-green)" : "var(--ios-red)") : "transparent",
                    color: side === s ? "#fff" : "var(--ios-label)",
                    boxShadow: "none",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Shares */}
            <div style={{ marginBottom: 16 }}>
              <Label>Shares</Label>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                {QTY_PRESETS.map((p) => (
                  <Chip key={p} small selected={qty === String(p)} onClick={() => setQty(String(p))}>{p}</Chip>
                ))}
              </div>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} style={fieldStyle} />
            </div>

            {/* Order type */}
            <div style={{ marginBottom: 16 }}>
              <Label>Order type</Label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["market", "limit"] as OrderType[]).map((t) => (
                  <Chip key={t} selected={orderType === t} onClick={() => setOrderType(t)}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Chip>
                ))}
              </div>
            </div>

            {orderType === "limit" && (
              <div style={{ marginBottom: 16 }}>
                <Label>Limit price</Label>
                <input type="number" step="0.01" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} style={fieldStyle} />
              </div>
            )}

            {/* Duration */}
            <div style={{ marginBottom: 18 }}>
              <Label>Duration</Label>
              <div style={{ display: "flex", gap: 6 }}>
                {([{ v: "day", l: "Day" }, { v: "gtc", l: "GTC" }] as { v: Tif; l: string }[]).map(({ v, l }) => (
                  <Chip key={v} selected={tif === v} onClick={() => setTif(v)}>{l}</Chip>
                ))}
              </div>
            </div>

            {/* Estimated cost */}
            <div className="ios-list" style={{ margin: "0 0 16px", padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }} className="ios-footnote">
                <span style={{ color: "var(--ios-label-2)" }}>{quantity || 0} × {orderType === "limit" ? `$${lp.toFixed(2)}` : `~$${(stock.price ?? 0).toFixed(2)}`}</span>
                <span style={{ color: "var(--ios-label-3)" }}>Commission $0</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
                <span className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>Estimated {side === "buy" ? "cost" : "proceeds"}</span>
                <span className="ios-num" style={{ fontSize: 22, fontWeight: 700, color: "var(--ios-label)" }}>
                  {quantity > 0 ? "$" + estimatedCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                </span>
              </div>
            </div>

            {error && (
              <div className="ios-footnote" style={{ color: "var(--ios-red)", margin: "0 4px 14px" }}>{error}</div>
            )}

            {!confirming ? (
              <button
                onClick={() => { if (quantity > 0) { setConfirming(true); setError(null); } else setError("Enter a valid quantity"); }}
                disabled={!quantity}
                className="ios-btn ios-btn--primary"
                style={{ background: sideColor, opacity: !quantity ? 0.5 : 1 }}
              >
                Review {side.toUpperCase()} {quantity || 0} {stock.ticker}
              </button>
            ) : (
              <div>
                <div className="ios-list" style={{ margin: "0 0 12px", padding: "12px 16px" }}>
                  <div className="ios-headline" style={{ marginBottom: 6 }}>Confirm paper order</div>
                  <div className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>
                    {side.toUpperCase()} {quantity} {stock.ticker} · {orderType.toUpperCase()} · {tif.toUpperCase()}
                  </div>
                  {orderType === "limit" && <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 3 }}>Limit: ${lp.toFixed(2)}</div>}
                  <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 3 }}>
                    Est. {side === "buy" ? "cost" : "proceeds"}: ${estimatedCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setConfirming(false)} className="ios-btn" style={{ flex: 1, background: "var(--ios-fill)", color: "var(--ios-label)" }}>Edit</button>
                  <button onClick={handlePlace} disabled={placing} className="ios-btn ios-btn--primary" style={{ flex: 2, background: sideColor, opacity: placing ? 0.6 : 1 }}>
                    {placing ? "Placing…" : `Place ${side.toUpperCase()} order`}
                  </button>
                </div>
              </div>
            )}
            <div className="ios-caption" style={{ marginTop: 12, color: "var(--ios-label-3)", textAlign: "center" }}>
              Paper trading · Alpaca Markets · No real money
            </div>
          </div>
        )}
      </div>
    </>
  );
}
