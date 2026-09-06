"use client";

// The one way into scripture.
//
// There were two of these fields — one on Read, one on Search — with different
// parsers behind them, different placeholder text, different error messages and
// different ideas about which books existed. Now there is one component, and
// lib/bible-reference.ts is the only thing that decides what you typed.
//
// It answers while you type rather than only on submit, which is what removes
// the "type it exactly or get an error" feeling: a misspelling shows the book it
// probably means, an ambiguous stem shows the handful it could be, and a book
// with no chapter opens its chapters right here instead of sending you to a
// different screen to pick one.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseReference,
  suggestBooks,
  referenceHref,
  type ParsedReference,
} from "@/lib/bible-reference";
import type { BibleBookMeta } from "@/lib/bible-books";

function MagnifierIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

export default function ReferenceField({
  bibleId,
  placeholder = "Book, chapter, verse, or a topic",
  autoFocus = false,
  /** Called when the text isn't a reference. Without it, non-references go to Search. */
  onTopic,
}: {
  bibleId: string;
  placeholder?: string;
  autoFocus?: boolean;
  onTopic?: (query: string) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  // Set when a book was chosen but no chapter given — shows its chapter grid.
  const [pendingBook, setPendingBook] = useState<BibleBookMeta | null>(null);

  const trimmed = value.trim();

  const parsed: ParsedReference | null = useMemo(
    () => (trimmed ? parseReference(trimmed) : null),
    [trimmed]
  );

  // Candidate books for the type-ahead. Suppressed once the input already
  // resolves to a specific chapter — at that point there is one obvious action
  // and a list of near-misses underneath it is just noise.
  const candidates = useMemo(() => {
    if (!trimmed || pendingBook) return [];
    if (parsed?.chapter != null && parsed.kind !== "fuzzy") return [];
    const bookPart = trimmed.replace(/[\s.:]*\d+.*$/, "").trim() || trimmed;
    return suggestBooks(bookPart, 6);
  }, [trimmed, parsed, pendingBook]);

  function go(ref: ParsedReference) {
    router.push(referenceHref(ref, bibleId));
  }

  function openBook(book: BibleBookMeta) {
    if (book.chapters === 1) {
      router.push(`/bible/read/${book.id}/1?v=${encodeURIComponent(bibleId)}`);
      return;
    }
    setPendingBook(book);
    setValue(book.name);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed) return;
    if (parsed?.chapter != null) { go(parsed); return; }
    // A bare book name opens its chapters rather than assuming chapter 1.
    if (parsed?.book) { openBook(parsed.book); return; }
    if (candidates.length === 1) { openBook(candidates[0].book); return; }
    if (candidates.length > 1) return;  // the list is already on screen — let them pick
    if (onTopic) onTopic(trimmed);
    else router.push(`/bible/search?q=${encodeURIComponent(trimmed)}`);
  }

  function reset() {
    setValue("");
    setPendingBook(null);
    inputRef.current?.focus();
  }

  const showJump = parsed?.chapter != null;

  return (
    <div style={{ padding: "0 var(--ios-gutter)" }}>
      <form onSubmit={submit} role="search">
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--ios-fill)", borderRadius: 12, padding: "11px 13px",
        }}>
          <MagnifierIcon style={{ width: 17, height: 17, flex: "0 0 auto", color: "var(--ios-label-3)" }} />
          <input
            ref={inputRef}
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => { setValue(e.target.value); setPendingBook(null); }}
            placeholder={placeholder}
            aria-label="Find a passage or topic"
            enterKeyHint="go"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            style={{
              flex: 1, minWidth: 0, background: "transparent", border: "none",
              outline: "none", fontSize: 17, fontFamily: "inherit", color: "var(--ios-label)",
            }}
          />
          {value && (
            <button type="button" onClick={reset} aria-label="Clear"
              style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: "var(--ios-label-3)", display: "flex" }}>
              <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          )}
        </div>
      </form>

      {/* The resolved passage — the primary action whenever there is one. */}
      {showJump && parsed && (
        <button
          type="button"
          onClick={() => go(parsed)}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            marginTop: 8, padding: "11px 13px", borderRadius: 12, border: "none",
            background: "var(--ios-tint)", color: "var(--ios-on-tint)",
            fontSize: 16, fontWeight: 600, cursor: "pointer", textAlign: "left",
          }}
        >
          <span style={{ flex: 1 }}>
            {parsed.label}
            {parsed.kind === "fuzzy" && (
              <span style={{ display: "block", fontSize: 13, fontWeight: 500, opacity: 0.85 }}>
                Did you mean this?
              </span>
            )}
          </span>
          <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
        </button>
      )}

      {/* Books it could be — a misspelling, a stem, or a book with no number. */}
      {candidates.length > 0 && (
        <div style={{
          marginTop: 8, borderRadius: 12, overflow: "hidden",
          background: "var(--ios-cell)", border: "var(--ios-hair) solid var(--ios-separator)",
        }}>
          {candidates.map((c, i) => (
            <button
              key={c.book.id}
              type="button"
              onClick={() => openBook(c.book)}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "11px 13px", border: "none", background: "transparent",
                borderTop: i === 0 ? "none" : "var(--ios-hair) solid var(--ios-separator)",
                color: "var(--ios-label)", fontSize: 16, cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ flex: 1 }}>{c.book.name}</span>
              <span className="ios-footnote ios-num" style={{ color: "var(--ios-label-3)" }}>
                {c.book.chapters} ch
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Chapters, in place. Picking a book used to mean going somewhere else. */}
      {pendingBook && (
        <div style={{ marginTop: 12 }}>
          <div className="ios-group-header" style={{ padding: "0 0 8px" }}>
            {pendingBook.name} · chapter
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 6 }}>
            {Array.from({ length: pendingBook.chapters }, (_, i) => i + 1).map((ch) => (
              <a
                key={ch}
                href={`/bible/read/${pendingBook.id}/${ch}?v=${encodeURIComponent(bibleId)}`}
                className="ios-num"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 44, borderRadius: 10, background: "var(--ios-cell)",
                  color: "var(--ios-label)", fontSize: 15, fontWeight: 500, textDecoration: "none",
                }}
              >
                {ch}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Nothing matched — say what happens next rather than showing an error. */}
      {trimmed && !showJump && !pendingBook && candidates.length === 0 && (
        <button
          type="button"
          onClick={() => (onTopic ? onTopic(trimmed) : router.push(`/bible/search?q=${encodeURIComponent(trimmed)}`))}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            marginTop: 8, padding: "11px 13px", borderRadius: 12,
            border: "var(--ios-hair) solid var(--ios-separator)", background: "var(--ios-cell)",
            color: "var(--ios-label)", fontSize: 16, cursor: "pointer", textAlign: "left",
          }}
        >
          <MagnifierIcon style={{ width: 16, height: 16, color: "var(--ios-label-3)", flex: "0 0 auto" }} />
          <span style={{ flex: 1 }}>
            Search for <span style={{ fontWeight: 600 }}>{trimmed}</span>
          </span>
        </button>
      )}
    </div>
  );
}
