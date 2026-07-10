"use client";

import { useState, useRef, useEffect } from "react";
import { Chip } from "@/components/ios";
import MarkdownMessage from "@/components/MarkdownMessage";

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

  const canSend = !!input.trim() && !loading;

  return (
    <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* New chat action */}
      {messages.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="ios-btn--plain"
            onClick={() => { setMessages([]); setError(null); }}
            style={{ fontSize: 15 }}
          >
            New chat
          </button>
        </div>
      )}

      {/* Starter prompts */}
      {messages.length === 0 && (
        <div>
          <p className="ios-subhead" style={{ color: "var(--ios-label-2)", margin: "0 0 12px" }}>
            Ask anything — techniques, question types, study strategy, or walk through a concept.
          </p>
          <div className="ios-group-header" style={{ padding: "0 0 10px" }}>Topics to explore</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {STARTERS.map((s) => (
              <Chip key={s.prompt} small onClick={() => send(s.prompt)}>{s.label}</Chip>
            ))}
          </div>
        </div>
      )}

      {/* Conversation */}
      {messages.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.map((m, i) => {
            const pending = m.role === "assistant" && !m.content;
            return (
              <div
                key={i}
                className={`ios-bubble ${m.role === "user" ? "ios-bubble--me" : "ios-bubble--ai"}`}
                style={{ ...(m.role === "user" ? { whiteSpace: "pre-wrap" } : null), ...(pending ? { color: "var(--ios-label-3)" } : null) }}
              >
                {m.role === "user"
                  ? m.content
                  : m.content
                    ? <MarkdownMessage content={m.content} />
                    : (loading && i === messages.length - 1 ? "Thinking…" : "")}
              </div>
            );
          })}

          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="ios-bubble ios-bubble--ai" style={{ color: "var(--ios-label-3)" }}>
              Thinking…
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {error && (
        <div className="ios-footnote" style={{ color: "var(--ios-red)", padding: "4px 0" }}>
          {error}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        style={{ display: "flex", gap: 8, alignItems: "flex-end" }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about any LSAT concept, question type, or technique…"
          rows={1}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "9px 14px",
            borderRadius: 18,
            border: "var(--ios-hair) solid var(--ios-separator)",
            background: "var(--ios-cell)",
            color: "var(--ios-label)",
            fontSize: 16,
            fontFamily: "inherit",
            resize: "none",
            outline: "none",
            lineHeight: 1.4,
            maxHeight: 120,
            overflowY: "auto",
            boxSizing: "border-box",
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 120) + "px";
          }}
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className="ios-send"
          style={{ opacity: canSend ? 1 : 0.4, cursor: canSend ? "pointer" : "not-allowed" }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}
