"use client";

import { useState, useRef, useEffect } from "react";
import MarkdownMessage from "@/components/MarkdownMessage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ResearchChatProps {
  courseName: string;
  courseId: string;
}

export default function ResearchChat({ courseName, courseId }: ResearchChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation history on mount
  useEffect(() => {
    const loadConversation = async () => {
      try {
        const response = await fetch(
          `/api/student-support/research-chat?courseId=${courseId}`
        );
        if (response.ok) {
          const data = await response.json();
          setSessionId(data.sessionId);
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          } else {
            // No conversation history, start with greeting
            setMessages([
              {
                role: "assistant",
                content: `Hi! I'm your research assistant for ${courseName}. I can help you understand concepts, research topics, and prepare for your studies. What would you like to learn about?`,
              },
            ]);
          }
        }
      } catch (err) {
        console.error("Error loading conversation:", err);
        setMessages([
          {
            role: "assistant",
            content: `Hi! I'm your research assistant for ${courseName}. I can help you understand concepts, research topics, and prepare for your studies. What would you like to learn about?`,
          },
        ]);
      } finally {
        setInitializing(false);
      }
    };

    loadConversation();
  }, [courseId, courseName]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || initializing) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch("/api/student-support/research-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          courseId,
          sessionId,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      // Update sessionId if it wasn't set before
      if (!sessionId && data.sessionId) {
        setSessionId(data.sessionId);
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    } catch (err) {
      console.error("Error:", err);
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "600px",
        borderRadius: 8,
        border: "1px solid var(--color-rule)",
        background: "var(--color-bg-card)",
        overflow: "hidden",
      }}
    >
      {/* Messages Area */}
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
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            {msg.role === "user" ? (
              <div
                style={{
                  maxWidth: "75%",
                  padding: "10px 14px",
                  borderRadius: 8,
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
              <div style={{ maxWidth: "85%", display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-ink-4)", letterSpacing: "0.08em", marginLeft: 2, marginBottom: 2 }}>
                  ASSISTANT
                </span>
                <MarkdownMessage
                  content={msg.content}
                  style={{
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-rule)",
                    borderRadius: 8,
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
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                background: "var(--color-paper-deep)",
                color: "var(--color-ink)",
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ opacity: 0.6 }}>Thinking</span>
                <span
                  style={{
                    display: "inline-flex",
                    gap: 2,
                  }}
                >
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

      {/* Input Area */}
      <div
        style={{
          borderTop: "1px solid var(--color-rule)",
          padding: "16px",
          background: "var(--color-bg)",
        }}
      >
        <form onSubmit={handleSendMessage} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask a question about the course..."
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "1px solid var(--color-rule)",
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "inherit",
              boxSizing: "border-box",
              opacity: loading ? 0.6 : 1,
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              padding: "10px 16px",
              borderRadius: 6,
              border: "none",
              background:
                loading || !input.trim() ? "var(--color-paper-deep)" : "var(--color-accent-dark)",
              color: "white",
              cursor: loading || !input.trim() ? "default" : "pointer",
              fontSize: 12,
              fontWeight: 500,
              opacity: loading || !input.trim() ? 0.6 : 1,
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
