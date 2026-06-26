"use client";

import { useState, useRef, useEffect } from "react";
interface ChatMessage { role: "user" | "assistant"; content: string; }

interface Props {
  systemContext: string;
  placeholder?: string;
  welcomeMessage?: string;
  compact?: boolean;
  addProfileContext?: boolean;
}

const STORAGE_KEY = "health-dashboard-profile";

function buildProfileAddendum(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return "";
    const p = JSON.parse(raw);
    const goals: string[] = Array.isArray(p.fitnessGoals)
      ? p.fitnessGoals
      : p.fitnessGoal
      ? [p.fitnessGoal]
      : [];
    const parts: string[] = [];
    if (p.name) parts.push(`User's name: ${p.name}.`);
    if (p.age) parts.push(`Age: ${p.age}.`);
    if (goals.length) parts.push(`Fitness goals: ${goals.join(", ")}.`);
    if (p.activityLevel) parts.push(`Activity level: ${p.activityLevel}.`);
    if (p.currentWeightLbs) parts.push(`Current weight: ${p.currentWeightLbs} lbs.`);
    if (p.targetWeightLbs) parts.push(`Target weight: ${p.targetWeightLbs} lbs.`);
    if (p.dietary?.length) parts.push(`Dietary preferences: ${p.dietary.join(", ")}.`);
    return parts.length ? `\n\nUser profile: ${parts.join(" ")}` : "";
  } catch {
    return "";
  }
}

export default function ChatWidget({
  systemContext,
  placeholder = "Ask anything…",
  welcomeMessage,
  compact = false,
  addProfileContext = false,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    welcomeMessage ? [{ role: "assistant", content: welcomeMessage }] : []
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrichedContext, setEnrichedContext] = useState(systemContext);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!addProfileContext) return;
    const addendum = buildProfileAddendum();
    setEnrichedContext(systemContext + addendum);
  }, [systemContext, addProfileContext]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/health/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, systemContext: enrichedContext }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply! }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error ?? "Something went wrong. Try again." }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error. Check your connection and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const chatHeight = compact ? 180 : 240;

  return (
    <div>
      {/* Message list */}
      {messages.length > 0 && (
        <div
          style={{
            maxHeight: chatHeight,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 12,
            paddingRight: 2,
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  padding: "9px 12px",
                  borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  background:
                    msg.role === "user"
                      ? "var(--color-ink)"
                      : "var(--color-bg-sunk)",
                  color: msg.role === "user" ? "var(--color-bg)" : "var(--color-ink-2)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "9px 14px",
                  borderRadius: "12px 12px 12px 4px",
                  background: "var(--color-bg-sunk)",
                  fontSize: 18,
                  letterSpacing: 3,
                  color: "var(--color-ink-4)",
                }}
              >
                ···
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input row */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--color-line)",
            background: "var(--color-bg-sunk)",
            color: "var(--color-ink)",
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
            resize: "none",
            lineHeight: 1.4,
            boxSizing: "border-box",
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            background: input.trim() && !loading ? "var(--color-ink)" : "var(--color-bg-sunk)",
            color: input.trim() && !loading ? "var(--color-bg)" : "var(--color-ink-4)",
            fontSize: 14,
            fontWeight: 600,
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            flexShrink: 0,
            transition: "background 120ms",
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
