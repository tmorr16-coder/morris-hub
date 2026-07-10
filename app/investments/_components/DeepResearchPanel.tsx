"use client";

import { useState, useEffect, useCallback } from "react";
import type { Stock } from "@/lib/stock-research";
import { addToThesis } from "../actions";
import FullReportPanel from "./FullReportPanel";
import { Group, Cell, RadialGauge } from "@/components/ios";

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

const REC_COLOR: Record<DeepResearch["recommendation"], string> = {
  BUY: "var(--ios-green)",
  HOLD: "var(--ios-orange)",
  SELL: "var(--ios-red)",
};

function Dot({ color }: { color: string }) {
  return <span style={{ display: "block", width: 8, height: 8, borderRadius: "50%", background: color }} />;
}

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

  const recColor = research ? REC_COLOR[research.recommendation] : "var(--ios-tint)";
  const target = research?.priceTarget12m ?? 0;
  const changeVsLast =
    research && target && stock.price
      ? (((target - stock.price) / stock.price) * 100).toFixed(1)
      : null;
  const changeNum = changeVsLast != null ? parseFloat(changeVsLast) : 0;

  return (
    <div>
      {/* Run / re-run */}
      <div style={{ padding: "4px 16px 0" }}>
        <button
          className="ios-btn ios-btn--primary"
          onClick={fetchResearch}
          disabled={loading}
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Researching…" : research ? "Re-run deep research" : "Run deep research"}
        </button>
      </div>

      {loading && (
        <div
          className="ios-subhead"
          style={{ padding: "40px 16px", textAlign: "center", color: "var(--ios-label-2)" }}
        >
          Researching {stock.ticker} across earnings, news &amp; analyst data…
        </div>
      )}

      {error && !loading && (
        <div className="ios-group" style={{ marginTop: 16 }}>
          <div
            className="ios-list ios-subhead"
            style={{ padding: 16, color: "var(--ios-red)" }}
          >
            {error}
          </div>
        </div>
      )}

      {research && !loading && (
        <>
          {/* Recommendation hero */}
          <Group
            header="Recommendation"
            footer={`Synthesized from ${research.evidenceBase} sources · filings, transcripts & news · Not investment advice`}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 16 }}>
              <RadialGauge
                value={research.conviction / 100}
                color={recColor}
                size={76}
                label="Conviction"
                center={
                  <span className="ios-num" style={{ fontSize: 18, fontWeight: 700, color: "var(--ios-label)" }}>
                    {research.conviction}%
                  </span>
                }
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  className="ios-chip ios-chip--sm"
                  style={{
                    background: `color-mix(in srgb, ${recColor} 16%, transparent)`,
                    color: recColor,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                  }}
                >
                  {research.recommendation}
                </span>
                <div
                  className="ios-footnote"
                  style={{ color: "var(--ios-label-2)", marginTop: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}
                >
                  12-mo price target
                </div>
                <div className="ios-num" style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em" }}>
                  {target ? `$${target.toFixed(0)}` : "—"}
                  {changeVsLast && (
                    <span
                      className="ios-num"
                      style={{ fontSize: 14, fontWeight: 600, marginLeft: 8, color: changeNum >= 0 ? "var(--ios-green)" : "var(--ios-red)" }}
                    >
                      {changeNum >= 0 ? "+" : ""}{changeVsLast}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Group>

          {/* Summary */}
          <Group header="Summary">
            <div className="ios-subhead" style={{ padding: 16, lineHeight: 1.6, color: "var(--ios-label)" }}>
              {research.summary}
            </div>
          </Group>

          {/* Bull case */}
          {research.bullCase.length > 0 && (
            <Group header="Bull case">
              {research.bullCase.map((point, i) => (
                <Cell key={i} chevron={false} lead={<Dot color="var(--ios-green)" />} title={<span className="ios-subhead">{point}</span>} />
              ))}
            </Group>
          )}

          {/* Bear case */}
          {research.bearCase.length > 0 && (
            <Group header="Bear case">
              {research.bearCase.map((point, i) => (
                <Cell key={i} chevron={false} lead={<Dot color="var(--ios-red)" />} title={<span className="ios-subhead">{point}</span>} />
              ))}
            </Group>
          )}

          {/* Catalysts */}
          {research.catalysts.length > 0 && (
            <Group header="Catalysts to watch">
              {research.catalysts.map((c, i) => (
                <Cell key={i} chevron={false} lead={<Dot color="var(--ios-tint)" />} title={<span className="ios-subhead">{c}</span>} />
              ))}
            </Group>
          )}

          {/* Risks */}
          {research.risks.length > 0 && (
            <Group header="Key risks">
              {research.risks.map((r, i) => (
                <Cell key={i} chevron={false} lead={<Dot color="var(--ios-orange)" />} title={<span className="ios-subhead">{r}</span>} />
              ))}
            </Group>
          )}

          {/* Actions */}
          <div style={{ padding: "22px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              className="ios-btn ios-btn--primary"
              onClick={handleAddToThesis}
              disabled={thesisState === "saving" || thesisState === "saved"}
              style={{
                background:
                  thesisState === "saved" ? "var(--ios-green)" : thesisState === "error" ? "var(--ios-red)" : undefined,
                opacity: thesisState === "saving" ? 0.7 : 1,
              }}
            >
              {thesisState === "saving"
                ? "Saving…"
                : thesisState === "saved"
                ? "Saved to Ideas"
                : thesisState === "error"
                ? "Failed — try again"
                : "Add to thesis"}
            </button>
            <button
              className="ios-btn ios-btn--plain"
              onClick={() => setShowFullReport(true)}
              style={{ alignSelf: "center" }}
            >
              View full report
            </button>
          </div>
        </>
      )}

      {/* Full report bottom sheet */}
      {showFullReport && (
        <FullReportPanel stock={stock} onClose={() => setShowFullReport(false)} />
      )}
    </div>
  );
}
