"use client";

import { useState } from "react";
import { Segmented } from "@/components/ios";

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
      <div className="ios-list" style={{ margin: 0, padding: "18px 16px" }}>
        <h2 className="ios-title-3">Monthly trend</h2>
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", textAlign: "center", padding: "40px 0" }}>
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
    <div className="ios-list" style={{ margin: 0, padding: "18px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <h2 className="ios-title-3">Monthly trend</h2>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, background: "var(--ios-red)", borderRadius: 3, display: "inline-block" }} />
            Outflow
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, background: "var(--ios-green)", borderRadius: 3, display: "inline-block" }} />
            Inflow
          </span>
          <span style={{ color: "var(--ios-label-3)" }}>tap a month</span>
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
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--ios-separator)" strokeWidth="1" />
              <text x={padL - 8} y={y + 3} fontSize="11" fill="var(--ios-label-2)" textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmtMoney(tick)}
              </text>
            </g>
          );
        })}

        <path d={outflowArea} fill="var(--ios-red)" fillOpacity="0.1" />
        <path d={outflowPath} fill="none" stroke="var(--ios-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={inflowPath} fill="none" stroke="var(--ios-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {data.map((d, i) => {
          const isSelected = d.key === selectedMonth;
          return (
            <g key={d.key}>
              {isSelected && (
                <line x1={xFor(i)} y1={padT} x2={xFor(i)} y2={h - padB} stroke="var(--ios-finance)" strokeWidth="1" strokeDasharray="4 3" />
              )}
              <circle cx={xFor(i)} cy={yFor(d.outflow)} r={isSelected ? 5 : 3.5}
                fill={isSelected ? "var(--ios-red)" : "var(--ios-cell)"} stroke="var(--ios-red)" strokeWidth="1.5" />
              <circle cx={xFor(i)} cy={yFor(d.inflow)} r={isSelected ? 5 : 3.5}
                fill={isSelected ? "var(--ios-green)" : "var(--ios-cell)"} stroke="var(--ios-green)" strokeWidth="1.5" />
              <text x={xFor(i)} y={h - padB + 16} fontSize="11"
                fill={isSelected ? "var(--ios-label)" : "var(--ios-label-2)"}
                fontWeight={isSelected ? "600" : "400"}
                textAnchor="middle">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Selected month transaction list */}
      {selectedData && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--ios-separator)", paddingTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span className="ios-headline">{selectedData.label}</span>
              <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
                <span className="ios-num">{fmtMoney(selectedData.outflow)}</span> out · <span className="ios-num">{fmtMoney(selectedData.inflow)}</span> in
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Segmented
                options={[{ value: "all", label: "All" }, { value: "out", label: "Out" }, { value: "in", label: "In" }]}
                value={filter}
                onChange={setFilter}
                ariaLabel="Filter transactions"
              />
              <button type="button" className="ios-btn ios-btn--plain" onClick={() => setSelectedMonth(null)}>Close</button>
            </div>
          </div>

          {selectedTxns.length === 0 ? (
            <p className="ios-footnote" style={{ color: "var(--ios-label-2)", textAlign: "center", padding: "16px 0" }}>No transactions match this filter</p>
          ) : (
            <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {selectedTxns.map((tx) => (
                <div key={tx.id} style={{ display: "grid", gridTemplateColumns: "70px 1fr auto", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--ios-separator)", alignItems: "center" }}>
                  <div className="ios-num ios-footnote" style={{ color: "var(--ios-label-2)" }}>{fmtDate(tx.date)}</div>
                  <div>
                    <div className="ios-subhead" style={{ fontWeight: 500 }}>{tx.merchant}</div>
                    <div className="ios-caption" style={{ color: "var(--ios-label-2)" }}>{tx.category}</div>
                  </div>
                  <div className="ios-num ios-subhead" style={{ fontWeight: 600, color: tx.isIncome ? "var(--ios-green)" : "var(--ios-label)", textAlign: "right" }}>
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
