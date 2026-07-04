"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { BibleVersion } from "@/lib/bible-api";
import { Segmented, Chip, Group, List, Cell, IconBadge, Icons } from "@/components/ios";
import MarkdownMessage from "@/components/MarkdownMessage";
import { useChatHistory } from "@/hooks/useChatHistory";

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

// ── Book reference lookup ────────────────────────────────────────────────────

const BOOKS: Record<string, { id: string; chapters: number }> = {
  genesis: { id: "GEN", chapters: 50 }, gen: { id: "GEN", chapters: 50 },
  exodus: { id: "EXO", chapters: 40 }, exo: { id: "EXO", chapters: 40 },
  psalms: { id: "PSA", chapters: 150 }, psalm: { id: "PSA", chapters: 150 }, psa: { id: "PSA", chapters: 150 },
  proverbs: { id: "PRO", chapters: 31 }, prov: { id: "PRO", chapters: 31 },
  isaiah: { id: "ISA", chapters: 66 }, isa: { id: "ISA", chapters: 66 },
  matthew: { id: "MAT", chapters: 28 }, mat: { id: "MAT", chapters: 28 },
  mark: { id: "MRK", chapters: 16 }, mrk: { id: "MRK", chapters: 16 },
  luke: { id: "LUK", chapters: 24 }, luk: { id: "LUK", chapters: 24 },
  john: { id: "JHN", chapters: 21 }, jhn: { id: "JHN", chapters: 21 },
  acts: { id: "ACT", chapters: 28 }, act: { id: "ACT", chapters: 28 },
  romans: { id: "ROM", chapters: 16 }, rom: { id: "ROM", chapters: 16 },
  galatians: { id: "GAL", chapters: 6 }, gal: { id: "GAL", chapters: 6 },
  ephesians: { id: "EPH", chapters: 6 }, eph: { id: "EPH", chapters: 6 },
  philippians: { id: "PHP", chapters: 4 }, php: { id: "PHP", chapters: 4 },
  hebrews: { id: "HEB", chapters: 13 }, heb: { id: "HEB", chapters: 13 },
  james: { id: "JAS", chapters: 5 }, jas: { id: "JAS", chapters: 5 },
  revelation: { id: "REV", chapters: 22 }, rev: { id: "REV", chapters: 22 },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function SearchAndAsk({ versions, defaultBibleId, initialTab, firstName }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"search" | "ask">(initialTab);

  // Search state
  const [bibleId, setBibleId] = useState(defaultBibleId);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [goTo, setGoTo] = useState("");
  const [goToError, setGoToError] = useState("");

  // Chat state — persisted so the conversation carries across screens.
  const { messages, setMessages, clear: clearChat } = useChatHistory("morris:bible-ask");
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

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

  function handleGoTo(e: React.FormEvent) {
    e.preventDefault();
    const raw = goTo.trim();
    const match = raw.match(/^(.+?)\s+(\d+)(?::(\d+))?$/i);
    if (!match) { setGoToError("Try: John 3:16 or Psalms 23"); return; }
    const [, bookInput, chStr, verseStr] = match;
    const found = BOOKS[bookInput.toLowerCase()];
    if (!found) { setGoToError(`Book not recognised: "${bookInput}"`); return; }
    const ch = Math.min(parseInt(chStr), found.chapters);
    const hash = verseStr ? `#v${verseStr}` : "";
    router.push(`/bible/read/${found.id}/${ch}?bibleId=${bibleId}${hash}`);
  }

  function resultHref(r: SearchResult): string {
    if (!r.id) return "#";
    const parts = r.id.split(".");
    if (parts.length >= 2) return `/bible/read/${parts[0]}/${parts[1]}?bibleId=${bibleId}`;
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
          {/* Translation + search field */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px var(--ios-gutter) 0" }}>
            <select
              value={bibleId}
              onChange={(e) => setBibleId(e.target.value)}
              aria-label="Translation"
              style={selectStyle}
            >
              {versions.map((v) => <option key={v.id} value={v.id}>{v.abbreviation}</option>)}
            </select>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 14px",
                borderRadius: 999,
                background: "var(--ios-cell)",
                border: "var(--ios-hair) solid var(--ios-separator)",
              }}
            >
              <MagnifierIcon style={{ width: 17, height: 17, color: "var(--ios-label-3)", flexShrink: 0 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") search(); }}
                placeholder="Search scripture, topic, or phrase…"
                style={{
                  flex: 1, minWidth: 0, border: "none", outline: "none",
                  background: "transparent", color: "var(--ios-label)",
                  fontSize: 16, fontFamily: "inherit",
                }}
              />
            </div>
            <button
              onClick={() => search()}
              disabled={searching}
              aria-label="Search"
              className="ios-send"
              style={{ opacity: searching ? 0.5 : 1, cursor: searching ? "wait" : "pointer" }}
            >
              <MagnifierIcon style={{ width: 17, height: 17 }} />
            </button>
          </div>

          {/* Topic chips */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "14px var(--ios-gutter) 4px" }}>
            {TOPICS.map((t) => (
              <Chip key={t} small onClick={() => { setQuery(t); search(t); }}>{t}</Chip>
            ))}
          </div>

          {/* Go to reference */}
          <div style={{ marginTop: 20 }}>
            <h2 className="ios-group-header">Go to reference</h2>
            <form
              onSubmit={handleGoTo}
              style={{
                margin: "0 var(--ios-gutter)", padding: "12px 14px",
                background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)",
                display: "flex", flexDirection: "column", gap: 8,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={goTo}
                  onChange={(e) => { setGoTo(e.target.value); setGoToError(""); }}
                  placeholder="John 3:16  ·  Psalms 23  ·  Romans 8:28"
                  style={{
                    flex: 1, minWidth: 0, padding: "9px 12px", borderRadius: 8,
                    border: `var(--ios-hair) solid ${goToError ? "var(--ios-red)" : "var(--ios-separator)"}`,
                    background: "var(--ios-bg)", color: "var(--ios-label)",
                    fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                  }}
                />
                <button
                  type="submit"
                  className="ios-btn ios-btn--plain"
                  style={{ display: "inline-flex", alignItems: "center", gap: 2, fontWeight: 600, whiteSpace: "nowrap" }}
                >
                  Go
                  <Icons.ChevronRight style={{ width: 16, height: 16 }} />
                </button>
              </div>
              {goToError && (
                <div className="ios-footnote" style={{ color: "var(--ios-red)" }}>{goToError}</div>
              )}
            </form>
          </div>

          {/* Results */}
          {searched && results.length === 0 && (
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
