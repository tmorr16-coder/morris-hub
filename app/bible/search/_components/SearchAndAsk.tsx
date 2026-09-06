"use client";

import { useState, useRef, useEffect } from "react";
import type { BibleVersion } from "@/lib/bible-api";
import { Segmented, Chip, Group, List, Cell, IconBadge, Icons } from "@/components/ios";
import MarkdownMessage from "@/components/MarkdownMessage";
import { useChatHistory } from "@/hooks/useChatHistory";
import ReferenceField from "../../_components/ReferenceField";

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  reference: string;
  text: string;
  bookId?: string;
  chapterNum?: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  versions: BibleVersion[];
  defaultBibleId: string;
  initialTab: "search" | "ask";
  /** A topic handed over from another screen's ReferenceField — run on arrival. */
  initialQuery?: string;
  firstName: string;
}

// ── Local inline icons (shared stroke style) ─────────────────────────────────

function MagnifierIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" style={style}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function ArrowUpIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

// ── Starters ─────────────────────────────────────────────────────────────────

const TOPICS = [
  "faith", "hope", "love", "prayer", "forgiveness", "grace",
  "salvation", "wisdom", "peace", "strength", "joy", "fear not",
];

const ASK_STARTERS = [
  "What does John 3:16 mean?",
  "Explain the Sermon on the Mount",
  "Who wrote the Psalms?",
  "What are the major themes of Romans?",
  "What does the Bible say about anxiety?",
];

// ── Component ────────────────────────────────────────────────────────────────

export default function SearchAndAsk({ versions, defaultBibleId, initialTab, initialQuery = "", firstName }: Props) {
  const [tab, setTab] = useState<"search" | "ask">(initialTab);

  // Search state
  const [bibleId, setBibleId] = useState(defaultBibleId);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Chat state — persisted so the conversation carries across screens.
  const { messages, setMessages, clear: clearChat } = useChatHistory("morris:bible-ask");
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  // Run the handed-over query once, on arrival.
  const ranInitial = useRef(false);
  useEffect(() => {
    if (!initialQuery || ranInitial.current) return;
    ranInitial.current = true;
    search(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // ── Search ────────────────────────────────────────────────────────────────

  async function search(q = query) {
    if (!q.trim()) return;
    setSearching(true);
    setSearched(false);
    try {
      const res = await fetch(
        `/api/bible/search?bibleId=${encodeURIComponent(bibleId)}&q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      setResults(data ?? []);
    } catch {
      setResults([]);
    }
    setSearching(false);
    setSearched(true);
  }

  function resultHref(r: SearchResult): string {
    if (!r.id) return "#";
    const parts = r.id.split(".");
    if (parts.length >= 2) return `/bible/read/${parts[0]}/${parts[1]}?v=${bibleId}`;
    return "#";
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || chatLoading) return;
    setInput("");
    setChatError(null);
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setChatLoading(true);
    try {
      const res = await fetch("/api/bible/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // The endpoint streams plain text (not JSON) — read it incrementally.
      const reader = res.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let acc = "";
        setMessages([...next, { role: "assistant", content: "" }]);
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages([...next, { role: "assistant", content: acc }]);
        }
      } else {
        const text = await res.text();
        setMessages([...next, { role: "assistant", content: text }]);
      }
    } catch (err) {
      setChatError((err as Error).message);
      setMessages(next);
    }
    setChatLoading(false);
  }

  // ── Shared field styles ─────────────────────────────────────────────────────

  const selectStyle: React.CSSProperties = {
    flexShrink: 0,
    padding: "9px 12px",
    borderRadius: 999,
    border: "var(--ios-hair) solid var(--ios-separator)",
    background: "var(--ios-cell)",
    color: "var(--ios-label)",
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 0 32px" }}>
      {/* Segmented tab switch */}
      <div style={{ padding: "0 var(--ios-gutter) 6px" }}>
        <Segmented
          ariaLabel="Search Scripture or Ask Morris"
          options={[
            { value: "search", label: "Search" },
            { value: "ask", label: "Ask Morris" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* ── SEARCH TAB ─────────────────────────────────────────────────── */}
      {tab === "search" && (
        <div>
          {/* One field.

              This screen used to carry two: a "Search scripture, topic, or
              phrase" box at the top and a separate "Go to reference" card
              further down, each with its own parser — and the reference one
              knew only 18 of the 66 books, so Nahum, Obadiah and Zephaniah
              could not be reached from here at all. ReferenceField decides
              which of the two a query is and does the right thing, so there is
              nothing to choose between and nothing to scroll to. */}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px var(--ios-gutter) 8px" }}>
            <select
              value={bibleId}
              onChange={(e) => setBibleId(e.target.value)}
              aria-label="Translation"
              style={selectStyle}
            >
              {versions.map((v) => <option key={v.id} value={v.id}>{v.abbreviation}</option>)}
            </select>
          </div>
          <ReferenceField
            bibleId={bibleId}
            placeholder="John 3:16, Philippians, forgiveness…"
            onTopic={(q) => { setQuery(q); search(q); }}
          />

          {/* Topic chips */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "14px var(--ios-gutter) 4px" }}>
            {TOPICS.map((t) => (
              <Chip key={t} small onClick={() => { setQuery(t); search(t); }}>{t}</Chip>
            ))}
          </div>

          {/* Results */}
          {searching && (
            <div className="ios-subhead" style={{ textAlign: "center", padding: "28px 24px", color: "var(--ios-label-2)" }}>
              Searching…
            </div>
          )}
          {!searching && searched && results.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--ios-label-2)" }}>
              <MagnifierIcon style={{ width: 30, height: 30, color: "var(--ios-label-3)", margin: "0 auto 10px" }} />
              <div className="ios-subhead">
                No results for &ldquo;{query}&rdquo; — try Ask Morris for a question
              </div>
            </div>
          )}
          {results.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h2 className="ios-group-header">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </h2>
              <List>
                {results.map((r, i) => (
                  <a
                    key={r.id || i}
                    href={resultHref(r)}
                    className="ios-cell"
                    style={{ alignItems: "flex-start" }}
                  >
                    <span className="ios-cell-body">
                      <span className="ios-footnote" style={{ fontWeight: 600, color: "var(--ios-tint)", marginBottom: 3 }}>
                        {r.reference}
                      </span>
                      <span
                        style={{ fontSize: 16, color: "var(--ios-label)", lineHeight: 1.55 }}
                        dangerouslySetInnerHTML={{ __html: r.text }}
                      />
                    </span>
                    <Icons.ChevronRight className="ios-chevron" style={{ marginTop: 3 }} />
                  </a>
                ))}
              </List>
            </div>
          )}
        </div>
      )}

      {/* ── ASK TAB ────────────────────────────────────────────────────── */}
      {tab === "ask" && (
        <div style={{ paddingBottom: 80 }}>
          {/* Empty state / starters */}
          {messages.length === 0 && (
            <>
              <p className="ios-subhead" style={{ color: "var(--ios-label-2)", padding: "14px var(--ios-gutter) 4px", margin: 0 }}>
                {firstName ? `Hi ${firstName}. ` : ""}Ask anything about Scripture, theology, or a specific passage.
              </p>
              <Group header="Try asking">
                {ASK_STARTERS.map((s) => (
                  <Cell
                    key={s}
                    title={s}
                    onClick={() => send(s)}
                    lead={<IconBadge color="var(--ios-tint)"><Icons.SparkleIcon /></IconBadge>}
                  />
                ))}
              </Group>
            </>
          )}

          {/* Chat messages */}
          {messages.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px var(--ios-gutter) 0" }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={clearChat}
                  className="ios-footnote"
                  style={{ color: "var(--ios-tint)", background: "none", border: "none", padding: "2px", cursor: "pointer" }}
                >
                  New chat
                </button>
              </div>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`ios-bubble ${m.role === "user" ? "ios-bubble--me" : "ios-bubble--ai"}`}
                  style={m.role === "user" ? { whiteSpace: "pre-wrap" } : undefined}
                >
                  {m.role === "user" ? m.content : <MarkdownMessage content={m.content} />}
                </div>
              ))}
              {chatLoading && (
                <div className="ios-bubble ios-bubble--ai" style={{ color: "var(--ios-label-2)", fontStyle: "italic" }}>
                  Thinking…
                </div>
              )}
              {chatError && (
                <div
                  className="ios-footnote"
                  style={{
                    color: "var(--ios-red)", padding: "8px 12px", alignSelf: "flex-start",
                    background: "var(--ios-fill)", borderRadius: 10,
                  }}
                >
                  {chatError}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Composer */}
          <div className="ios-composer">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about a verse, passage, or theology…"
              disabled={chatLoading}
            />
            <button
              onClick={() => send()}
              disabled={chatLoading || !input.trim()}
              aria-label="Send"
              className="ios-send"
              style={{
                opacity: chatLoading || !input.trim() ? 0.4 : 1,
                cursor: chatLoading || !input.trim() ? "not-allowed" : "pointer",
              }}
            >
              <ArrowUpIcon style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
