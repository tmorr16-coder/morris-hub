"use client";

import { useRef, useState } from "react";
import type { TaxSnapshot, TaxOpportunity } from "../_lib/snapshot";

function pct(n: number): string { return `${(n * 100).toFixed(1)}%`; }
function money(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const IMPACT: Record<TaxOpportunity["impact"], { label: string; color: string }> = {
  high: { label: "High impact", color: "var(--ios-green)" },
  medium: { label: "Medium", color: "var(--ios-orange)" },
  low: { label: "Low", color: "var(--ios-label-2)" },
};

const MIX_COLORS: Record<string, string> = {
  pretax: "#C97A3A", roth: "var(--ios-green)", taxable: "var(--ios-tint)", hsa: "#5E5CE6",
};
const MIX_LABELS: Record<string, string> = { pretax: "Pre-tax", roth: "Roth", taxable: "Taxable", hsa: "HSA" };

interface Msg { role: "user" | "assistant"; content: string; }

export default function TaxClient({ snapshot }: { snapshot: TaxSnapshot }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setErr(null);
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/finance/tax/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, snapshot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    }
  }

  const mixEntries = (["pretax", "roth", "taxable", "hsa"] as const).filter((k) => snapshot.mix[k] > 0.001);

  const SUGGESTIONS = [
    "How much could I convert to Roth this year?",
    "What's the most tax-efficient way to give?",
    "How do I lower my effective rate?",
  ];

  return (
    <div>
      {/* Hero — effective / marginal rate */}
      <div className="ios-list" style={{ margin: "0 0 8px", padding: 18 }}>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Estimated income tax · this year
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
          <div className="ios-num" style={{ fontSize: 34, fontWeight: 700 }}>{money(snapshot.estimatedTax)}</div>
          <div className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>on {money(snapshot.grossIncome)} income</div>
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
          <Stat label="Effective rate" value={pct(snapshot.effectiveRate)} />
          <Stat label="Marginal rate" value={pct(snapshot.marginalRate)} />
          <Stat label="Filing" value={snapshot.filing === "Married filing jointly" ? "MFJ" : "Single"} />
        </div>
      </div>

      {/* Tax-location mix */}
      <div className="ios-list" style={{ margin: "0 0 8px", padding: 18 }}>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
          Tax diversification
        </div>
        <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "var(--ios-fill)" }}>
          {mixEntries.map((k) => (
            <div key={k} style={{ width: `${snapshot.mix[k] * 100}%`, background: MIX_COLORS[k] }} title={`${MIX_LABELS[k]} ${Math.round(snapshot.mix[k] * 100)}%`} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
          {mixEntries.map((k) => (
            <span key={k} className="ios-footnote" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ios-label-2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: MIX_COLORS[k] }} />
              {MIX_LABELS[k]} {Math.round(snapshot.mix[k] * 100)}%
            </span>
          ))}
        </div>
        {(snapshot.surtaxes.length > 0 || snapshot.concentrationNote) && (
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 12, lineHeight: 1.5, paddingTop: 10, borderTop: "1px solid var(--ios-separator)" }}>
            {snapshot.concentrationNote && <div style={{ marginBottom: 6 }}>⚠︎ {snapshot.concentrationNote}</div>}
            {snapshot.surtaxes.map((s, i) => <div key={i}>• {s}</div>)}
          </div>
        )}
      </div>

      {/* Opportunities */}
      {snapshot.opportunities.length > 0 && (
        <>
          <div className="ios-group-header" style={{ padding: "12px 0 7px" }}>OPPORTUNITIES</div>
          <div className="ios-list" style={{ margin: 0 }}>
            {snapshot.opportunities.map((o) => (
              <div key={o.key} className="ios-cell" style={{ display: "block", padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span className="ios-headline">{o.title}</span>
                  <span className="ios-caption" style={{ color: IMPACT[o.impact].color, fontWeight: 600 }}>{IMPACT[o.impact].label}</span>
                </div>
                <div className="ios-subhead" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>{o.detail}</div>
                <button
                  onClick={() => send(`Tell me more about: ${o.title}. How would it work for me and what should I watch out for?`)}
                  style={{ marginTop: 8, padding: 0, color: "var(--ios-tint)", fontSize: 14, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}
                >
                  Ask the advisor →
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* AI Tax Advisor */}
      <div className="ios-group-header" style={{ padding: "16px 0 7px" }}>TAX ADVISOR</div>
      <div className="ios-list" style={{ margin: 0, padding: 16 }}>
        <div ref={scrollRef} style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.length === 0 && (
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
              Ask about Roth conversions, charitable giving, brackets, surtaxes, or anything tax. Your snapshot is included with every question.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
              <div style={{
                padding: "10px 14px", borderRadius: 16, lineHeight: 1.5,
                background: m.role === "user" ? "var(--ios-tint)" : "var(--ios-fill)",
                color: m.role === "user" ? "var(--ios-on-tint)" : "var(--ios-label)",
                whiteSpace: "pre-wrap",
              }} className="ios-subhead">{m.content}</div>
            </div>
          ))}
          {busy && <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>Thinking…</div>}
          {err && <div className="ios-footnote" style={{ color: "var(--ios-red)" }}>{err}</div>}
        </div>

        {messages.length === 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} style={{ padding: "7px 12px", borderRadius: 999, background: "var(--ios-fill)", color: "var(--ios-label)", fontSize: 13, border: "none", cursor: "pointer" }}>{s}</button>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a tax question…"
            style={{ flex: 1, padding: "10px 14px", borderRadius: 999, border: "1px solid var(--ios-separator)", background: "var(--ios-bg)", color: "var(--ios-label)", fontSize: 15, outline: "none" }}
          />
          <button type="submit" disabled={busy || !input.trim()} style={{ padding: "10px 18px", borderRadius: 999, background: "var(--ios-tint)", color: "var(--ios-on-tint)", fontWeight: 600, border: "none", cursor: busy ? "wait" : "pointer", opacity: busy || !input.trim() ? 0.6 : 1 }}>Ask</button>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 2 }}>{label}</div>
      <div className="ios-num" style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
