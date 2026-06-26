"use client";

import { useState, useRef, useEffect } from "react";
import type { PlanSnapshot } from "../types";

interface Props {
  planSnapshot: PlanSnapshot;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AdvisorTab({ planSnapshot }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const retirementAge = planSnapshot.profile.retirement_age;

  const QUICK_ACTIONS = [
    `Am I on track to retire at ${retirementAge}?`,
    "What if I delay retirement by 2 years?",
    "How does Social Security timing affect my plan?",
    "What's the impact of my lease on retirement savings?",
    "How much do I need to save each month to close my gap?",
    "Explain my depletion risk",
  ];

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
      const res = await fetch("/api/finance/retirement/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, planSnapshot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Advisor request failed");
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
        background: "var(--color-paper-card)",
        border: "1px solid var(--color-rule)",
        borderRadius: 12,
        padding: "20px 24px",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <h2 className="serif" style={{ fontSize: 22 }}>
          Retirement{" "}
          <span style={{ fontStyle: "italic", color: "var(--color-bronze-dark)" }}>Advisor</span>
        </h2>
        <span
          style={{
            fontSize: 11,
            color: "var(--color-ink-3)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          AI · Haiku
        </span>
      </div>

      {messages.length === 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 10 }}>
            Ask anything about your retirement plan. Your full plan snapshot is included in every question.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {QUICK_ACTIONS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={sending}
                style={{
                  padding: "6px 12px",
                  borderRadius: 18,
                  border: "1px solid var(--color-rule)",
                  background: "var(--color-paper)",
                  color: "var(--color-ink-2)",
                  fontSize: 12,
                  fontFamily: "inherit",
                  cursor: sending ? "wait" : "pointer",
                  textAlign: "left",
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
            maxHeight: 400,
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
                background:
                  m.role === "user" ? "var(--color-bronze)" : "var(--color-paper)",
                color: m.role === "user" ? "#FBF8F1" : "var(--color-ink)",
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
            <div
              style={{
                alignSelf: "flex-start",
                padding: "10px 14px",
                fontSize: 13,
                color: "var(--color-ink-3)",
                fontStyle: "italic",
              }}
            >
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
          placeholder="Ask about your retirement plan…"
          style={{
            flex: 1,
            padding: "10px 14px",
            border: "1px solid var(--color-rule)",
            borderRadius: 10,
            background: "var(--color-paper)",
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
            padding: "10px 20px",
            borderRadius: 10,
            border: "1px solid var(--color-bronze-dark)",
            background: "var(--color-bronze)",
            color: "#FBF8F1",
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
