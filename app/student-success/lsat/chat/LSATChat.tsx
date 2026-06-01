"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  { label: "How does blind review work?", prompt: "Explain the blind review method and why it's more effective than just checking answers." },
  { label: "Necessary vs. Sufficient Assumption", prompt: "What's the difference between Necessary and Sufficient Assumption questions? How do I identify which one I'm dealing with?" },
  { label: "The negation test", prompt: "Explain the negation test for Necessary Assumption questions with an example." },
  { label: "I keep falling for 'too strong' traps", prompt: "I keep picking answer choices that are too strong on Strengthen and Assumption questions. What's causing this and how do I fix it?" },
  { label: "RC passage mapping", prompt: "What's the best technique for mapping a Reading Comprehension passage? How much time should I spend on it?" },
  { label: "Make a 3-month study plan", prompt: "I'm starting LSAT prep with 3 months until my test date and a target score of 165. I can study 2 hours on weekdays and 4 hours on weekends. Create a detailed weekly study plan." },
  { label: "Weaken vs. Flaw questions", prompt: "What's the difference between Weaken and Flaw questions? I often confuse the two." },
  { label: "How does LSAT scoring work?", prompt: "Explain how LSAT scoring works — the scale, what raw score I need for my target, and how sections are weighted." },
];

export default function LSATChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    setError(null);
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch("/api/student-support/lsat/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let assistantText = "";
      setMessages([...next, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: assistantText }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px", display: "flex", flexDirection: "column", height: "100dvh" }}>
      {/* Header */}
      <div style={{ padding: "20px 0 14px", borderBottom: "1px solid var(--color-rule)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <Link href="/student-success/lsat" style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none" }}>
              ← LSAT Prep
            </Link>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, margin: "6px 0 2px", letterSpacing: "-0.01em" }}>
              LSAT Tutor
            </h1>
            <p style={{ fontSize: 12, color: "var(--color-ink-3)", margin: 0 }}>
              Ask anything — techniques, question types, study strategy, or walk through a concept.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setError(null); }}
                style={{
                  padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 500,
                  border: "1px solid var(--color-rule)", background: "transparent",
                  color: "var(--color-ink-3)", cursor: "pointer",
                }}
              >
                New chat
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 0 12px" }}>
        {/* Starter prompts */}
        {messages.length === 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-ink-4)", marginBottom: 14 }}>
              Topics to explore
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {STARTERS.map((s) => (
                <button
                  key={s.prompt}
                  onClick={() => send(s.prompt)}
                  style={{
                    padding: "11px 14px", borderRadius: 10, textAlign: "left",
                    border: "1px solid var(--color-rule)", background: "var(--color-bg-card)",
                    fontSize: 13, color: "var(--color-ink-2)", cursor: "pointer",
                    fontFamily: "inherit", lineHeight: 1.4,
                    transition: "border-color 100ms",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-rule)"; }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: messages.length === 0 ? 28 : 0 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              {m.role === "assistant" && (
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                  background: "var(--color-accent-soft)", marginRight: 10, marginTop: 2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14,
                }}>⚖️</div>
              )}
              <div style={{
                maxWidth: "80%",
                padding: "12px 16px",
                borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                background: m.role === "user" ? "var(--color-accent)" : "var(--color-bg-card)",
                color: m.role === "user" ? "#fff" : "var(--color-ink)",
                fontSize: 14, lineHeight: 1.65,
                border: m.role === "assistant" ? "1px solid var(--color-rule)" : "none",
                boxShadow: "var(--shadow-card)",
                whiteSpace: "pre-wrap",
                fontFamily: m.role === "assistant" ? "var(--font-display)" : "inherit",
              }}>
                {m.content || (loading && i === messages.length - 1
                  ? <span style={{ color: "var(--color-ink-3)", fontStyle: "italic" }}>Thinking…</span>
                  : "")}
              </div>
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role === "user" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--color-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚖️</div>
              <div style={{ padding: "12px 16px", borderRadius: "4px 18px 18px 18px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", boxShadow: "var(--shadow-card)", fontSize: 14, color: "var(--color-ink-3)", fontStyle: "italic" }}>
                Thinking…
              </div>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: "var(--color-red)", padding: "8px 12px", background: "rgba(154,59,42,0.06)", borderRadius: 8 }}>
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ borderTop: "1px solid var(--color-rule)", paddingTop: 12, paddingBottom: 16, flexShrink: 0, display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about any LSAT concept, question type, or technique…"
          rows={1}
          style={{
            flex: 1, padding: "10px 14px",
            border: "1px solid var(--color-rule)", borderRadius: 14,
            fontSize: 14, fontFamily: "inherit",
            background: "var(--color-bg-card)",
            resize: "none", outline: "none",
            lineHeight: 1.5, maxHeight: 120, overflowY: "auto",
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          style={{
            width: 40, height: 40, borderRadius: "50%", border: "none", flexShrink: 0,
            background: input.trim() && !loading ? "var(--color-accent)" : "var(--color-rule)",
            color: input.trim() && !loading ? "#fff" : "var(--color-ink-4)",
            fontSize: 16, cursor: input.trim() && !loading ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 150ms",
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
