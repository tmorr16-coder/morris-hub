"use client";

import { useState, useRef, useEffect } from "react";
import { Chip } from "@/components/ios";
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

  const canSend = !!input.trim() && !loading;

  return (
    <div
      className="ios-list"
      style={{
        margin: 0,
        display: "flex",
        flexDirection: "column",
        height: 600,
        overflow: "hidden",
      }}
    >
      {/* Quick prompts bar */}
      <div
        style={{
          borderBottom: "var(--ios-hair) solid var(--ios-separator)",
          padding: "12px 16px",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {QUICK_PROMPTS.map((prompt) => (
          <Chip key={prompt} small onClick={() => !loading && sendMessage(prompt)}>
            {prompt}
          </Chip>
        ))}
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
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
          <div className="ios-bubble ios-bubble--ai" style={{ color: "var(--ios-label-3)" }}>
            Thinking…
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          borderTop: "var(--ios-hair) solid var(--ios-separator)",
          padding: "12px 16px",
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder={`Ask anything about ${examName}…`}
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
