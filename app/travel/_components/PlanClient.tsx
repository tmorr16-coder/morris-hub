"use client";

import { useEffect, useRef, useState } from "react";

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "Plan a 4-day trip to San Diego next month",
  "Cheapest weekend to fly somewhere warm in October",
  "Should we drive or fly to Los Angeles?",
  "Things to do & events in Chicago this weekend",
];

// ── Tiny, safe markdown → HTML (bold, italic, code, links, headings, lists) ──
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s: string): string {
  return esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="md-a">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
}
function renderMarkdown(text: string): string {
  const lines = text.replace(/\r/g, "").split("\n");
  const html: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => { if (list) { html.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { closeList(); html.push(`<div class="md-h">${inline(h[2])}</div>`); continue; }
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul) { if (list !== "ul") { closeList(); html.push('<ul class="md-ul">'); list = "ul"; } html.push(`<li>${inline(ul[1])}</li>`); continue; }
    if (ol) { if (list !== "ol") { closeList(); html.push('<ol class="md-ol">'); list = "ol"; } html.push(`<li>${inline(ol[1])}</li>`); continue; }
    closeList();
    html.push(`<p class="md-p">${inline(line)}</p>`);
  }
  closeList();
  return html.join("");
}

export default function PlanClient({ connected }: { connected: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollDown = () => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  useEffect(() => { scrollDown(); }, [messages, status]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setErr(null);
    setBusy(true);
    setStatus("Thinking…");
    const base = [...messages, { role: "user" as const, content: q }];
    setMessages([...base, { role: "assistant", content: "" }]);
    setInput("");

    try {
      const res = await fetch("/api/travel/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: base }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: { type: string; text?: string };
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === "delta") {
            acc += ev.text ?? "";
            setStatus(null);
            setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: acc }; return c; });
          } else if (ev.type === "status") {
            setStatus(ev.text ?? null);
          } else if (ev.type === "error") {
            setErr(ev.text ?? "Something went wrong.");
          }
        }
      }
    } catch (e) {
      setErr((e as Error).message);
      setMessages((m) => m[m.length - 1]?.content === "" ? m.slice(0, -1) : m);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div>
      <style>{`
        .md-p { margin: 0 0 8px; line-height: 1.6; }
        .md-p:last-child { margin-bottom: 0; }
        .md-h { font-weight: 700; font-size: 15.5px; margin: 10px 0 6px; }
        .md-ul, .md-ol { margin: 4px 0 10px; padding-left: 20px; }
        .md-ul li, .md-ol li { margin: 4px 0; line-height: 1.55; }
        .md-a { color: var(--ios-tint); text-decoration: none; font-weight: 500; }
        .md-code { background: rgba(120,120,128,0.16); padding: 1px 5px; border-radius: 5px; font-size: 0.9em; }
        .tp-dots span { animation: tpb 1.2s infinite; display: inline-block; }
        .tp-dots span:nth-child(2) { animation-delay: .2s; }
        .tp-dots span:nth-child(3) { animation-delay: .4s; }
        @keyframes tpb { 0%,60%,100%{opacity:.25} 30%{opacity:1} }
      `}</style>

      {!connected && (
        <div className="ios-list" style={{ margin: "0 0 8px", padding: 14 }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            The planner needs a search provider token (SerpApi) for live data. It can still chat, but results will be limited until search is connected.
          </div>
        </div>
      )}

      <div className="ios-list" style={{ margin: 0, padding: 16 }}>
        <div ref={scrollRef} style={{ maxHeight: 480, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.length === 0 && (
            <div className="ios-subhead" style={{ color: "var(--ios-label-2)", lineHeight: 1.55 }}>
              Hi! I&apos;m your travel concierge. Tell me where you&apos;d like to go and roughly when — I&apos;ll find flights, hotels, things to do and events, and even tell you whether to drive or fly. It&apos;s all tuned to your saved preferences.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: m.role === "user" ? "85%" : "94%" }}>
              {m.role === "user" ? (
                <div style={{ padding: "10px 14px", borderRadius: "18px 18px 4px 18px", background: "var(--ios-tint)", color: "var(--ios-on-tint)", lineHeight: 1.5, fontSize: 15 }}>
                  {m.content}
                </div>
              ) : (
                <div style={{ padding: "12px 15px", borderRadius: "18px 18px 18px 4px", background: "var(--ios-fill)", color: "var(--ios-label)", fontSize: 15 }}>
                  {m.content
                    ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                    : <TypingOrStatus status={status} />}
                </div>
              )}
            </div>
          ))}
          {/* status pill under the streaming bubble when it already has text */}
          {status && messages[messages.length - 1]?.content ? (
            <div style={{ alignSelf: "flex-start" }}>
              <span className="ios-caption" style={{ color: "var(--ios-label-2)", display: "inline-flex", gap: 6, alignItems: "center" }}>
                <span className="tp-dots"><span>●</span><span>●</span><span>●</span></span> {status}
              </span>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        {messages.length === 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} disabled={busy}
                style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--ios-separator)", background: "transparent", color: "var(--ios-tint)", fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left" }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {err && <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", marginTop: 10 }}>{err}</div>}

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Where to? Give me dates & a destination…"
            style={{ flex: 1, background: "var(--ios-fill)", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 15, color: "var(--ios-label)" }}
          />
          <button type="submit" disabled={busy || !input.trim()}
            style={{ padding: "0 18px", borderRadius: 12, background: "var(--ios-tint)", color: "var(--ios-on-tint)", border: "none", fontWeight: 700, fontSize: 15, cursor: busy ? "wait" : "pointer", opacity: busy || !input.trim() ? 0.5 : 1 }}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function TypingOrStatus({ status }: { status: string | null }) {
  return (
    <span className="ios-subhead" style={{ color: "var(--ios-label-2)", display: "inline-flex", gap: 7, alignItems: "center" }}>
      <span className="tp-dots"><span>●</span><span>●</span><span>●</span></span>
      {status ?? "Thinking…"}
    </span>
  );
}
