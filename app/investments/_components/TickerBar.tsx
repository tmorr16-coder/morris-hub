"use client";

import { useState, useEffect, useRef } from "react";

interface Quote {
  symbol: string;
  price: number;
  change: number;
  direction: "up" | "down";
}

interface TickerBarProps {
  symbols: string[];
}

function TickerItem({ q }: { q: Quote }) {
  const isUp = q.direction === "up";
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5, padding: "0 20px", borderRight: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#e8ecf0", letterSpacing: "0.04em" }}>{q.symbol}</span>
      <span style={{ fontSize: 11, color: "#e8ecf0" }}>${q.price.toFixed(2)}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: isUp ? "#4ade80" : "#f87171" }}>
        {isUp ? "▲" : "▼"} {Math.abs(q.change).toFixed(2)}%
      </span>
    </span>
  );
}

export default function TickerBar({ symbols }: TickerBarProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchQuotes = async () => {
    if (!symbols.length) return;
    try {
      const res = await fetch(`/api/investments/ticker?symbols=${symbols.join(",")}`);
      const data = await res.json();
      if (data.quotes?.length) {
        setQuotes(data.quotes);
        setVisible(true);
      }
    } catch {}
  };

  useEffect(() => {
    if (!symbols.length) return;
    fetchQuotes();
    intervalRef.current = setInterval(fetchQuotes, 8000);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(",")]);

  if (!visible || !quotes.length) return null;

  // Duplicate items for seamless scroll loop
  const items = [...quotes, ...quotes, ...quotes];
  const duration = Math.max(20, quotes.length * 8);

  return (
    <div
      style={{
        background: "#0f1117",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        height: 32,
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}
    >
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>

      {/* Fade edges */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 48, background: "linear-gradient(to right, #0f1117, transparent)", zIndex: 1, pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 48, background: "linear-gradient(to left, #0f1117, transparent)", zIndex: 1, pointerEvents: "none" }} />

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: "100%",
          animation: `ticker-scroll ${duration}s linear infinite`,
          willChange: "transform",
        }}
      >
        {items.map((q, i) => (
          <TickerItem key={`${q.symbol}-${i}`} q={q} />
        ))}
      </div>
    </div>
  );
}
