"use client";

import { useState, useEffect } from "react";

interface IndexData {
  key: string;
  label: string;
  price: number;
  change: number;
  changePct: number;
  direction: "up" | "down";
}

function fmtPrice(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtChange(n: number): string {
  return (n >= 0 ? "+" : "") + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MarketBar() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [marketOpen, setMarketOpen] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/investments/indices");
      const data = await res.json();
      if (data.indices?.length) setIndices(data.indices);
      setMarketOpen(data.marketOpen ?? false);
    } catch {}
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!indices.length) return null;

  return (
    <div
      style={{
        background: "var(--ios-cell)",
        borderBottom: "1px solid var(--ios-separator)",
        padding: "0 20px",
        height: 36,
        display: "flex",
        alignItems: "center",
        gap: 0,
        flexShrink: 0,
        overflowX: "auto",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {indices.map((idx, i) => {
        const isUp = idx.direction === "up";
        const color = isUp ? "var(--ios-green)" : "var(--ios-red)";
        return (
          <div
            key={idx.key}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              paddingRight: 24,
              marginRight: i < indices.length - 1 ? 4 : 0,
              borderRight: i < indices.length - 1 ? "1px solid var(--ios-separator)" : "none",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ios-label-2)", letterSpacing: "0.04em" }}>
              {idx.label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ios-label)" }}>
              {fmtPrice(idx.price)}
            </span>
            <span style={{ fontSize: 10, color }}>
              {isUp ? "▲" : "▼"} {fmtChange(idx.change)} {fmtChange(idx.changePct)}%
            </span>
          </div>
        );
      })}

      {/* Market status — right-aligned */}
      <div style={{ marginLeft: "auto", paddingLeft: 16, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: marketOpen ? "var(--ios-green)" : "var(--ios-label-3)",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 10, color: "var(--ios-label-2)", whiteSpace: "nowrap" }}>
          US Markets {marketOpen ? "Open" : "Closed"}
        </span>
      </div>
    </div>
  );
}
