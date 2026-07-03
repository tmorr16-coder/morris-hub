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
  const canSend = !!input.trim() && !loading;

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
            gap: 8,
            marginBottom: 12,
            paddingRight: 2,
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`ios-bubble ${msg.role === "user" ? "ios-bubble--me" : "ios-bubble--ai"}`}
              style={{ whiteSpace: "pre-wrap" }}
            >
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="ios-bubble ios-bubble--ai" style={{ letterSpacing: 3, color: "var(--ios-label-3)" }}>
              ···
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Composer */}
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
            minWidth: 0,
            padding: "9px 14px",
            borderRadius: 20,
            border: "var(--ios-hair) solid var(--ios-separator)",
            background: "var(--ios-cell)",
            color: "var(--ios-label)",
            fontSize: 16,
            fontFamily: "inherit",
            outline: "none",
            resize: "none",
            lineHeight: "21px",
            boxSizing: "border-box",
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          aria-label="Send"
          className="ios-send"
          style={{ opacity: canSend ? 1 : 0.4, cursor: canSend ? "pointer" : "not-allowed" }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
