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
                content: `Hi! I'm your course assistant for **${courseName}**. I have access to all your uploaded materials. Ask me anything — concepts, study help, exam prep, or questions about your content.`,
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

  const canSend = !!input.trim() && !loading && !initializing;

  return (
    <div
      className="ios-list"
      style={{
        margin: 0,
        display: "flex",
        flexDirection: "column",
        height: "600px",
        overflow: "hidden",
      }}
    >
      {/* Messages Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {messages.map((msg, idx) =>
          msg.role === "user" ? (
            <div
              key={idx}
              className="ios-bubble ios-bubble--me"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {msg.content}
            </div>
          ) : (
            <MarkdownMessage
              key={idx}
              content={msg.content}
              style={{
                maxWidth: "85%",
                width: "fit-content",
                background: "var(--ios-fill)",
                color: "var(--ios-label)",
                borderRadius: 20,
                borderBottomLeftRadius: 6,
                padding: "9px 14px",
                fontSize: 16,
                lineHeight: 1.4,
                wordBreak: "break-word",
              }}
            />
          )
        )}
        {loading && (
          <div className="ios-bubble ios-bubble--ai" style={{ color: "var(--ios-label-2)" }}>
            <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span>Thinking</span>
              <span style={{ display: "inline-flex", gap: 2 }}>
                <span style={{ animation: "blink 0.7s infinite" }}>•</span>
                <span style={{ animation: "blink 0.7s infinite 0.2s" }}>•</span>
                <span style={{ animation: "blink 0.7s infinite 0.4s" }}>•</span>
              </span>
            </span>
            <style>{`
              @keyframes blink {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 1; }
              }
            `}</style>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        style={{
          borderTop: "var(--ios-hair) solid var(--ios-separator)",
          padding: "12px 16px",
        }}
      >
        <form onSubmit={handleSendMessage} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask anything about this course…"
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
              opacity: loading ? 0.6 : 1,
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
    </div>
  );
}
