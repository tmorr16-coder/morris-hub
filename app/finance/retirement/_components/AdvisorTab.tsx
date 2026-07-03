"use client";

import { useState, useRef, useEffect } from "react";
import { Chip, Icons } from "@/components/ios";
import MarkdownMessage from "@/components/MarkdownMessage";
import type { PlanSnapshot } from "../types";

const { SparkleIcon } = Icons;

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
    <div className="ios-list" style={{ margin: 0, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <SparkleIcon style={{ width: 20, height: 20, color: "var(--ios-finance)" }} />
          <h2 className="ios-title-3">Retirement Advisor</h2>
        </div>
        <span className="ios-caption" style={{ color: "var(--ios-label-2)", letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0 }}>
          AI · Haiku
        </span>
      </div>

      {messages.length === 0 && (
        <div style={{ marginBottom: 14 }}>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 12, lineHeight: 1.5 }}>
            Ask anything about your retirement plan. Your full plan snapshot is included in every question.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {QUICK_ACTIONS.map((p) => (
              <Chip key={p} small onClick={() => { if (!sending) send(p); }}>
                {p}
              </Chip>
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
            gap: 8,
            paddingRight: 4,
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`ios-bubble ${m.role === "user" ? "ios-bubble--me" : "ios-bubble--ai"}`}
              style={m.role === "user" ? { whiteSpace: "pre-wrap" } : undefined}
            >
              {m.role === "user" ? m.content : <MarkdownMessage content={m.content} />}
            </div>
          ))}
          {sending && (
            <div className="ios-bubble ios-bubble--ai" style={{ color: "var(--ios-label-2)", fontStyle: "italic" }}>
              Thinking…
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          className="ios-footnote"
          style={{
            background: "var(--ios-fill)",
            borderRadius: 8,
            padding: "8px 12px",
            color: "var(--ios-red)",
            marginBottom: 10,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          placeholder="Ask about your retirement plan…"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "9px 14px",
            border: "1px solid var(--ios-separator)",
            borderRadius: 999,
            background: "var(--ios-bg)",
            color: "var(--ios-label)",
            fontSize: 16,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Ask"
          className="ios-send"
          style={{ opacity: sending || !input.trim() ? 0.4 : 1, cursor: sending || !input.trim() ? "not-allowed" : "pointer" }}
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}
