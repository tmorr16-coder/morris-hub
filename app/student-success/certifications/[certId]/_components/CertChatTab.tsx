"use client";

import { useState, useRef, useEffect } from "react";
import MarkdownMessage from "@/components/MarkdownMessage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CertChatTabProps {
  examId: string;
  examName: string;
  examCode: string;
}

const QUICK_PROMPTS = [
  "Explain the key domains covered on this exam",
  "What are the most common question types?",
  "What should I study first?",
  "Give me a quick quiz on the hardest domain",
];

export default function CertChatTab({
  examId,
  examName,
  examCode,
}: CertChatTabProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hi! I'm your study assistant for **${examName}**${examCode ? ` (${examCode})` : ""}. I can help you understand key concepts, quiz you on specific domains, explain confusing topics, and help you prioritize your study time. What would you like to know?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage = text.trim();
    setInput("");

    const updatedMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const res = await fetch(
        `/api/student-support/certifications/${examId}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Send only user/assistant messages (skip the greeting which isn't part of the
            // actual conversation sent to Claude — the API builds its own system prompt)
            messages: updatedMessages
              .filter((m) => !(m.role === "assistant" && m === messages[0]))
              .map((m) => ({ role: m.role, content: m.content })),
          }),
        }
      );

      if (!res.ok) throw new Error("Request failed");

      const data = await res.json();
      const reply = data.reply ?? data.message ?? "";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: 600,
          borderRadius: 10,
          border: "1px solid var(--color-rule)",
          background: "var(--color-bg-card)",
          overflow: "hidden",
        }}
      >
        {/* Quick prompts bar */}
        <div
          style={{
            borderBottom: "1px solid var(--color-rule)",
            padding: "10px 16px",
            background: "var(--color-bg)",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-ink-4)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              flexShrink: 0,
            }}
          >
            Quick:
          </span>
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              disabled={loading}
              style={{
                padding: "4px 10px",
                borderRadius: 14,
                border: "1px solid var(--color-rule)",
                background: "var(--color-paper)",
                color: "var(--color-ink-2)",
                fontSize: 11,
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.5 : 1,
                whiteSpace: "nowrap",
                transition: "background 0.1s",
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Messages area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent:
                  msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              {msg.role === "user" ? (
                <div
                  style={{
                    maxWidth: "75%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "var(--color-accent-dark)",
                    color: "white",
                    fontSize: 13,
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              ) : (
                <div
                  style={{
                    maxWidth: "85%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--color-ink-4)",
                      letterSpacing: "0.08em",
                      marginLeft: 2,
                      marginBottom: 2,
                    }}
                  >
                    ASSISTANT
                  </span>
                  <MarkdownMessage
                    content={msg.content}
                    style={{
                      background: "var(--color-bg)",
                      border: "1px solid var(--color-rule)",
                      borderRadius: 10,
                      padding: "12px 16px",
                      fontSize: 13,
                      color: "var(--color-ink)",
                      wordBreak: "break-word",
                    }}
                  />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "var(--color-paper-deep)",
                  color: "var(--color-ink)",
                  fontSize: 13,
                }}
              >
                <div
                  style={{ display: "flex", gap: 4, alignItems: "center" }}
                >
                  <span style={{ opacity: 0.6 }}>Thinking</span>
                  <span style={{ display: "inline-flex", gap: 2 }}>
                    <span style={{ animation: "blink 0.7s infinite" }}>•</span>
                    <span style={{ animation: "blink 0.7s infinite 0.2s" }}>•</span>
                    <span style={{ animation: "blink 0.7s infinite 0.4s" }}>•</span>
                  </span>
                </div>
                <style>{`
                  @keyframes blink {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 1; }
                  }
                `}</style>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            borderTop: "1px solid var(--color-rule)",
            padding: "14px 16px",
            background: "var(--color-bg)",
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder={`Ask anything about ${examName}…`}
              style={{
                flex: 1,
                padding: "10px 12px",
                border: "1px solid var(--color-rule)",
                borderRadius: 7,
                fontSize: 13,
                fontFamily: "inherit",
                boxSizing: "border-box",
                opacity: loading ? 0.6 : 1,
                background: "var(--color-paper)",
                color: "var(--color-ink)",
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                padding: "10px 18px",
                borderRadius: 7,
                border: "none",
                background:
                  loading || !input.trim()
                    ? "var(--color-paper-deep)"
                    : "var(--color-accent-dark)",
                color: "white",
                cursor: loading || !input.trim() ? "default" : "pointer",
                fontSize: 12,
                fontWeight: 600,
                opacity: loading || !input.trim() ? 0.6 : 1,
                transition: "opacity 0.15s",
              }}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
