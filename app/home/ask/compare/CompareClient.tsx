"use client";

import { useEffect, useMemo, useState } from "react";
import { COMPARE_MODELS, LIVE_MODELS, MORE_MODELS, SYNTH_MODEL, type CompareModel } from "@/lib/openrouter";
import type { Pricing } from "./page";

interface Citation { url: string; title: string }
interface Result { model: string; answer: string; error: string | null; cost: number | null; citations?: Citation[] }

// A saved run — the question *and* every answer it produced, so revisiting a
// recent search costs nothing.
interface HistoryEntry {
  q: string;
  at: number;                 // epoch ms
  models: string[];
  web: boolean;
  results: Result[] | null;   // null for legacy entries (question only)
  synthesis: string | null;
  synthCost: number | null;
  cost: number | null;        // total cost of that run
}

const HISTORY_KEY = "panel-history-v1";
const LEGACY_KEY = "compare-recent-searches"; // question-only strings
const MAX_ENTRIES = 15;
const MAX_BYTES = 1_500_000; // stay well inside the ~5MB localStorage budget

function ago(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function fmtCost(c: number | null | undefined): string {
  if (c == null) return "";
  if (c <= 0) return "$0";
  if (c < 0.001) return "<$0.001";
  return "$" + c.toFixed(c < 0.1 ? 4 : 2);
}

const ALL: CompareModel[] = [...COMPARE_MODELS, ...LIVE_MODELS, ...MORE_MODELS];
const LIVE_IDS = new Set(LIVE_MODELS.map((m) => m.id));
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

export default function CompareClient({ connected, pricing }: { connected: boolean; pricing: Pricing }) {
  const [question, setQuestion] = useState("");
  const [selected, setSelected] = useState<string[]>(COMPARE_MODELS.map((m) => m.id));
  const [synthesize, setSynthesize] = useState(false);
  const [web, setWeb] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null); // "docx"|"pptx"|"md" busy
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgBusy, setImgBusy] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);
  const [imgCost, setImgCost] = useState<number | null>(null);
  const [synthCost, setSynthCost] = useState<number | null>(null);
  const [sessionCost, setSessionCost] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [viewing, setViewing] = useState<number | null>(null); // `at` of a restored run

  // Load saved runs (migrating the old question-only list), then put the most
  // recent one back on screen so answers survive a reload or a trip elsewhere.
  useEffect(() => {
    let saved: HistoryEntry[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      if (Array.isArray(raw)) saved = raw.filter((e) => e && typeof e.q === "string");
    } catch { /* ignore */ }
    if (!saved.length) {
      try {
        const old = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
        if (Array.isArray(old)) {
          saved = old.filter((q: unknown) => typeof q === "string")
            .map((q: string, i: number) => ({ q, at: Date.now() - i, models: [], web: false, results: null, synthesis: null, synthCost: null, cost: null }));
        }
      } catch { /* ignore */ }
    }
    if (!saved.length) return;
    setHistory(saved);
    if (saved[0].results) restore(saved[0], saved);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function persistHistory(next: HistoryEntry[]) {
    let list = next.slice(0, MAX_ENTRIES);
    // Answers are bulky — drop the oldest runs until the payload fits, then
    // keep dropping if the browser still refuses the write.
    while (list.length > 1 && JSON.stringify(list).length > MAX_BYTES) list = list.slice(0, -1);
    setHistory(list);
    for (;;) {
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); break; } catch {
        if (list.length <= 1) { try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ } break; }
        list = list.slice(0, -1);
        setHistory(list);
      }
    }
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
  }
  function removeEntry(at: number) {
    persistHistory(history.filter((e) => e.at !== at));
    if (viewing === at) { setViewing(null); setResults(null); setSynthesis(null); setSynthCost(null); }
  }

  /** Put a saved run back on screen — no model calls, no cost. */
  function restore(e: HistoryEntry, list?: HistoryEntry[]) {
    if (!e.results) { run(e.q); return; }
    setQuestion(e.q);
    setResults(e.results);
    setSynthesis(e.synthesis);
    setSynthCost(e.synthCost);
    setWeb(e.web);
    setSynthesize(!!e.synthesis);
    if (e.models.length) setSelected(e.models.slice(0, 4));
    setViewing(e.at);
    setErr(null);
    if (!list) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function newQuestion() {
    setViewing(null); setQuestion(""); setResults(null); setSynthesis(null); setSynthCost(null); setErr(null);
  }

  // Rough pre-run estimate: ~700 output tokens/model (+ a synthesis pass).
  const estCost = useMemo(() => {
    const promptTok = Math.ceil(question.length / 4) + 60;
    let total = selected.reduce((sum, id) => {
      const p = pricing[id];
      return p ? sum + promptTok * p.prompt + 700 * p.completion : sum;
    }, 0);
    if (synthesize && selected.length >= 2) {
      const p = pricing[SYNTH_MODEL];
      if (p) total += 1600 * p.prompt + 700 * p.completion;
    }
    return total;
  }, [question, selected, synthesize, pricing]);

  const slug = (s: string) => (s || "morris").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "morris";

  async function exportAs(content: string, format: "md" | "docx" | "pptx", title: string) {
    setExporting(format); setErr(null);
    try {
      const res = await fetch("/api/ask/compare/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, format, title }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Export failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${slug(title)}.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      const ch = res.headers.get("X-Generation-Cost");
      const c = ch ? parseFloat(ch) : 0;
      if (c > 0) { setSessionCost((s) => s + c); setNotice(`PowerPoint generated · ${fmtCost(c)}`); }
      else setNotice(`${format === "docx" ? "Word doc" : format === "pptx" ? "PowerPoint" : "Markdown"} downloaded · no model cost`);
      setTimeout(() => setNotice(null), 4000);
    } catch (e) { setErr((e as Error).message); } finally { setExporting(null); }
  }

  async function makeImage() {
    const p = imgPrompt.trim();
    if (!p || imgBusy) return;
    setImgBusy(true); setImgErr(null); setImgUrl(null);
    try {
      const res = await fetch("/api/ask/compare/image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed");
      setImgUrl(data.image);
      setImgCost(data.cost ?? null);
      if (data.cost) setSessionCost((s) => s + data.cost);
    } catch (e) { setImgErr((e as Error).message); } finally { setImgBusy(false); }
  }

  function toggle(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]);
  }

  async function run(text?: string) {
    const q = (text ?? question).trim();
    if (!q || busy || selected.length === 0) return;
    setErr(null); setBusy(true); setResults(null); setSynthesis(null); setSynthCost(null); setViewing(null);
    if (text) setQuestion(text);
    try {
      const res = await fetch("/api/ask/compare", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, models: selected, synthesize, web }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed");
      setResults(data.results);
      setSynthesis(data.synthesis ?? null);
      setSynthCost(data.synthesisCost ?? null);
      if (data.totalCost) setSessionCost((s) => s + data.totalCost);
      // Keep the whole run, so re-opening this question is free.
      const entry: HistoryEntry = {
        q, at: Date.now(), models: selected, web,
        results: data.results ?? null,
        synthesis: data.synthesis ?? null,
        synthCost: data.synthesisCost ?? null,
        cost: data.totalCost ?? null,
      };
      persistHistory([entry, ...history.filter((e) => e.q !== q)]);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div>
      {!connected && (
        <div className="ios-list" style={{ margin: "0 0 10px", padding: 14 }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            Add an <strong>OPENROUTER_API_KEY</strong> to enable the panel. Get one at openrouter.ai.
          </div>
        </div>
      )}

      {/* Model picker */}
      <div className="ios-group-header" style={{ padding: "4px 0 7px" }}>PANEL · pick up to 4</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {ALL.map((m) => {
          const on = selected.includes(m.id);
          return (
            <button key={m.id} onClick={() => toggle(m.id)}
              style={{ padding: "7px 13px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${on ? "transparent" : "var(--ios-separator)"}`,
                background: on ? m.color : "transparent", color: on ? "#fff" : "var(--ios-label)" }}>
              {LIVE_IDS.has(m.id) ? "🌐 " : ""}{m.label}
            </button>
          );
        })}
      </div>

      {/* Question */}
      <div className="ios-list" style={{ margin: 0, padding: 14 }}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything — the same question goes to every model on the panel…"
          rows={3}
          style={{ width: "100%", background: "var(--ios-fill)", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 16, color: "var(--ios-label)", resize: "vertical", fontFamily: "inherit" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} style={{ width: 18, height: 18 }} />
          <span className="ios-subhead">🌐 Live web — ground answers in current search results</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={synthesize} onChange={(e) => setSynthesize(e.target.checked)} style={{ width: 18, height: 18 }} />
          <span className="ios-subhead">Synthesize into one merged answer</span>
        </label>
        <button onClick={() => run()} disabled={busy || !question.trim() || selected.length === 0}
          className="ios-btn ios-btn--primary" style={{ marginTop: 12, opacity: busy || !question.trim() ? 0.5 : 1 }}>
          {busy ? "Asking…" : `Ask ${selected.length} model${selected.length === 1 ? "" : "s"}`}
        </button>
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>
          {estCost > 0 && <>Est. this run <strong style={{ color: "var(--ios-label-2)" }}>~{fmtCost(estCost)}</strong>. </>}
          {web && <>Live web adds ~$0.01–0.02 per model. </>}
          {sessionCost > 0 && <>Session <strong style={{ color: "var(--ios-label-2)" }}>{fmtCost(sessionCost)}</strong>. </>}
          Exact cost shown after each action.
        </div>
      </div>
      {notice && <div className="ios-footnote" style={{ color: "var(--ios-green)", marginTop: 10, textAlign: "center" }}>{notice}</div>}

      {!busy && history.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="ios-group-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 7px" }}>
            <span>RECENT · answers saved</span>
            <button onClick={() => { persistHistory([]); newQuestion(); }} className="ios-caption" style={{ color: "var(--ios-tint)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Clear all</button>
          </div>
          <div className="ios-list" style={{ margin: 0 }}>
            {history.map((e, i) => {
              const n = e.results?.filter((r) => r.answer && !r.error).length ?? 0;
              return (
                <div key={e.at} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: i < history.length - 1 ? "1px solid var(--ios-separator)" : "none", background: viewing === e.at ? "var(--ios-fill)" : "transparent" }}>
                  <button onClick={() => restore(e)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                    <div style={{ color: "var(--ios-label)", fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.q}</div>
                    <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 2 }}>
                      {e.results ? `${n} saved answer${n === 1 ? "" : "s"}${e.synthesis ? " + synthesis" : ""} · ${ago(e.at)}` : "tap to ask again"}
                      {e.cost != null && e.cost > 0 && ` · ${fmtCost(e.cost)}`}
                    </div>
                  </button>
                  {e.results && (
                    <button onClick={() => run(e.q)} aria-label="Ask again" title="Ask again (runs the models, costs money)"
                      style={{ background: "none", border: "1px solid var(--ios-separator)", borderRadius: 8, color: "var(--ios-tint)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "5px 9px", flexShrink: 0 }}>
                      Re-ask
                    </button>
                  )}
                  <button onClick={() => removeEntry(e.at)} aria-label="Remove search" style={{ background: "none", border: "none", color: "var(--ios-label-3)", fontSize: 19, lineHeight: 1, cursor: "pointer", padding: "0 4px", flexShrink: 0 }}>×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {viewing != null && results && !busy && (
        <div className="ios-list" style={{ margin: "16px 0 0", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="ios-caption" style={{ color: "var(--ios-label-2)", flex: 1, minWidth: 140 }}>
            Saved answers from {ago(viewing)} · no new cost
          </span>
          <button onClick={() => run(question)} className="ios-caption" style={{ background: "none", border: "1px solid var(--ios-separator)", borderRadius: 8, color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "5px 10px" }}>Ask again</button>
          <button onClick={newQuestion} className="ios-caption" style={{ background: "none", border: "none", color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "5px 2px" }}>New question</button>
        </div>
      )}

      {/* Synthesis */}
      {synthesis && (
        <div className="ios-list" style={{ margin: "16px 0 8px", padding: 16, border: "1.5px solid var(--ios-tint)" }}>
          <div className="ios-caption" style={{ color: "var(--ios-tint)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 8 }}>✦ Synthesized answer</div>
          <div className="ios-subhead" style={{ color: "var(--ios-label)" }} dangerouslySetInnerHTML={{ __html: md(synthesis) }} />
          <ExportBar content={synthesis} title={question} cost={synthCost} exporting={exporting} onExport={exportAs} />
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
                    : <><div className="ios-subhead" style={{ color: "var(--ios-label)", fontSize: 14.5 }} dangerouslySetInnerHTML={{ __html: md(r.answer) }} />
                        {r.citations && r.citations.length > 0 && <Sources items={r.citations} />}
                        <ExportBar content={r.answer} title={`${m.label} — ${question}`} cost={r.cost} exporting={exporting} onExport={exportAs} /></>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Image generation */}
      <div className="ios-group-header" style={{ padding: "18px 0 7px" }}>GENERATE AN IMAGE</div>
      <div className="ios-list" style={{ margin: 0, padding: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={imgPrompt}
            onChange={(e) => setImgPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") makeImage(); }}
            placeholder="Describe an image — e.g. a clean infographic of…"
            style={{ flex: 1, background: "var(--ios-fill)", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 15, color: "var(--ios-label)" }}
          />
          <button onClick={makeImage} disabled={imgBusy || !imgPrompt.trim()}
            style={{ padding: "0 18px", borderRadius: 12, background: "var(--ios-tint)", color: "var(--ios-on-tint)", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: imgBusy || !imgPrompt.trim() ? 0.5 : 1 }}>
            {imgBusy ? "…" : "Create"}
          </button>
        </div>
        {imgErr && <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", marginTop: 10 }}>{imgErr}</div>}
        {imgUrl && (
          <div style={{ marginTop: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt={imgPrompt} style={{ width: "100%", borderRadius: 12, display: "block" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
              <a href={imgUrl} download={`${slug(imgPrompt)}.png`} style={{ color: "var(--ios-tint)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
                Download image ↓
              </a>
              {imgCost != null && <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>cost {fmtCost(imgCost)}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Sources({ items }: { items: Citation[] }) {
  let host = (u: string) => u;
  host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
  return (
    <div style={{ marginTop: 10 }}>
      <div className="ios-caption" style={{ color: "var(--ios-label-3)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 5 }}>Sources</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {items.slice(0, 8).map((c, i) => (
          <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className="ios-caption"
            style={{ color: "var(--ios-tint)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {i + 1}. {c.title || host(c.url)} <span style={{ color: "var(--ios-label-3)" }}>· {host(c.url)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function ExportBar({ content, title, cost, exporting, onExport }: {
  content: string; title: string; cost: number | null; exporting: string | null;
  onExport: (content: string, format: "md" | "docx" | "pptx", title: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  }
  const btn = (fmt: "md" | "docx" | "pptx", label: string) => (
    <button onClick={() => onExport(content, fmt, title)} disabled={exporting != null}
      style={{ padding: "6px 11px", borderRadius: 8, border: "1px solid var(--ios-separator)", background: "transparent", color: "var(--ios-tint)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", opacity: exporting != null ? 0.5 : 1 }}>
      {exporting === fmt ? "…" : label}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--ios-separator)" }}>
      <button onClick={copy}
        style={{ padding: "6px 11px", borderRadius: 8, border: "1px solid var(--ios-separator)", background: copied ? "var(--ios-tint)" : "transparent", color: copied ? "var(--ios-on-tint)" : "var(--ios-tint)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
        {copied ? "Copied ✓" : "Copy"}
      </button>
      {btn("docx", "Word")}
      {btn("pptx", "PowerPoint")}
      {btn("md", "Markdown")}
      {cost != null && <span className="ios-caption" style={{ color: "var(--ios-label-3)", marginLeft: "auto" }}>{fmtCost(cost)}</span>}
    </div>
  );
}
