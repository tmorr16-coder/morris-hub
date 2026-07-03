"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import MarkdownMessage from "@/components/MarkdownMessage";
import { Chip, Icons } from "@/components/ios";
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

const SUGGESTION_ICONS: Record<SuggestionItem["type"], React.ReactNode> = {
  goal: <Icons.ChecklistIcon style={{ width: 15, height: 15 }} />,
  learning: <Icons.BookIcon style={{ width: 15, height: 15 }} />,
  experience: <Icons.BriefcaseIcon style={{ width: 15, height: 15 }} />,
  relationship: <Icons.PeopleIcon style={{ width: 15, height: 15 }} />,
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
      <div data-section="career" style={{ padding: "24px 16px 40px", textAlign: "center", maxWidth: 460, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <span style={{ width: 56, height: 56, borderRadius: 14, background: "var(--ios-tint)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icons.BriefcaseIcon style={{ width: 30, height: 30 }} />
          </span>
        </div>
        <h2 className="ios-title-2" style={{ margin: "0 0 8px" }}>Set up your profile first</h2>
        <p className="ios-body" style={{ color: "var(--ios-label-2)", margin: "0 0 22px", lineHeight: 1.5 }}>
          The Career Advisor works best when it knows your background and interests. Add
          your professional context to get personalized, relevant advice.
        </p>
        <Link
          href="/career/profile"
          className="ios-btn ios-btn--primary"
          style={{ maxWidth: 320, margin: "0 auto", textDecoration: "none" }}
        >
          Go to Profile &amp; Assessment
        </Link>
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
  const canSend = !!input.trim() && !loading;

  return (
    <div data-section="career">
      {/* Quick prompts — shown before first message */}
      {!hasMessages && (
        <div style={{ padding: "10px 16px 0" }}>
          {contextParts.length > 0 && (
            <div
              className="ios-footnote"
              style={{
                display: "inline-block",
                padding: "8px 12px",
                background: "var(--ios-fill)",
                borderRadius: 10,
                color: "var(--ios-label-2)",
                marginBottom: 16,
              }}
            >
              Context loaded: {contextParts.join(", ")} from your career profile
            </div>
          )}
          <p className="ios-subhead" style={{ color: "var(--ios-label-2)", margin: "0 0 10px" }}>
            Ask anything about your professional growth. Try one of these:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {QUICK_PROMPTS.map((prompt) => (
              <Chip key={prompt} small onClick={() => sendMessage(prompt)}>
                {prompt}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Chat messages */}
      {hasMessages && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "10px 16px 0" }}>
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            const isFirstAssistant =
              msg.role === "assistant" &&
              messages.slice(0, idx).every((m) => m.role !== "assistant");

            return (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Context note above first assistant response */}
                {isFirstAssistant && contextParts.length > 0 && (
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)", paddingLeft: 2 }}>
                    Context used: {contextParts.join(", ")} from your career profile
                  </div>
                )}

                <div
                  className={`ios-bubble ${isUser ? "ios-bubble--me" : "ios-bubble--ai"}`}
                  style={{ whiteSpace: isUser ? "pre-wrap" : "normal", wordBreak: "break-word" }}
                >
                  {isUser ? msg.content : <MarkdownMessage content={msg.content} />}
                </div>

                {/* Suggestions */}
                {msg.role === "assistant" &&
                  msg.suggestions &&
                  msg.suggestions.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <div
                        className="ios-caption"
                        style={{
                          fontWeight: 600,
                          color: "var(--ios-label-2)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          marginBottom: 8,
                          paddingLeft: 2,
                        }}
                      >
                        Suggested actions
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {msg.suggestions.map((suggestion, sIdx) => {
                          const key = `${idx}-${sIdx}`;
                          const added = addedItems.has(key);
                          return (
                            <div
                              key={sIdx}
                              style={{
                                background: "var(--ios-cell)",
                                borderRadius: 14,
                                padding: "12px 14px",
                                width: 220,
                                flexShrink: 0,
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ color: "var(--ios-tint)", display: "flex" }}>
                                  {SUGGESTION_ICONS[suggestion.type]}
                                </span>
                                <span
                                  className="ios-caption"
                                  style={{
                                    fontWeight: 600,
                                    color: "var(--ios-label-2)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                  }}
                                >
                                  {SUGGESTION_LABELS[suggestion.type]}
                                </span>
                              </div>
                              <div className="ios-subhead" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                                {suggestion.title}
                              </div>
                              <div
                                className="ios-footnote"
                                style={{
                                  color: "var(--ios-label-2)",
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
                                type="button"
                                onClick={() => handleAddToPlan(suggestion, key)}
                                disabled={added}
                                style={{
                                  marginTop: 4,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 5,
                                  padding: "7px 10px",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  background: added ? "var(--ios-fill)" : "var(--ios-tint)",
                                  color: added ? "var(--ios-green)" : "#fff",
                                  border: "none",
                                  borderRadius: 9,
                                  cursor: added ? "default" : "pointer",
                                }}
                              >
                                {added ? (
                                  <>
                                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                      <path d="M5 13l4 4L19 7" />
                                    </svg>
                                    Added
                                  </>
                                ) : (
                                  <>
                                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
                                      <path d="M12 5v14M5 12h14" />
                                    </svg>
                                    Add to plan
                                  </>
                                )}
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
            <div className="ios-bubble ios-bubble--ai" style={{ color: "var(--ios-label-3)" }}>
              Thinking…
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {!hasMessages && <div ref={messagesEndRef} />}

      {/* Composer */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: "14px 16px 6px" }}>
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
          placeholder="Ask your career advisor anything…"
          rows={1}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "10px 14px",
            fontSize: 16,
            border: "var(--ios-hair) solid var(--ios-separator)",
            borderRadius: 18,
            background: "var(--ios-cell)",
            color: "var(--ios-label)",
            outline: "none",
            resize: "none",
            lineHeight: 1.4,
            maxHeight: 120,
            overflowY: "auto",
            boxSizing: "border-box",
            fontFamily: "inherit",
            colorScheme: "light dark",
          }}
        />
        <button
          type="button"
          onClick={() => sendMessage(input)}
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
      <div className="ios-caption" style={{ color: "var(--ios-label-3)", textAlign: "center", padding: "0 16px 10px" }}>
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}
