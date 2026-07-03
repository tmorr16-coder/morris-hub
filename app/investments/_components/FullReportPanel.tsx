"use client";

import { useState, useEffect, useRef } from "react";
import type { Stock } from "@/lib/stock-research";
import type { FullReport, ReportRisk } from "@/app/api/investments/full-report/route";
import { Cell, Chip, Icons } from "@/components/ios";
import type { SVGProps } from "react";

interface FullReportPanelProps {
  stock: Stock;
  onClose: () => void;
}

const SEVERITY_STYLES: Record<ReportRisk["severity"], { color: string; label: string }> = {
  high: { color: "var(--ios-red)", label: "High" },
  medium: { color: "var(--ios-orange)", label: "Medium" },
  low: { color: "var(--ios-green)", label: "Low" },
};

function LinkGlyph(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" aria-hidden {...p}>
      <path d="M10 13a5 5 0 0 0 7.5.5l2-2A5 5 0 0 0 12.5 4.5l-1 1" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2A5 5 0 0 0 11.5 19.5l1-1" />
    </svg>
  );
}

const SOURCE_TYPE_ICONS: Record<string, (p: SVGProps<SVGSVGElement>) => React.ReactElement> = {
  earnings: Icons.ChartIcon,
  news: Icons.NewsIcon,
  analyst: Icons.SparkleIcon,
  filing: Icons.BookIcon,
  other: LinkGlyph,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h3 className="ios-group-header">{title}</h3>
      <div className="ios-list">{children}</div>
    </section>
  );
}

function TextBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="ios-subhead" style={{ padding: 16, lineHeight: 1.6, color: "var(--ios-label)", whiteSpace: "pre-wrap" }}>
      {children}
    </div>
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
    <>
      {/* Backdrop */}
      <div
        className="ios-sheet-backdrop"
        onClick={handleClose}
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.24s" }}
      />

      {/* Bottom sheet */}
      <div
        ref={panelRef}
        className="ios-sheet"
        style={{ transform: visible ? "translateY(0)" : "translateY(100%)", transition: "transform 0.24s cubic-bezier(0.32,0.72,0,1)" }}
      >
        <div className="ios-grabber" />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "0 4px 4px" }}>
          <div>
            <div className="ios-footnote" style={{ color: "var(--ios-tint)", fontWeight: 600 }}>
              Full research report
            </div>
            <div className="ios-title-3" style={{ marginTop: 2 }}>
              {stock.ticker}
              <span style={{ fontWeight: 400, fontSize: 15, color: "var(--ios-label-2)", marginLeft: 8 }}>
                {stock.name}
              </span>
            </div>
          </div>
          <button className="ios-btn--plain" onClick={handleClose} style={{ color: "var(--ios-tint)", fontSize: 17 }}>
            Done
          </button>
        </div>

        {loading && (
          <div style={{ padding: "56px 16px", textAlign: "center", color: "var(--ios-label-2)" }}>
            <Icons.SparkleIcon style={{ width: 26, height: 26, color: "var(--ios-tint)" }} />
            <div className="ios-subhead" style={{ marginTop: 10 }}>
              Researching {stock.ticker} — searching filings, news, analyst reports…
            </div>
            <div className="ios-footnote" style={{ marginTop: 6, color: "var(--ios-label-3)" }}>
              This takes 15–30 seconds on first load
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="ios-subhead" style={{ padding: "24px 16px", color: "var(--ios-red)" }}>
            {error}
          </div>
        )}

        {report && !loading && (
          <>
            {generatedAt && (
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "8px 4px 0" }}>
                Generated {generatedAt} · Not investment advice
              </div>
            )}

            {/* Thesis */}
            <Section title="Investment thesis">
              <TextBlock>{report.thesis}</TextBlock>
            </Section>

            {/* Business overview */}
            <Section title="Business overview">
              <TextBlock>{report.businessOverview}</TextBlock>
            </Section>

            {/* Valuation */}
            {report.valuation && (
              <Section title="Valuation">
                {report.valuation.currentMultiple && (
                  <Cell chevron={false} title="Current multiple" trailing={<span className="ios-num">{report.valuation.currentMultiple}</span>} />
                )}
                {report.valuation.historicalRange && (
                  <Cell chevron={false} title="5-yr range" trailing={<span className="ios-num">{report.valuation.historicalRange}</span>} />
                )}
                {report.valuation.narrative && <TextBlock>{report.valuation.narrative}</TextBlock>}
                {[
                  { label: "Bull", value: report.valuation.scenarioBull, color: "var(--ios-green)" },
                  { label: "Base", value: report.valuation.scenarioBase, color: "var(--ios-tint)" },
                  { label: "Bear", value: report.valuation.scenarioBear, color: "var(--ios-red)" },
                ]
                  .filter((s) => s.value)
                  .map((s) => (
                    <Cell
                      key={s.label}
                      chevron={false}
                      lead={<span className="ios-footnote" style={{ fontWeight: 700, color: s.color, minWidth: 34 }}>{s.label}</span>}
                      title={<span className="ios-subhead">{s.value}</span>}
                    />
                  ))}
              </Section>
            )}

            {/* Comp table */}
            {report.compTable?.length > 0 && (
              <Section title="Comparable companies">
                {report.compTable.map((comp, i) => (
                  <Cell
                    key={i}
                    chevron={false}
                    title={comp.name}
                    subtitle={
                      <>
                        <span className="ios-num" style={{ color: "var(--ios-tint)", fontWeight: 600 }}>{comp.ticker}</span>
                        {comp.note ? ` · ${comp.note}` : ""}
                      </>
                    }
                    trailing={<span className="ios-num" style={{ color: "var(--ios-label)" }}>{comp.metric}</span>}
                  />
                ))}
              </Section>
            )}

            {/* Catalysts */}
            {report.catalysts?.length > 0 && (
              <Section title="Catalysts">
                {report.catalysts.map((c, i) => (
                  <Cell
                    key={i}
                    chevron={false}
                    lead={<span style={{ display: "block", width: 8, height: 8, borderRadius: "50%", background: "var(--ios-tint)" }} />}
                    title={c.catalyst}
                    subtitle={<span className="ios-footnote">{c.impact}</span>}
                    trailing={<Chip small>{c.timeline}</Chip>}
                  />
                ))}
              </Section>
            )}

            {/* Risks */}
            {report.risks?.length > 0 && (
              <Section title="Key risks">
                {report.risks.map((r, i) => {
                  const style = SEVERITY_STYLES[r.severity] ?? SEVERITY_STYLES.medium;
                  return (
                    <Cell
                      key={i}
                      chevron={false}
                      lead={<span style={{ display: "block", width: 8, height: 8, borderRadius: "50%", background: style.color }} />}
                      title={r.risk}
                      subtitle={<span className="ios-footnote">{r.detail}</span>}
                      trailing={
                        <span
                          className="ios-chip ios-chip--sm"
                          style={{ background: `color-mix(in srgb, ${style.color} 16%, transparent)`, color: style.color, fontWeight: 600 }}
                        >
                          {style.label}
                        </span>
                      }
                    />
                  );
                })}
              </Section>
            )}

            {/* Sources */}
            {report.sources?.length > 0 && (
              <Section title={`Sources (${report.sources.length})`}>
                {report.sources.map((s, i) => {
                  const Icon = SOURCE_TYPE_ICONS[s.type] ?? LinkGlyph;
                  return (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="ios-cell">
                      <span className="ios-cell-lead">
                        <Icon style={{ width: 20, height: 20, color: "var(--ios-label-2)" }} />
                      </span>
                      <span className="ios-cell-body">
                        <span className="ios-cell-title ios-truncate" style={{ color: "var(--ios-tint)", fontSize: 15 }}>
                          {s.title || s.url}
                        </span>
                      </span>
                      <span className="ios-cell-trail">
                        <LinkGlyph style={{ width: 16, height: 16, color: "var(--ios-label-3)" }} />
                      </span>
                    </a>
                  );
                })}
              </Section>
            )}

            <div style={{ height: 8 }} />
          </>
        )}
      </div>
    </>
  );
}
