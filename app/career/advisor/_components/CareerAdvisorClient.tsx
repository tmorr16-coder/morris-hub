"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { SuggestionItem } from "@/app/api/career/advisor/route";

interface Message {
  role: "user" | "assistant";
  content: string;
  suggestions?: SuggestionItem[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Profile = Record<string, any> | null;

interface Goal {
  id: string;
  title: string;
  horizon: string;
  status: string;
  progress_pct: number;
}

interface LearningItem {
  id: string;
  title: string;
  status: string;
  notes: string | null;
}

interface Props {
  profile: Profile;
  goals: Goal[];
  learningItems: LearningItem[];
  hasProfile: boolean;
}

const QUICK_PROMPTS = [
  "What career path should I pursue given my background?",
  "I want to go back to school — what should I study?",
  "What certifications would accelerate my career?",
  "How do I transition to a different role or industry?",
  "Build me a 1-year development plan",
  "What skills should I develop for senior leadership?",
  "Who should I be connecting with to advance my career?",
  "How do I close the gap for my target role?",
];

const SUGGESTION_ICONS: Record<SuggestionItem["type"], string> = {
  goal: "🎯",
  learning: "📚",
  experience: "💼",
  relationship: "🤝",
};

const SUGGESTION_LABELS: Record<SuggestionItem["type"], string> = {
  goal: "Goal",
  learning: "Learning",
  experience: "Experience",
  relationship: "Relationship",
};

export default function CareerAdvisorClient({
  profile,
  goals,
  learningItems,
  hasProfile,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!hasProfile) {
    return (
      <div data-section="career">
        <main
          style={{
            maxWidth: 680,
            margin: "0 auto",
            padding: "80px 28px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 48,
              marginBottom: 20,
            }}
          >
            🧭
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 400,
              color: "var(--color-ink)",
              marginBottom: 12,
            }}
          >
            Set up your profile first
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--color-ink-2)",
              marginBottom: 28,
              lineHeight: 1.6,
            }}
          >
            The Career Advisor works best when it knows your background and interests. Add
            your professional context to get personalized, relevant advice.
          </p>
          <Link
            href="/career/profile"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              background: "var(--color-accent)",
              color: "#fff",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Go to Profile & Assessment
          </Link>
        </main>
      </div>
    );
  }

  // Determine what context we have
  const contextParts: string[] = [];
  if (profile?.current_title || profile?.resume_text) contextParts.push("background");
  if (goals.length > 0) contextParts.push("goals");
  if (learningItems.length > 0) contextParts.push("learning");

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user" as const, content: content.trim() },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/career/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
          includeContext: true,
        }),
      });

      if (!res.ok) throw new Error("Failed");

      const data = await res.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply ?? data.content ?? data.message ?? "",
        suggestions: data.suggestions ?? [],
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Please try again.",
          suggestions: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToPlan(suggestion: SuggestionItem, key: string) {
    const endpoints: Record<SuggestionItem["type"], { url: string; body: object }> = {
      goal: {
        url: "/api/career/goals",
        body: {
          title: suggestion.title,
          description: suggestion.description,
          horizon: suggestion.horizon ?? "medium",
        },
      },
      learning: {
        url: "/api/career/learning",
        body: {
          title: suggestion.title,
          notes: suggestion.description,
          status: "planned",
        },
      },
      experience: {
        url: "/api/career/experiences",
        body: {
          title: suggestion.title,
          description: suggestion.description,
          experience_type: "other",
        },
      },
      relationship: {
        url: "/api/career/relationships",
        body: {
          name: suggestion.title,
          notes: suggestion.description,
          relationship_type: "other",
        },
      },
    };

    const endpoint = endpoints[suggestion.type];
    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(endpoint.body),
      });
      if (res.ok) {
        setAddedItems((prev) => new Set([...prev, key]));
      }
    } catch {
      // silently fail — button stays clickable
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <div data-section="career">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 120px)",
          maxWidth: 860,
          margin: "0 auto",
          padding: "0 28px",
        }}
      >
        {/* Header */}
        <div
          style={{
            paddingTop: 32,
            paddingBottom: 20,
            flexShrink: 0,
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              fontWeight: 400,
              margin: "0 0 4px",
              color: "var(--color-ink)",
            }}
          >
            Career Advisor
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-ink-3)", margin: 0 }}>
            Your personal AI career coach — ask anything about your professional growth.
          </p>
        </div>

        {/* Messages area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            paddingBottom: 20,
          }}
        >
          {/* Quick prompts — shown before first message */}
          {!hasMessages && (
            <div>
              {contextParts.length > 0 && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "var(--color-bg-sunk)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--color-ink-3)",
                    marginBottom: 24,
                    display: "inline-block",
                  }}
                >
                  Context loaded: {contextParts.join(", ")} from your career profile
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 28,
                }}
              >
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      background: "var(--color-bg-raised)",
                      border: "1px solid var(--color-line)",
                      borderRadius: 8,
                      fontSize: 13,
                      color: "var(--color-ink-2)",
                      cursor: "pointer",
                      lineHeight: 1.4,
                      transition: "border-color 0.15s, color 0.15s",
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              const isFirstAssistant =
                msg.role === "assistant" &&
                messages.slice(0, idx).every((m) => m.role !== "assistant");

              return (
                <div key={idx}>
                  {/* Context note above first assistant response */}
                  {isFirstAssistant && contextParts.length > 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--color-ink-4)",
                        marginBottom: 8,
                        paddingLeft: 2,
                      }}
                    >
                      Context used: {contextParts.join(", ")} from your career profile
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "75%",
                        padding: "12px 16px",
                        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        background: isUser
                          ? "var(--color-accent)"
                          : "var(--color-bg-raised)",
                        color: isUser ? "#fff" : "var(--color-ink)",
                        fontSize: 14,
                        lineHeight: 1.6,
                        border: isUser ? "none" : "1px solid var(--color-line)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>

                  {/* Suggestions */}
                  {msg.role === "assistant" &&
                    msg.suggestions &&
                    msg.suggestions.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--color-ink-3)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            marginBottom: 8,
                          }}
                        >
                          Suggested actions
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          {msg.suggestions.map((suggestion, sIdx) => {
                            const key = `${idx}-${sIdx}`;
                            const added = addedItems.has(key);
                            return (
                              <div
                                key={sIdx}
                                style={{
                                  background: "var(--color-bg-raised)",
                                  border: "1px solid var(--color-line)",
                                  borderRadius: 10,
                                  padding: "12px 14px",
                                  width: 220,
                                  flexShrink: 0,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 6,
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <span style={{ fontSize: 16 }}>
                                    {SUGGESTION_ICONS[suggestion.type]}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      color: "var(--color-ink-3)",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                    }}
                                  >
                                    {SUGGESTION_LABELS[suggestion.type]}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "var(--color-ink)",
                                    lineHeight: 1.3,
                                  }}
                                >
                                  {suggestion.title}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "var(--color-ink-2)",
                                    lineHeight: 1.4,
                                    overflow: "hidden",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                  }}
                                >
                                  {suggestion.description}
                                </div>
                                <button
                                  onClick={() => handleAddToPlan(suggestion, key)}
                                  disabled={added}
                                  style={{
                                    marginTop: 4,
                                    padding: "6px 10px",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    background: added
                                      ? "var(--color-bg-sunk)"
                                      : "var(--color-accent-soft)",
                                    color: added
                                      ? "var(--color-moss)"
                                      : "var(--color-accent)",
                                    border: "none",
                                    borderRadius: 6,
                                    cursor: added ? "default" : "pointer",
                                  }}
                                >
                                  {added ? "Added" : "+ Add to plan"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              );
            })}

            {/* Loading indicator */}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: "14px 14px 14px 4px",
                    background: "var(--color-bg-raised)",
                    border: "1px solid var(--color-line)",
                    fontSize: 14,
                    color: "var(--color-ink-3)",
                  }}
                >
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div
          style={{
            borderTop: "1px solid var(--color-line)",
            paddingTop: 16,
            paddingBottom: 20,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-end",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Ask your career advisor anything..."
              rows={1}
              style={{
                flex: 1,
                padding: "11px 14px",
                fontSize: 14,
                border: "1px solid var(--color-line)",
                borderRadius: 10,
                background: "var(--color-bg-raised)",
                color: "var(--color-ink)",
                outline: "none",
                resize: "none",
                lineHeight: 1.5,
                maxHeight: 120,
                overflowY: "auto",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              style={{
                padding: "11px 20px",
                background: "var(--color-accent)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: !input.trim() || loading ? "not-allowed" : "pointer",
                opacity: !input.trim() || loading ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >
              Send
            </button>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--color-ink-4)",
              marginTop: 8,
              textAlign: "center",
            }}
          >
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}
