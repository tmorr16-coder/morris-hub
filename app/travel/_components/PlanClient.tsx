"use client";

import { useRef, useState } from "react";

interface Msg { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "Plan a 4-day trip to San Diego next month",
  "Cheapest weekend to fly somewhere warm in October",
  "Should we drive or fly to Los Angeles?",
  "Things to do & events in Chicago this weekend",
];

export default function PlanClient({ connected }: { connected: boolean }) {
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
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 30);
    try {
      const res = await fetch("/api/travel/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
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

  return (
    <div>
      {!connected && (
        <div className="ios-list" style={{ margin: "0 0 8px", padding: 14 }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            The planner needs a search provider token (SerpApi) to pull live data. It can still chat, but results will be limited until search is connected.
          </div>
        </div>
      )}

      <div className="ios-list" style={{ margin: 0, padding: 16 }}>
        <div ref={scrollRef} style={{ maxHeight: 460, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.length === 0 && (
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
              Ask me to plan a trip — I&apos;ll pull real flights, hotels, things to do, events, car rentals, and compare driving vs flying, all tuned to your saved preferences.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "90%" }}>
              <div style={{
                padding: "10px 14px", borderRadius: 16, lineHeight: 1.5, whiteSpace: "pre-wrap",
                background: m.role === "user" ? "var(--ios-tint)" : "var(--ios-fill)",
                color: m.role === "user" ? "var(--ios-on-tint)" : "var(--ios-label)",
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div style={{ alignSelf: "flex-start" }}>
              <div style={{ padding: "10px 14px", borderRadius: 16, background: "var(--ios-fill)", color: "var(--ios-label-2)" }}>
                Searching…
              </div>
            </div>
          )}
        </div>

        {messages.length === 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} disabled={busy}
                style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--ios-separator)", background: "transparent", color: "var(--ios-tint)", fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left" }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {err && <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", marginTop: 10 }}>{err}</div>}

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Where to? Give me dates & a destination…"
            style={{ flex: 1, background: "var(--ios-fill)", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 15, color: "var(--ios-label)" }}
          />
          <button type="submit" disabled={busy || !input.trim()}
            style={{ padding: "0 18px", borderRadius: 12, background: "var(--ios-tint)", color: "var(--ios-on-tint)", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: busy || !input.trim() ? 0.5 : 1 }}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
