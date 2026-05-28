"use client";

import { useState, useRef, useEffect } from "react";
import type { InvestmentIdea } from "@/lib/investment-ideas-constants";
import MarkdownMessage from "@/components/MarkdownMessage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const INVESTMENT_PROMPTS = [
  "Which ideas have the lowest risk?",
  "Show me high-return opportunities",
  "What's a good entry point?",
  "How should I diversify?",
];

interface InvestmentChatProps {
  displayedIdeas: InvestmentIdea[];
  selectedCategory: string;
  selectedStatus: string;
  showFavoritesOnly: boolean;
  capitalRange: [number, number];
  returnsRange: [number, number];
}

export default function InvestmentChat({
  displayedIdeas,
  selectedCategory,
  selectedStatus,
  showFavoritesOnly,
  capitalRange,
  returnsRange,
}: InvestmentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Build investment context for the API
  const buildContext = () => {
    const filters: string[] = [];
    if (selectedCategory !== "all") filters.push(`Category: ${selectedCategory}`);
    if (selectedStatus !== "all") filters.push(`Status: ${selectedStatus}`);
    if (showFavoritesOnly) filters.push("Favorites only");
    if (capitalRange[0] > 0 || capitalRange[1] < 1000000) {
      filters.push(`Capital: $${(capitalRange[0] / 1000).toFixed(0)}k - $${(capitalRange[1] / 1000).toFixed(0)}k`);
    }
    if (returnsRange[0] > 0 || returnsRange[1] < 100) {
      filters.push(`Returns: ${returnsRange[0]}% - ${returnsRange[1]}%`);
    }

    const ideaTitles = displayedIdeas.map((i) => i.title).join(", ");

    return `You are helping research investment ideas. Current filters: ${filters.length > 0 ? filters.join(", ") : "None"}.
There are ${displayedIdeas.length} ideas displayed: ${ideaTitles || "None"}.
Provide helpful investment research guidance based on these ideas and filters.`;
  };

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
        body: JSON.stringify({
          messages: newMessages,
          investmentContext: {
            ideasCount: displayedIdeas.length,
            ideas: displayedIdeas.map((i) => ({ title: i.title, category: i.category, status: i.status })),
            filters: {
              category: selectedCategory,
              status: selectedStatus,
              favorites: showFavoritesOnly,
              capitalRange,
              returnsRange,
            },
          },
          systemPrompt: buildContext(),
        }),
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
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-rule)",
        borderRadius: 12,
        padding: "16px",
      }}
    >
      {messages.length === 0 && (
        <div>
          <p style={{ fontSize: 12, color: "var(--color-ink-3)", marginBottom: 8 }}>
            Ask questions about your investment ideas. Try one:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {INVESTMENT_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={sending}
                style={{
                  padding: "5px 10px",
                  borderRadius: 16,
                  border: "1px solid var(--color-rule)",
                  background: "var(--color-bg)",
                  color: "var(--color-ink-2)",
                  fontSize: 11,
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
            maxHeight: 500,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.map((m, i) => (
            m.role === "user" ? (
              <div
                key={i}
                style={{
                  alignSelf: "flex-end",
                  maxWidth: "80%",
                  padding: "9px 13px",
                  borderRadius: 10,
                  background: "var(--color-accent)",
                  color: "#FFFDF8",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {m.content}
              </div>
            ) : (
              <div key={i} style={{ alignSelf: "flex-start", maxWidth: "92%", display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-ink-4)", letterSpacing: "0.08em", marginLeft: 2 }}>
                  ASSISTANT
                </span>
                <MarkdownMessage
                  content={m.content}
                  style={{
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-rule)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 12,
                    color: "var(--color-ink)",
                  }}
                />
              </div>
            )
          ))}
          {sending && (
            <div style={{ alignSelf: "flex-start", padding: "8px 12px", fontSize: 12, color: "var(--color-ink-3)", fontStyle: "italic" }}>
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
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 11,
            color: "var(--color-red)",
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
          placeholder="Ask about your investments…"
          style={{
            flex: 1,
            padding: "9px 12px",
            border: "1px solid var(--color-rule)",
            borderRadius: 8,
            background: "var(--color-bg)",
            color: "var(--color-ink)",
            fontSize: 12,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          style={{
            padding: "9px 16px",
            borderRadius: 8,
            border: "1px solid var(--color-accent-dark)",
            background: "var(--color-accent)",
            color: "#FFFDF8",
            fontSize: 12,
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: sending || !input.trim() ? "not-allowed" : "pointer",
            opacity: sending || !input.trim() ? 0.5 : 1,
            whiteSpace: "nowrap",
          }}
        >
          Ask
        </button>
      </form>
    </div>
  );
}
