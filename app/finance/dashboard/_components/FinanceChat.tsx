"use client";

import { useState, useRef, useEffect } from "react";
import { Chip, Icons } from "@/components/ios";
import MarkdownMessage from "@/components/MarkdownMessage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "What did I spend on groceries this month?",
  "Any recurring subscriptions I should review?",
  "How much have I spent on dining out?",
  "What's my biggest expense category?",
];

export default function FinanceChat() {
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
      const res = await fetch("/api/finance/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chat failed");
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError((e as Error).message);
      setMessages(newMessages); // keep the user's message so they can retry
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

  const canSend = !!input.trim() && !sending;

  return (
    <div
      className="ios-list"
      style={{ margin: 0, padding: "16px" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Icons.SparkleIcon style={{ width: 20, height: 20, color: "var(--ios-tint)" }} />
        <h2 className="ios-headline" style={{ margin: 0 }}>Ask Morris</h2>
      </div>

      {messages.length === 0 && (
        <div style={{ marginBottom: 14 }}>
          <p className="ios-subhead" style={{ color: "var(--ios-label-2)", marginBottom: 10 }}>
            Ask anything about your spending, accounts, or financial trends. Try one of these:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SUGGESTED_PROMPTS.map((p) => (
              <Chip key={p} small onClick={() => !sending && send(p)}>
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
            maxHeight: 360,
            overflowY: "auto",
            marginBottom: 14,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingRight: 2,
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
            <div className="ios-bubble ios-bubble--ai" style={{ color: "var(--ios-label-3)" }}>
              Thinking…
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          className="ios-footnote"
          style={{
            color: "var(--ios-red)",
            padding: "8px 0",
            marginBottom: 8,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          placeholder="Ask about your finances…"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "9px 14px",
            borderRadius: 999,
            border: "var(--ios-hair) solid var(--ios-separator)",
            background: "var(--ios-cell)",
            color: "var(--ios-label)",
            fontSize: 16,
            fontFamily: "inherit",
            outline: "none",
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
