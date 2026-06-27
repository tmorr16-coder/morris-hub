"use client";

import { useState, useEffect, useCallback } from "react";
import type { Stock } from "@/lib/stock-research";
import { addToThesis } from "../actions";
import FullReportPanel from "./FullReportPanel";

interface DeepResearch {
  recommendation: "BUY" | "HOLD" | "SELL";
  conviction: number;
  priceTarget12m: number;
  summary: string;
  bullCase: string[];
  bearCase: string[];
  catalysts: string[];
  risks: string[];
  evidenceBase: number;
}

interface DeepResearchPanelProps {
  stock: Stock;
}

function ConvictionGauge({ value }: { value: number }) {
  const radius = 28;
  const stroke = 5;
  const circumference = 2 * Math.PI * radius;
  const arc = (value / 100) * circumference;

  return (
    <svg width={70} height={70} viewBox="0 0 70 70">
      <circle
        cx={35}
        cy={35}
        r={radius}
        fill="none"
        stroke="var(--color-rule)"
        strokeWidth={stroke}
      />
      <circle
        cx={35}
        cy={35}
        r={radius}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={stroke}
        strokeDasharray={`${arc} ${circumference - arc}`}
        strokeDashoffset={circumference / 4}
        strokeLinecap="round"
        transform="rotate(-90 35 35)"
        style={{ transform: "rotate(-90deg)", transformOrigin: "35px 35px" }}
      />
      <text x={35} y={32} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--color-ink)">
        {value}%
      </text>
      <text x={35} y={44} textAnchor="middle" fontSize={8} fill="var(--color-ink-3)" letterSpacing="0.08em">
        CONV
      </text>
    </svg>
  );
}

const REC_COLORS = {
  BUY: { bg: "rgba(74,107,58,0.12)", color: "var(--color-green)", border: "rgba(74,107,58,0.3)" },
  HOLD: { bg: "rgba(184,138,46,0.12)", color: "var(--color-amber)", border: "rgba(184,138,46,0.3)" },
  SELL: { bg: "rgba(154,59,42,0.12)", color: "var(--color-red)", border: "rgba(154,59,42,0.3)" },
};

export default function DeepResearchPanel({ stock }: DeepResearchPanelProps) {
  const [research, setResearch] = useState<DeepResearch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);
  // Reset slide-over when stock changes
  useEffect(() => { setShowFullReport(false); }, [stock.ticker]);
  const [thesisState, setThesisState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleAddToThesis = useCallback(async () => {
    if (!research) return;
    setThesisState("saving");
    const result = await addToThesis(
      stock.ticker,
      stock.name,
      research.recommendation,
      research.summary,
      research.bullCase,
      research.bearCase,
      research.priceTarget12m
    );
    setThesisState(result.error ? "error" : "saved");
    if (!result.error) setTimeout(() => setThesisState("idle"), 3000);
  }, [research, stock]);

  const fetchResearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/investments/deep-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: stock.ticker,
          name: stock.name,
          price: stock.price,
          sector: stock.sector,
        }),
      });
      if (!res.ok) throw new Error("Research failed");
      const data = await res.json();
      setResearch(data);
    } catch {
      setError("Could not generate analysis. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResearch();
  }, [stock.ticker]);

  const recStyle = research ? REC_COLORS[research.recommendation] : null;
  const target = research?.priceTarget12m ?? 0;
  const changeVsLast =
    research && target && stock.price
      ? (((target - stock.price) / stock.price) * 100).toFixed(1)
      : null;

  return (
    <div
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-rule)",
        borderRadius: 12,
        padding: "20px 24px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-accent)",
              marginBottom: 2,
            }}
          >
            ◆ Deep Research
          </div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              margin: 0,
              color: "var(--color-ink)",
            }}
          >
            Analyst Recommendation
          </h3>
        </div>
        <button
          onClick={fetchResearch}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid var(--color-rule)",
            background: "transparent",
            color: "var(--color-ink-3)",
            fontSize: 12,
            fontFamily: "inherit",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          ↻ Re-run
        </button>
      </div>

      {loading && (
        <div
          style={{
            padding: "40px 0",
            textAlign: "center",
            fontSize: 13,
            color: "var(--color-ink-3)",
          }}
        >
          Researching {stock.ticker} across earnings, news & analyst data…
        </div>
      )}

      {error && !loading && (
        <div
          style={{
            padding: "16px",
            background: "rgba(154,59,42,0.06)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--color-red)",
          }}
        >
          {error}
        </div>
      )}

      {research && !loading && (
        <>
          {/* Summary row: gauge + recommendation + targets */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto auto 1fr 1fr",
              gap: 24,
              alignItems: "center",
              paddingBottom: 16,
              borderBottom: "1px solid var(--color-rule)",
              marginBottom: 16,
            }}
          >
            <ConvictionGauge value={research.conviction} />

            <div
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: recStyle?.bg,
                border: `1px solid ${recStyle?.border}`,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: recStyle?.color,
                  letterSpacing: "-0.02em",
                }}
              >
                {research.recommendation}
              </div>
              <div style={{ fontSize: 9, color: "var(--color-ink-4)", marginTop: 2 }}>
                12-month view
              </div>
            </div>

            <div>
              <div style={{ fontSize: 9, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                12-Mo Price Target
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-ink)" }}>
                {target ? `$${target.toFixed(0)}` : "—"}
              </div>
              {changeVsLast && (
                <div style={{ fontSize: 11, color: parseFloat(changeVsLast) >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                  {parseFloat(changeVsLast) >= 0 ? "+" : ""}{changeVsLast}% vs last
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 9, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                Evidence Base
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-ink)" }}>
                {research.evidenceBase}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-ink-4)" }}>
                filings · transcripts · news
              </div>
            </div>
          </div>

          {/* Summary */}
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.65,
              color: "var(--color-ink-2)",
              margin: "0 0 16px 0",
            }}
          >
            {research.summary}
          </p>

          {/* Bull / Bear */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                background: "rgba(74,107,58,0.05)",
                border: "1px solid rgba(74,107,58,0.2)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--color-green)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 8,
                }}
              >
                ● Bull Case
              </div>
              {research.bullCase.map((point, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    color: "var(--color-ink-2)",
                    lineHeight: 1.5,
                    marginBottom: 4,
                    paddingLeft: 10,
                    borderLeft: "2px solid rgba(74,107,58,0.3)",
                  }}
                >
                  {point}
                </div>
              ))}
            </div>

            <div
              style={{
                background: "rgba(154,59,42,0.05)",
                border: "1px solid rgba(154,59,42,0.2)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--color-red)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 8,
                }}
              >
                ● Bear Case
              </div>
              {research.bearCase.map((point, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    color: "var(--color-ink-2)",
                    lineHeight: 1.5,
                    marginBottom: 4,
                    paddingLeft: 10,
                    borderLeft: "2px solid rgba(154,59,42,0.3)",
                  }}
                >
                  {point}
                </div>
              ))}
            </div>
          </div>

          {/* Catalysts + Risks */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--color-ink-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 8,
                }}
              >
                Catalysts to Watch
              </div>
              {research.catalysts.map((c, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    color: "var(--color-ink-2)",
                    marginBottom: 4,
                    display: "flex",
                    gap: 6,
                  }}
                >
                  <span style={{ color: "var(--color-accent)", flexShrink: 0 }}>›</span>
                  {c}
                </div>
              ))}
            </div>

            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--color-ink-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 8,
                }}
              >
                Key Risks
              </div>
              {research.risks.map((r, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    color: "var(--color-ink-2)",
                    marginBottom: 4,
                    display: "flex",
                    gap: 6,
                  }}
                >
                  <span style={{ color: "var(--color-red)", flexShrink: 0 }}>!</span>
                  {r}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px solid var(--color-rule)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
              Synthesized from {research.evidenceBase} sources · Not investment advice
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowFullReport(true)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--color-rule)",
                  background: "transparent",
                  color: "var(--color-ink-2)",
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Full report
              </button>
              <button
                onClick={handleAddToThesis}
                disabled={thesisState === "saving" || thesisState === "saved"}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: thesisState === "saved" ? "var(--color-green)" : thesisState === "error" ? "var(--color-red)" : "var(--color-accent)",
                  color: "#FFFDF8",
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: "inherit",
                  cursor: thesisState === "saving" ? "wait" : "pointer",
                  opacity: thesisState === "saving" ? 0.7 : 1,
                }}
              >
                {thesisState === "saving" ? "Saving…" : thesisState === "saved" ? "✓ Saved to Ideas" : thesisState === "error" ? "Failed" : "Add to thesis"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Full Report Slide-over */}
      {showFullReport && (
        <FullReportPanel stock={stock} onClose={() => setShowFullReport(false)} />
      )}
    </div>
  );
}
