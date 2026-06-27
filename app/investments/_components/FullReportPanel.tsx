"use client";

import { useState, useEffect, useRef } from "react";
import type { Stock } from "@/lib/stock-research";
import type { FullReport, ReportRisk } from "@/app/api/investments/full-report/route";

interface FullReportPanelProps {
  stock: Stock;
  onClose: () => void;
}

const SEVERITY_STYLES: Record<ReportRisk["severity"], { bg: string; color: string; label: string }> = {
  high: { bg: "rgba(154,59,42,0.1)", color: "var(--color-red)", label: "High" },
  medium: { bg: "rgba(184,138,46,0.1)", color: "var(--color-amber)", label: "Medium" },
  low: { bg: "rgba(74,107,58,0.1)", color: "var(--color-green)", label: "Low" },
};

const SOURCE_TYPE_ICONS: Record<string, string> = {
  earnings: "📊",
  news: "📰",
  analyst: "🔍",
  filing: "📄",
  other: "🔗",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h3
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--color-ink-3)",
          margin: "0 0 12px 0",
          paddingBottom: 8,
          borderBottom: "1px solid var(--color-rule)",
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function FullReportPanel({ stock, onClose }: FullReportPanelProps) {
  const [report, setReport] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Slide in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 240);
  };

  useEffect(() => {
    fetch("/api/investments/full-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: stock.ticker }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setReport(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [stock.ticker]);

  const generatedAt = report?.generatedAt
    ? new Date(report.generatedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        pointerEvents: "auto",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          flex: 1,
          background: "rgba(0,0,0,0.25)",
          transition: "opacity 0.24s",
          opacity: visible ? 1 : 0,
        }}
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        style={{
          width: 520,
          maxWidth: "90vw",
          height: "100%",
          background: "var(--color-bg-card)",
          borderLeft: "1px solid var(--color-rule)",
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.24s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.08)",
        }}
      >
        {/* Sticky header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--color-rule)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-bg-card)",
            flexShrink: 0,
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
              ◆ Full Research Report
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--color-ink)" }}>
              {stock.ticker}
              <span style={{ fontWeight: 400, fontSize: 13, color: "var(--color-ink-3)", marginLeft: 8 }}>
                {stock.name}
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: "var(--color-ink-3)",
              padding: "4px 8px",
              borderRadius: 6,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 40px" }}>
          {loading && (
            <div
              style={{
                padding: "60px 0",
                textAlign: "center",
                color: "var(--color-ink-3)",
                fontSize: 13,
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 12 }}>🔍</div>
              Researching {stock.ticker} — searching filings, news, analyst reports…
              <div style={{ fontSize: 11, marginTop: 8, color: "var(--color-ink-4)" }}>
                This takes 15–30 seconds on first load
              </div>
            </div>
          )}

          {error && !loading && (
            <div
              style={{
                padding: "20px",
                background: "rgba(154,59,42,0.06)",
                borderRadius: 8,
                color: "var(--color-red)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {report && !loading && (
            <>
              {/* Generated timestamp */}
              {generatedAt && (
                <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginBottom: 20 }}>
                  Generated {generatedAt} · Not investment advice
                </div>
              )}

              {/* Thesis */}
              <Section title="Investment Thesis">
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.75,
                    color: "var(--color-ink-2)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {report.thesis}
                </div>
              </Section>

              {/* Business overview */}
              <Section title="Business Overview">
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.75,
                    color: "var(--color-ink-2)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {report.businessOverview}
                </div>
              </Section>

              {/* Valuation */}
              {report.valuation && (
              <Section title="Valuation">
                <div style={{ marginBottom: 14 }}>
                  {(report.valuation.currentMultiple || report.valuation.historicalRange) && (
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    {[
                      { label: "Current", value: report.valuation.currentMultiple },
                      { label: "5-yr range", value: report.valuation.historicalRange },
                    ].filter(i => i.value).map((item) => (
                      <div
                        key={item.label}
                        style={{
                          flex: 1,
                          background: "var(--color-bg-deep)",
                          borderRadius: 8,
                          padding: "10px 14px",
                        }}
                      >
                        <div style={{ fontSize: 9, color: "var(--color-ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                  {report.valuation.narrative && (
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--color-ink-2)", marginBottom: 14, whiteSpace: "pre-wrap" }}>
                    {report.valuation.narrative}
                  </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { label: "Bull", value: report.valuation.scenarioBull, color: "var(--color-green)", bg: "rgba(74,107,58,0.06)" },
                      { label: "Base", value: report.valuation.scenarioBase, color: "var(--color-accent)", bg: "rgba(59,92,127,0.06)" },
                      { label: "Bear", value: report.valuation.scenarioBear, color: "var(--color-red)", bg: "rgba(154,59,42,0.06)" },
                    ].filter(s => s.value).map((s) => (
                      <div
                        key={s.label}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: s.bg,
                          fontSize: 12,
                        }}
                      >
                        <span style={{ fontWeight: 700, color: s.color, flexShrink: 0, minWidth: 28 }}>
                          {s.label}
                        </span>
                        <span style={{ color: "var(--color-ink-2)", lineHeight: 1.5 }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
              )}

              {/* Comp table */}
              {report.compTable?.length > 0 && (
                <Section title="Comparable Companies">
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {/* Header */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "100px 60px 80px 1fr",
                        gap: 8,
                        padding: "4px 8px",
                        fontSize: 9,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--color-ink-4)",
                      }}
                    >
                      <span>Company</span>
                      <span>Ticker</span>
                      <span>Multiple</span>
                      <span>vs {stock.ticker}</span>
                    </div>
                    {report.compTable.map((comp, i) => (
                      <div
                        key={i}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "100px 60px 80px 1fr",
                          gap: 8,
                          padding: "8px",
                          borderRadius: 6,
                          background: i % 2 === 0 ? "var(--color-bg-deep)" : "transparent",
                          fontSize: 12,
                          color: "var(--color-ink-2)",
                          alignItems: "start",
                        }}
                      >
                        <span style={{ fontWeight: 500, color: "var(--color-ink)" }}>{comp.name}</span>
                        <span style={{ fontWeight: 600, color: "var(--color-accent)", fontFamily: "monospace" }}>{comp.ticker}</span>
                        <span>{comp.metric}</span>
                        <span style={{ color: "var(--color-ink-3)" }}>{comp.note}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Catalysts */}
              {report.catalysts?.length > 0 && (
                <Section title="Catalysts">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {report.catalysts.map((c, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: "var(--color-bg-deep)",
                          borderLeft: "2px solid var(--color-accent)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink)" }}>{c.catalyst}</span>
                          <span style={{ fontSize: 10, color: "var(--color-ink-4)", background: "var(--color-bg-card)", padding: "2px 7px", borderRadius: 10, border: "1px solid var(--color-rule)" }}>
                            {c.timeline}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.5 }}>{c.impact}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Risks */}
              {report.risks?.length > 0 && (
                <Section title="Key Risks">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {report.risks.map((r, i) => {
                      const style = SEVERITY_STYLES[r.severity] ?? SEVERITY_STYLES.medium;
                      return (
                        <div
                          key={i}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            background: "var(--color-bg-deep)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 10,
                                background: style.bg,
                                color: style.color,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                              }}
                            >
                              {style.label}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink)" }}>{r.risk}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.5 }}>{r.detail}</div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Sources */}
              {report.sources?.length > 0 && (
                <Section title={`Sources (${report.sources.length})`}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {report.sources.map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 8,
                          padding: "7px 10px",
                          borderRadius: 6,
                          textDecoration: "none",
                          transition: "background 0.1s",
                          fontSize: 12,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-bg-deep)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <span style={{ flexShrink: 0, fontSize: 11 }}>
                          {SOURCE_TYPE_ICONS[s.type] ?? "🔗"}
                        </span>
                        <span
                          style={{
                            color: "var(--color-accent)",
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.title || s.url}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--color-ink-4)", flexShrink: 0 }}>
                          ↗
                        </span>
                      </a>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
