"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "What does John 3:16 mean?",
  "Explain the Sermon on the Mount",
  "Who wrote the Psalms?",
  "What are the major themes of Romans?",
  "How do the four Gospels differ?",
  "What does the Bible say about faith?",
];

export default function BibleChat() {
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
      const res = await fetch("/api/bible/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

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
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      setMessages([...next, {
        role: "assistant",
        content: "I'm having trouble connecting right now. Please try again.",
      }]);
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
    <div style={{
      maxWidth: 720, margin: "0 auto", padding: "0 20px",
      display: "flex", flexDirection: "column",
      height: "calc(100dvh - 120px)",
    }}>
      {/* Header */}
      <div style={{ padding: "20px 0 16px", borderBottom: "1px solid var(--color-rule)", marginBottom: 0 }}>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400,
          margin: "0 0 2px",
        }}>
          Bible Research
        </h1>
        <p style={{ color: "var(--color-ink-3)", fontSize: 13, margin: 0 }}>
          Ask about Scripture — history, theology, context, language, or application.
        </p>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 0 12px" }}>

        {/* Starter prompts (only when empty) */}
        {messages.length === 0 && (
          <div>
            <div style={{ fontSize: 11, color: "var(--color-ink-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
              Suggested questions
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    padding: "9px 16px", borderRadius: 20,
                    border: "1px solid var(--color-rule)",
                    background: "var(--color-bg-card)",
                    fontSize: 13, color: "var(--color-ink-2)",
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "border-color 100ms",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: messages.length === 0 ? 32 : 0 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}>
              {m.role === "assistant" && (
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--color-accent-soft)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, flexShrink: 0, marginRight: 10, marginTop: 2,
                }}>
                  ✝
                </div>
              )}
              <div style={{
                maxWidth: "78%",
                padding: "12px 16px",
                borderRadius: m.role === "user"
                  ? "18px 18px 4px 18px"
                  : "4px 18px 18px 18px",
                background: m.role === "user"
                  ? "var(--color-accent)"
                  : "var(--color-bg-card)",
                color: m.role === "user" ? "#fff" : "var(--color-ink)",
                fontSize: 15,
                lineHeight: 1.65,
                border: m.role === "assistant" ? "1px solid var(--color-rule)" : "none",
                boxShadow: "var(--shadow-card)",
                whiteSpace: "pre-wrap",
                fontFamily: m.role === "assistant" ? "var(--font-display)" : "inherit",
              }}>
                {m.content || (loading && i === messages.length - 1
                  ? <span style={{ color: "var(--color-ink-3)" }}>Searching Scripture…</span>
                  : ""
                )}
              </div>
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role === "user" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "var(--color-accent-soft)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14,
              }}>✝</div>
              <div style={{
                padding: "12px 16px", borderRadius: "4px 18px 18px 18px",
                background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
                boxShadow: "var(--shadow-card)", color: "var(--color-ink-3)", fontSize: 14,
              }}>
                Searching Scripture…
              </div>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: "var(--color-red)", padding: "8px 12px", background: "rgba(154,59,42,0.06)", borderRadius: 8 }}>
              {error}
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        borderTop: "1px solid var(--color-rule)",
        paddingTop: 12, paddingBottom: 12,
        display: "flex", gap: 10, alignItems: "flex-end",
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about any passage, topic, or biblical question…"
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
            width: 40, height: 40, borderRadius: "50%", border: "none",
            background: input.trim() && !loading ? "var(--color-accent)" : "var(--color-rule)",
            color: input.trim() && !loading ? "#fff" : "var(--color-ink-4)",
            fontSize: 16, cursor: input.trim() && !loading ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "background 150ms",
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
