"use client";

import { useState, useRef, useEffect } from "react";
import type { InvestmentIdea } from "@/lib/investment-ideas-constants";
import MarkdownMessage from "@/components/MarkdownMessage";
import { Chip, Icons } from "@/components/ios";

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
        background: "var(--ios-cell)",
        borderRadius: "var(--ios-radius-card)",
        padding: 16,
      }}
    >
      {messages.length === 0 && (
        <div>
          <p className="ios-footnote" style={{ color: "var(--ios-label-3)", marginBottom: 10 }}>
            Ask questions about your investment ideas. Try one:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {INVESTMENT_PROMPTS.map((p) => (
              <Chip key={p} small onClick={() => send(p)}>
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
            maxHeight: 500,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {messages.map((m, i) => (
            m.role === "user" ? (
              <div key={i} className="ios-bubble ios-bubble--me">
                {m.content}
              </div>
            ) : (
              <div key={i} className="ios-bubble ios-bubble--ai" style={{ maxWidth: "85%" }}>
                <MarkdownMessage content={m.content} />
              </div>
            )
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
          style={{
            background: "color-mix(in srgb, var(--ios-red) 12%, transparent)",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 13,
            color: "var(--ios-red)",
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
          placeholder="Ask about your investments…"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "9px 14px",
            borderRadius: 999,
            background: "var(--ios-fill)",
            border: "var(--ios-hair) solid var(--ios-separator)",
            color: "var(--ios-label)",
            fontSize: 16,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <button
          type="submit"
          className="ios-send"
          disabled={sending || !input.trim()}
          aria-label="Send"
          style={{
            border: "none",
            cursor: sending || !input.trim() ? "not-allowed" : "pointer",
            opacity: sending || !input.trim() ? 0.5 : 1,
          }}
        >
          <Icons.ChevronRight style={{ width: 18, height: 18, transform: "rotate(-90deg)" }} />
        </button>
      </form>
    </div>
  );
}
