"use client";

import { useState } from "react";
import { COMPARE_MODELS, MORE_MODELS, type CompareModel } from "@/lib/openrouter";

interface Result { model: string; answer: string; error: string | null }

const ALL: CompareModel[] = [...COMPARE_MODELS, ...MORE_MODELS];
const META = (id: string) => ALL.find((m) => m.id === id) ?? { id, label: id, vendor: "Model", color: "var(--ios-label-2)" };

// ── tiny safe markdown → html ──────────────────────────────────────
function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function inline(s: string) {
  return esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--ios-tint)">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code style="background:rgba(120,120,128,0.16);padding:1px 5px;border-radius:5px;font-size:.9em">$1</code>');
}
function md(text: string) {
  const out: string[] = []; let list: "ul" | "ol" | null = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { close(); continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { close(); out.push(`<div style="font-weight:700;font-size:15px;margin:8px 0 4px">${inline(h[2])}</div>`); continue; }
    const ul = line.match(/^\s*[-*•]\s+(.*)$/); const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul) { if (list !== "ul") { close(); out.push('<ul style="margin:4px 0 8px;padding-left:20px">'); list = "ul"; } out.push(`<li style="margin:3px 0">${inline(ul[1])}</li>`); continue; }
    if (ol) { if (list !== "ol") { close(); out.push('<ol style="margin:4px 0 8px;padding-left:20px">'); list = "ol"; } out.push(`<li style="margin:3px 0">${inline(ol[1])}</li>`); continue; }
    close(); out.push(`<p style="margin:0 0 8px;line-height:1.55">${inline(line)}</p>`);
  }
  close(); return out.join("");
}

const SUGGESTIONS = [
  "Explain the tradeoffs of Roth vs traditional 401(k)",
  "Draft a 3-day Tokyo itinerary for a family",
  "What are the risks of a portfolio concentrated in one stock?",
];

export default function CompareClient({ connected }: { connected: boolean }) {
  const [question, setQuestion] = useState("");
  const [selected, setSelected] = useState<string[]>(COMPARE_MODELS.map((m) => m.id));
  const [synthesize, setSynthesize] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]);
  }

  async function run(text?: string) {
    const q = (text ?? question).trim();
    if (!q || busy || selected.length === 0) return;
    setErr(null); setBusy(true); setResults(null); setSynthesis(null);
    if (text) setQuestion(text);
    try {
      const res = await fetch("/api/ask/compare", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, models: selected, synthesize }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed");
      setResults(data.results);
      setSynthesis(data.synthesis ?? null);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div>
      {!connected && (
        <div className="ios-list" style={{ margin: "0 0 10px", padding: 14 }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            Add an <strong>OPENROUTER_API_KEY</strong> to enable comparison. Get one at openrouter.ai.
          </div>
        </div>
      )}

      {/* Model picker */}
      <div className="ios-group-header" style={{ padding: "4px 0 7px" }}>MODELS · pick up to 4</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {ALL.map((m) => {
          const on = selected.includes(m.id);
          return (
            <button key={m.id} onClick={() => toggle(m.id)}
              style={{ padding: "7px 13px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${on ? "transparent" : "var(--ios-separator)"}`,
                background: on ? m.color : "transparent", color: on ? "#fff" : "var(--ios-label)" }}>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Question */}
      <div className="ios-list" style={{ margin: 0, padding: 14 }}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything — the same question goes to every selected model…"
          rows={3}
          style={{ width: "100%", background: "var(--ios-fill)", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 16, color: "var(--ios-label)", resize: "vertical", fontFamily: "inherit" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={synthesize} onChange={(e) => setSynthesize(e.target.checked)} style={{ width: 18, height: 18 }} />
          <span className="ios-subhead">Synthesize into one merged answer</span>
        </label>
        <button onClick={() => run()} disabled={busy || !question.trim() || selected.length === 0}
          className="ios-btn ios-btn--primary" style={{ marginTop: 12, opacity: busy || !question.trim() ? 0.5 : 1 }}>
          {busy ? "Asking…" : `Compare ${selected.length} model${selected.length === 1 ? "" : "s"}`}
        </button>
      </div>

      {results === null && !busy && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => run(s)}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--ios-separator)", background: "transparent", color: "var(--ios-tint)", fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left" }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {err && <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", marginTop: 12 }}>{err}</div>}
      {busy && <div className="ios-subhead" style={{ color: "var(--ios-label-2)", marginTop: 16, textAlign: "center" }}>Running against {selected.length} model{selected.length === 1 ? "" : "s"}…</div>}

      {/* Synthesis */}
      {synthesis && (
        <div className="ios-list" style={{ margin: "16px 0 8px", padding: 16, border: "1.5px solid var(--ios-tint)" }}>
          <div className="ios-caption" style={{ color: "var(--ios-tint)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 8 }}>✦ Synthesized answer</div>
          <div className="ios-subhead" style={{ color: "var(--ios-label)" }} dangerouslySetInnerHTML={{ __html: md(synthesis) }} />
        </div>
      )}

      {/* Side-by-side answers (horizontal swipe) */}
      {results && results.length > 0 && (
        <>
          <div className="ios-group-header" style={{ padding: "16px 0 7px" }}>ANSWERS · swipe →</div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 6, margin: "0 -16px", paddingLeft: 16, paddingRight: 16 }}>
            {results.map((r) => {
              const m = META(r.model);
              return (
                <div key={r.model} className="ios-list" style={{ margin: 0, flex: "0 0 84%", maxWidth: 340, scrollSnapAlign: "start", padding: 16, alignSelf: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: m.color, flexShrink: 0 }} />
                    <span className="ios-headline" style={{ fontSize: 15 }}>{m.label}</span>
                  </div>
                  {r.error
                    ? <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", lineHeight: 1.5 }}>Couldn&apos;t answer: {r.error}</div>
                    : <div className="ios-subhead" style={{ color: "var(--ios-label)", fontSize: 14.5 }} dangerouslySetInnerHTML={{ __html: md(r.answer) }} />}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
