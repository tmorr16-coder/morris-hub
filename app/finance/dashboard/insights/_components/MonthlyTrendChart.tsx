"use client";

import { useState } from "react";

export interface MonthTx {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string;
  isIncome: boolean;
}

export interface MonthPoint {
  key: string;
  label: string;
  outflow: number;
  inflow: number;
  txns?: MonthTx[];
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtMoneyExact(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MonthlyTrendChart({ data }: { data: MonthPoint[] }) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "out" | "in">("all");

  if (data.length === 0) {
    return (
      <div style={card}>
        <h2 className="serif" style={{ fontSize: 20, marginBottom: 10 }}>Monthly trend</h2>
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", textAlign: "center", padding: "40px 0" }}>
          Not enough data yet
        </p>
      </div>
    );
  }

  const w = 800;
  const h = 200;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const maxVal = Math.max(...data.flatMap((d) => [d.outflow, d.inflow]), 1);
  const xFor = (i: number) => padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yFor = (v: number) => padT + innerH - (v / maxVal) * innerH;

  const outflowPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(d.outflow).toFixed(1)}`).join(" ");
  const inflowPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(d.inflow).toFixed(1)}`).join(" ");
  const outflowArea = `${outflowPath} L${xFor(data.length - 1).toFixed(1)},${h - padB} L${padL},${h - padB} Z`;
  const yTicks = Array.from({ length: 4 }, (_, i) => (maxVal * (3 - i)) / 3);

  const selectedData = data.find((d) => d.key === selectedMonth);
  const selectedTxns = (selectedData?.txns ?? []).filter((t) =>
    filter === "all" ? true : filter === "in" ? t.isIncome : !t.isIncome
  );

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 className="serif" style={{ fontSize: 20 }}>Monthly trend</h2>
        <div style={{ display: "flex", gap: 14, fontSize: 11 }}>
          <span style={{ color: "var(--color-ink-3)", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, background: "var(--color-red)", borderRadius: 2, display: "inline-block" }} />
            Outflow
          </span>
          <span style={{ color: "var(--color-ink-3)", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, background: "var(--color-green)", borderRadius: 2, display: "inline-block" }} />
            Inflow
          </span>
          <span style={{ color: "var(--color-ink-4)", fontStyle: "italic" }}>click month to drill in</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block", cursor: "pointer" }}
        onClick={(e) => {
          // Find closest data point to click X
          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
          const clickX = ((e.clientX - rect.left) / rect.width) * w;
          let closest = 0;
          let minDist = Infinity;
          data.forEach((_, i) => {
            const dist = Math.abs(xFor(i) - clickX);
            if (dist < minDist) { minDist = dist; closest = i; }
          });
          const key = data[closest].key;
          setSelectedMonth((prev) => prev === key ? null : key);
        }}
      >
        {yTicks.map((tick, i) => {
          const y = padT + (innerH * i) / 3;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--color-rule-soft)" strokeWidth="1" />
              <text x={padL - 8} y={y + 3} fontSize="10" fill="#8C857C" textAnchor="end" fontFamily="JetBrains Mono, monospace">
                {fmtMoney(tick)}
              </text>
            </g>
          );
        })}

        <path d={outflowArea} fill="var(--color-red)" fillOpacity="0.1" />
        <path d={outflowPath} fill="none" stroke="var(--color-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={inflowPath} fill="none" stroke="var(--color-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {data.map((d, i) => {
          const isSelected = d.key === selectedMonth;
          return (
            <g key={d.key}>
              {isSelected && (
                <line x1={xFor(i)} y1={padT} x2={xFor(i)} y2={h - padB} stroke="var(--color-bronze)" strokeWidth="1" strokeDasharray="4 3" />
              )}
              <circle cx={xFor(i)} cy={yFor(d.outflow)} r={isSelected ? 5 : 3.5}
                fill={isSelected ? "var(--color-red)" : "#FBF8F1"} stroke="var(--color-red)" strokeWidth="1.5" />
              <circle cx={xFor(i)} cy={yFor(d.inflow)} r={isSelected ? 5 : 3.5}
                fill={isSelected ? "var(--color-green)" : "#FBF8F1"} stroke="var(--color-green)" strokeWidth="1.5" />
              <text x={xFor(i)} y={h - padB + 16} fontSize="10"
                fill={isSelected ? "var(--color-ink)" : "#8C857C"}
                fontWeight={isSelected ? "700" : "400"}
                textAnchor="middle" fontFamily="Geist, system-ui">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Selected month transaction list */}
      {selectedData && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--color-rule)", paddingTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <span className="serif" style={{ fontSize: 16, color: "var(--color-ink)" }}>{selectedData.label}</span>
              <span style={{ fontSize: 11, color: "var(--color-ink-3)", marginLeft: 10 }}>
                {fmtMoney(selectedData.outflow)} out · {fmtMoney(selectedData.inflow)} in
              </span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["all","out","in"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: "4px 10px", borderRadius: 12, fontSize: 11, fontFamily: "inherit", cursor: "pointer",
                  border: `1px solid ${filter === f ? "var(--color-bronze)" : "var(--color-rule)"}`,
                  background: filter === f ? "var(--color-bronze)" : "transparent",
                  color: filter === f ? "#fff" : "var(--color-ink-3)", fontWeight: 600,
                }}>
                  {f === "all" ? "All" : f === "out" ? "Out" : "In"}
                </button>
              ))}
              <button onClick={() => setSelectedMonth(null)} style={{
                padding: "4px 10px", borderRadius: 12, fontSize: 11, fontFamily: "inherit", cursor: "pointer",
                border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-4)",
              }}>✕</button>
            </div>
          </div>

          {selectedTxns.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--color-ink-4)", textAlign: "center", padding: "16px 0" }}>No transactions match this filter</p>
          ) : (
            <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {selectedTxns.map((tx) => (
                <div key={tx.id} style={{ display: "grid", gridTemplateColumns: "70px 1fr auto", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--color-rule-soft)", alignItems: "center" }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--color-ink-4)" }}>{fmtDate(tx.date)}</div>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--color-ink)", fontWeight: 500 }}>{tx.merchant}</div>
                    <div style={{ fontSize: 10, color: "var(--color-ink-4)" }}>{tx.category}</div>
                  </div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: tx.isIncome ? "var(--color-green)" : "var(--color-ink)", textAlign: "right" }}>
                    {tx.isIncome ? "+" : "−"}{fmtMoneyExact(Math.abs(tx.amount))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-paper-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: 12,
  padding: "20px 24px",
  boxShadow: "var(--shadow-card)",
};
