"use client";

import { useState, useRef, useEffect } from "react";
import { Chip } from "@/components/ios";
import MarkdownMessage from "@/components/MarkdownMessage";
import { useChatHistory, type ChatMessage as Message } from "@/hooks/useChatHistory";

const SUGGESTED_PROMPTS = [
  "What's the weather looking like today?",
  "What are my top priorities for today?",
  "How are my stocks doing?",
  "Anything overdue?",
];

export default function HubChat({ firstName }: { firstName: string }) {
  // Persisted so the conversation carries across screens instead of resetting
  // every time you reopen Ask Morris.
  const { messages, setMessages, clear } = useChatHistory("morris:hub-chat");
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
    <div>
      {messages.length === 0 && (
        <div style={{ marginBottom: 14 }}>
          <p className="ios-subhead" style={{ color: "var(--ios-label-2)", marginBottom: 12 }}>
            Hi {firstName}. Ask anything about your day, your todos, the weather, your watchlist. Try one:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SUGGESTED_PROMPTS.map((p) => (
              <Chip key={p} small onClick={() => send(p)}>{p}</Chip>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <button
            type="button"
            onClick={clear}
            className="ios-footnote"
            style={{ color: "var(--ios-tint)", background: "none", border: "none", padding: "4px 2px", cursor: "pointer" }}
          >
            New chat
          </button>
        </div>
      )}

      {messages.length > 0 && (
        <div
          ref={scrollRef}
          style={{
            maxHeight: 420,
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
              className={`ios-bubble ios-bubble--${m.role === "user" ? "me" : "ai"}`}
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
            borderRadius: 10,
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
          placeholder="Ask anything…"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "10px 16px",
            border: "var(--ios-hair) solid var(--ios-separator)",
            borderRadius: 999,
            background: "var(--ios-cell)",
            color: "var(--ios-label)",
            fontSize: 16,
            outline: "none",
          }}
        />
        <button
          type="submit"
          className="ios-send"
          disabled={sending || !input.trim()}
          aria-label="Send"
          style={{ opacity: sending || !input.trim() ? 0.4 : 1 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
        </button>
      </form>
      <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 8, textAlign: "center", lineHeight: 1.4 }}>
        Not saved · answers from your tasks, weather &amp; watchlist
      </div>
    </div>
  );
}
