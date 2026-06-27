"use client";

import { useState, useEffect, useRef } from "react";
import type { Stock } from "@/lib/stock-research";
import type { OrderAction, OrderPriceType, OrderTerm } from "@/lib/etrade";

interface QuickTradePanelProps {
  stock: Stock;
  onClose: () => void;
}

interface PreviewResult {
  previewId: number;
  cashMargin: string;
  estimatedCommission: number;
  estimatedTotalAmount: number;
}

interface PlacedResult {
  orderId: number;
  symbol: string;
  quantity: number;
  action: string;
}

function fmt(n: number) {
  return "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const QTY_PRESETS = [1, 5, 10, 25, 100];
const ORDER_TERMS: { value: OrderTerm; label: string }[] = [
  { value: "GOOD_FOR_DAY", label: "Day" },
  { value: "GOOD_TILL_CANCEL", label: "GTC" },
  { value: "IMMEDIATE_OR_CANCEL", label: "IOC" },
];

export default function QuickTradePanel({ stock, onClose }: QuickTradePanelProps) {
  const [visible, setVisible] = useState(false);
  const [action, setAction] = useState<OrderAction>("BUY");
  const [priceType, setPriceType] = useState<OrderPriceType>("MARKET");
  const [qty, setQty] = useState<string>("10");
  const [limitPrice, setLimitPrice] = useState<string>((stock.price ?? 0).toFixed(2));
  const [orderTerm, setOrderTerm] = useState<OrderTerm>("GOOD_FOR_DAY");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [placed, setPlaced] = useState<PlacedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [etConnected, setEtConnected] = useState<boolean | null>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    // Check E*TRADE connection
    fetch("/api/investments/etrade/status")
      .then((r) => r.json())
      .then((d) => setEtConnected(d.connected && !d.expired))
      .catch(() => setEtConnected(false));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const quantity = parseInt(qty) || 0;
  const lp = parseFloat(limitPrice) || stock.price;
  const estimatedCost = quantity * (priceType === "LIMIT" ? lp : stock.price);

  const buildOrder = () => ({
    symbol: stock.ticker,
    action,
    quantity,
    priceType,
    limitPrice: priceType === "LIMIT" ? lp : undefined,
    orderTerm,
    marketSession: "REGULAR" as const,
  });

  const handlePreview = async () => {
    if (!quantity || quantity <= 0) { setError("Enter a valid quantity"); return; }
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch("/api/investments/etrade/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "preview", order: buildOrder() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Preview failed");
      setPreview(data);
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  };

  const handlePlace = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/investments/etrade/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "place",
          order: buildOrder(),
          previewId: preview.previewId,
          cashMargin: preview.cashMargin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlaced(data);
      setPreview(null);
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  };

  const isUp = stock.changeDirection !== "down";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", pointerEvents: "auto" }}>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{ flex: 1, background: "rgba(0,0,0,0.2)", transition: "opacity 0.22s", opacity: visible ? 1 : 0 }}
      />

      {/* Panel */}
      <div
        style={{
          width: 380,
          maxWidth: "90vw",
          height: "100%",
          background: "var(--color-bg-card)",
          borderLeft: "1px solid var(--color-rule)",
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.08)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-accent)", marginBottom: 2 }}>
              Quick Trade
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--color-ink)" }}>
              {stock.ticker}
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--color-ink-3)", marginLeft: 8 }}>{fmt(stock.price)}</span>
              <span style={{ fontSize: 12, marginLeft: 6, color: isUp ? "var(--color-green)" : "var(--color-red)" }}>
                {isUp ? "+" : ""}{(stock.change ?? 0).toFixed(2)}%
              </span>
            </div>
          </div>
          <button onClick={handleClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--color-ink-3)", padding: "4px 8px" }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {/* Not connected warning */}
          {etConnected === false && (
            <div style={{ padding: "12px 14px", background: "rgba(184,138,46,0.08)", border: "1px solid rgba(184,138,46,0.25)", borderRadius: 8, fontSize: 12, color: "var(--color-amber)", marginBottom: 16 }}>
              E*TRADE not connected. Connect your account from the home panel to place orders.
            </div>
          )}

          {placed ? (
            // ── Confirmation ──────────────────────────────────────────────
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-ink)", marginBottom: 8 }}>Order placed</div>
              <div style={{ fontSize: 13, color: "var(--color-ink-2)", marginBottom: 4 }}>
                {placed.action} {placed.quantity} shares of {placed.symbol}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-ink-4)" }}>Order #{placed.orderId}</div>
              <button
                onClick={() => { setPlaced(null); setPreview(null); setQty("10"); }}
                style={{ marginTop: 20, padding: "8px 20px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-2)", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}
              >
                New order
              </button>
            </div>
          ) : (
            <>
              {/* ── Buy / Sell toggle ── */}
              <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 10, overflow: "hidden", border: "1px solid var(--color-rule)" }}>
                {(["BUY", "SELL"] as OrderAction[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => { setAction(a); setPreview(null); setError(null); }}
                    style={{
                      flex: 1, padding: "12px 0", border: "none", fontFamily: "inherit",
                      fontSize: 14, fontWeight: 700, cursor: "pointer",
                      background: action === a
                        ? (a === "BUY" ? "var(--color-green)" : "var(--color-red)")
                        : "transparent",
                      color: action === a ? "#FFFDF8" : "var(--color-ink-3)",
                      transition: "all 0.15s",
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>

              {/* ── Shares ── */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", display: "block", marginBottom: 6 }}>
                  Shares
                </label>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {QTY_PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setQty(String(p)); setPreview(null); }}
                      style={{
                        flex: 1, padding: "5px 0", borderRadius: 6,
                        border: `1px solid ${qty === String(p) ? "var(--color-accent)" : "var(--color-rule)"}`,
                        background: qty === String(p) ? "var(--color-accent-soft)" : "transparent",
                        color: qty === String(p) ? "var(--color-accent)" : "var(--color-ink-3)",
                        fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <input
                  ref={qtyRef}
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => { setQty(e.target.value); setPreview(null); }}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    border: "1px solid var(--color-rule)", background: "var(--color-bg)",
                    fontSize: 16, fontFamily: "inherit", color: "var(--color-ink)", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* ── Order type ── */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", display: "block", marginBottom: 6 }}>
                  Order type
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["MARKET", "LIMIT"] as OrderPriceType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setPriceType(t); setPreview(null); }}
                      style={{
                        flex: 1, padding: "8px 0", borderRadius: 8,
                        border: `1px solid ${priceType === t ? "var(--color-accent)" : "var(--color-rule)"}`,
                        background: priceType === t ? "var(--color-accent-soft)" : "transparent",
                        color: priceType === t ? "var(--color-accent)" : "var(--color-ink-3)",
                        fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Limit price ── */}
              {priceType === "LIMIT" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", display: "block", marginBottom: 6 }}>
                    Limit price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={limitPrice}
                    onChange={(e) => { setLimitPrice(e.target.value); setPreview(null); }}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 8,
                      border: "1px solid var(--color-rule)", background: "var(--color-bg)",
                      fontSize: 14, fontFamily: "inherit", color: "var(--color-ink)", outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              {/* ── Duration ── */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", display: "block", marginBottom: 6 }}>
                  Duration
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {ORDER_TERMS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setOrderTerm(t.value)}
                      style={{
                        flex: 1, padding: "7px 0", borderRadius: 8,
                        border: `1px solid ${orderTerm === t.value ? "var(--color-accent)" : "var(--color-rule)"}`,
                        background: orderTerm === t.value ? "var(--color-accent-soft)" : "transparent",
                        color: orderTerm === t.value ? "var(--color-accent)" : "var(--color-ink-3)",
                        fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Estimated cost ── */}
              <div style={{ padding: "12px 14px", background: "var(--color-bg-deep)", borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-ink-3)", marginBottom: 4 }}>
                  <span>{quantity || 0} shares × {priceType === "LIMIT" ? fmt(lp) : `~${fmt(stock.price)}`}</span>
                  <span style={{ fontSize: 12, color: "var(--color-ink-4)" }}>Commission: $0</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 11, color: "var(--color-ink-3)" }}>
                    Estimated {action === "BUY" ? "cost" : "proceeds"}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "var(--color-ink)" }}>
                    {quantity > 0 ? fmt(estimatedCost) : "—"}
                  </span>
                </div>
              </div>

              {/* ── Preview result ── */}
              {preview && (
                <div style={{ padding: "12px 14px", background: "rgba(59,92,127,0.06)", border: "1px solid rgba(59,92,127,0.2)", borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-accent)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Order preview confirmed
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-ink-2)", marginBottom: 3 }}>
                    <span>Estimated total</span>
                    <span style={{ fontWeight: 600 }}>{fmt(preview.estimatedTotalAmount)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-ink-3)" }}>
                    <span>Commission</span>
                    <span>${(preview.estimatedCommission ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* ── Error ── */}
              {error && (
                <div style={{ padding: "10px 12px", background: "rgba(154,59,42,0.06)", border: "1px solid rgba(154,59,42,0.2)", borderRadius: 8, fontSize: 12, color: "var(--color-red)", marginBottom: 16 }}>
                  {error}
                </div>
              )}

              {/* ── Action button ── */}
              {!preview ? (
                <button
                  onClick={handlePreview}
                  disabled={loading || !quantity || quantity <= 0 || etConnected === false}
                  style={{
                    width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
                    background: action === "BUY" ? "var(--color-green)" : "var(--color-red)",
                    color: "#FFFDF8", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                    cursor: loading || !quantity ? "not-allowed" : "pointer",
                    opacity: loading || !quantity || etConnected === false ? 0.5 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  {loading ? "Previewing…" : `Preview ${action} ${quantity || 0} ${stock.ticker}`}
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => { setPreview(null); setError(null); }}
                    style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-2)", fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={handlePlace}
                    disabled={loading}
                    style={{
                      flex: 2, padding: "12px 0", borderRadius: 10, border: "none",
                      background: action === "BUY" ? "var(--color-green)" : "var(--color-red)",
                      color: "#FFFDF8", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                      cursor: loading ? "wait" : "pointer",
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? "Placing…" : `Place ${action} Order`}
                  </button>
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: 10, color: "var(--color-ink-4)", textAlign: "center" }}>
                Orders placed through your E*TRADE brokerage account · Not investment advice
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
