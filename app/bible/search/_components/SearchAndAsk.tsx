"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { BibleVersion } from "@/lib/bible-api";

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

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
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
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply ?? data.content ?? "" }]);
    } catch (err) {
      setChatError((err as Error).message);
      setMessages(next);
    }
    setChatLoading(false);
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "10px 16px",
    border: "none",
    borderBottom: active ? "2px solid var(--color-accent)" : "2px solid transparent",
    background: "transparent",
    color: active ? "var(--color-ink)" : "var(--color-ink-3)",
    fontWeight: active ? 600 : 500,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "var(--font-geist, system-ui), sans-serif",
    transition: "color 100ms, border-color 100ms",
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--color-rule)", marginBottom: 24 }}>
        <button style={tabBtn(tab === "search")} onClick={() => setTab("search")}>
          Search Scripture
        </button>
        <button style={tabBtn(tab === "ask")} onClick={() => setTab("ask")}>
          Ask Morris
        </button>
      </div>

      {/* ── SEARCH TAB ─────────────────────────────────────────────────── */}
      {tab === "search" && (
        <div>
          {/* Translation + query */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <select
              value={bibleId}
              onChange={(e) => setBibleId(e.target.value)}
              style={{
                padding: "10px 12px", borderRadius: 8,
                border: "1px solid var(--color-rule)",
                background: "var(--color-bg-card)", color: "var(--color-ink)",
                fontSize: 13, fontFamily: "inherit", flexShrink: 0,
              }}
            >
              {versions.map((v) => <option key={v.id} value={v.id}>{v.abbreviation}</option>)}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") search(); }}
              placeholder="Search scripture, topic, or phrase…"
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 8,
                border: "1px solid var(--color-rule)",
                background: "var(--color-bg-card)", color: "var(--color-ink)",
                fontSize: 14, fontFamily: "inherit", outline: "none",
              }}
            />
            <button
              onClick={() => search()}
              disabled={searching}
              style={{
                padding: "10px 16px", borderRadius: 8, border: "none",
                background: "var(--color-accent)", color: "#FFFDF8",
                fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                cursor: searching ? "wait" : "pointer", whiteSpace: "nowrap",
              }}
            >
              {searching ? "…" : "Search"}
            </button>
          </div>

          {/* Topic chips */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            {TOPICS.map((t) => (
              <button key={t} onClick={() => { setQuery(t); search(t); }}
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 16,
                  border: "1px solid var(--color-rule)",
                  background: "var(--color-bg-card)", color: "var(--color-ink-3)",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Go to reference */}
          <form
            onSubmit={handleGoTo}
            style={{
              display: "flex", gap: 8, marginBottom: 24, padding: "14px 16px",
              background: "var(--color-bg-deep)", borderRadius: 10,
              border: "1px solid var(--color-rule)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>
                Go to reference
              </div>
              <input
                value={goTo}
                onChange={(e) => { setGoTo(e.target.value); setGoToError(""); }}
                placeholder="John 3:16  ·  Psalms 23  ·  Romans 8:28"
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 8,
                  border: `1px solid ${goToError ? "var(--color-red)" : "var(--color-rule)"}`,
                  background: "var(--color-bg)", color: "var(--color-ink)",
                  fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
              />
              {goToError && <div style={{ fontSize: 11, color: "var(--color-red)", marginTop: 3 }}>{goToError}</div>}
            </div>
            <button
              type="submit"
              style={{
                alignSelf: "flex-end", padding: "9px 14px", borderRadius: 8,
                border: "none", background: "var(--color-accent)", color: "#FFFDF8",
                fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
              }}
            >
              Go →
            </button>
          </form>

          {/* Results */}
          {searched && results.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-ink-4)", fontSize: 14 }}>
              No results for &ldquo;{query}&rdquo; — try Ask Morris for a question
            </div>
          )}
          {results.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginBottom: 12 }}>
                {results.length} result{results.length !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {results.map((r, i) => (
                  <a
                    key={r.id || i}
                    href={resultHref(r)}
                    style={{
                      display: "block", padding: "12px 14px",
                      background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
                      borderRadius: 10, textDecoration: "none",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-accent)", marginBottom: 4 }}>
                      {r.reference}
                    </div>
                    <div
                      style={{ fontSize: 14, color: "var(--color-ink)", lineHeight: 1.6 }}
                      dangerouslySetInnerHTML={{ __html: r.text }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ASK TAB ────────────────────────────────────────────────────── */}
      {tab === "ask" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Empty state / starters */}
          {messages.length === 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 12 }}>
                {firstName ? `Hi ${firstName}. ` : ""}Ask anything about Scripture, theology, or a specific passage.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ASK_STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={chatLoading}
                    style={{
                      textAlign: "left", padding: "10px 14px", borderRadius: 10,
                      border: "1px solid var(--color-rule)", background: "var(--color-bg-card)",
                      color: "var(--color-ink-2)", fontSize: 13,
                      cursor: chatLoading ? "wait" : "pointer", fontFamily: "inherit",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "88%",
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: m.role === "user" ? "var(--color-accent)" : "var(--color-bg-card)",
                    color: m.role === "user" ? "#FFFDF8" : "var(--color-ink)",
                    border: m.role === "assistant" ? "1px solid var(--color-rule)" : "none",
                    fontSize: 14,
                    lineHeight: 1.65,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.content}
                </div>
              ))}
              {chatLoading && (
                <div style={{ alignSelf: "flex-start", padding: "10px 14px", fontSize: 13, color: "var(--color-ink-3)", fontStyle: "italic" }}>
                  Thinking…
                </div>
              )}
              {chatError && (
                <div style={{ fontSize: 12, color: "var(--color-red)", padding: "8px 12px", background: "rgba(154,59,42,0.06)", borderRadius: 8 }}>
                  {chatError}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Input */}
          <div style={{ display: "flex", gap: 8, position: "sticky", bottom: 80, background: "var(--color-bg)", paddingTop: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about a verse, passage, or theology…"
              disabled={chatLoading}
              style={{
                flex: 1, padding: "11px 14px", borderRadius: 10,
                border: "1px solid var(--color-rule)",
                background: "var(--color-bg-card)", color: "var(--color-ink)",
                fontSize: 14, fontFamily: "inherit", outline: "none",
              }}
            />
            <button
              onClick={() => send()}
              disabled={chatLoading || !input.trim()}
              style={{
                padding: "11px 20px", borderRadius: 10, border: "none",
                background: "var(--color-accent)", color: "#FFFDF8",
                fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                cursor: chatLoading || !input.trim() ? "not-allowed" : "pointer",
                opacity: chatLoading || !input.trim() ? 0.5 : 1,
              }}
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
