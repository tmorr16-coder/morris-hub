"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "What's the weather looking like today?",
  "What are my top priorities for today?",
  "How are my stocks doing?",
  "Anything overdue?",
];

export default function HubChat({ firstName }: { firstName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send(text: string) {
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chat failed");
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError((e as Error).message);
      setMessages(newMessages);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    send(trimmed);
  }

  return (
    <div
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-rule)",
        borderRadius: 14,
        padding: "22px 26px",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 24 }}>
          Ask <span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>Claude</span>
        </h2>
        <span style={{ fontSize: 10, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Knows your weather · todos · stocks
        </span>
      </div>

      {messages.length === 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 10 }}>
            Hi {firstName}. Ask anything about your day, your todos, the weather, your watchlist. Try one:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={sending}
                style={{
                  padding: "6px 12px",
                  borderRadius: 18,
                  border: "1px solid var(--color-rule)",
                  background: "var(--color-bg)",
                  color: "var(--color-ink-2)",
                  fontSize: 12,
                  fontFamily: "inherit",
                  cursor: sending ? "wait" : "pointer",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div
          ref={scrollRef}
          style={{
            maxHeight: 380,
            overflowY: "auto",
            marginBottom: 14,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingRight: 4,
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: 12,
                background: m.role === "user" ? "var(--color-accent)" : "var(--color-bg)",
                color: m.role === "user" ? "#FFFDF8" : "var(--color-ink)",
                border: m.role === "assistant" ? "1px solid var(--color-rule)" : "none",
                fontSize: 13,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </div>
          ))}
          {sending && (
            <div style={{ alignSelf: "flex-start", padding: "10px 14px", fontSize: 13, color: "var(--color-ink-3)", fontStyle: "italic" }}>
              Thinking…
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            background: "rgba(154, 59, 42, 0.08)",
            border: "1px solid rgba(154, 59, 42, 0.3)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            color: "var(--color-red)",
            marginBottom: 10,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          placeholder="Ask anything…"
          style={{
            flex: 1,
            padding: "11px 14px",
            border: "1px solid var(--color-rule)",
            borderRadius: 10,
            background: "var(--color-bg)",
            color: "var(--color-ink)",
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          style={{
            padding: "11px 22px",
            borderRadius: 10,
            border: "1px solid var(--color-accent-dark)",
            background: "var(--color-accent)",
            color: "#FFFDF8",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: sending || !input.trim() ? "not-allowed" : "pointer",
            opacity: sending || !input.trim() ? 0.5 : 1,
          }}
        >
          Ask
        </button>
      </form>
    </div>
  );
}
