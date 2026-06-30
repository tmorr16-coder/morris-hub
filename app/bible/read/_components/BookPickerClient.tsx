"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Book { id: string; name: string; chapters: number; testament: "OT" | "NT" }

interface Props {
  books: Book[];
  preferredBibleId: string;
}

export default function BookPickerClient({ books, preferredBibleId }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [goTo, setGoTo] = useState("");
  const [goToError, setGoToError] = useState("");

  const ot = books.filter((b) => b.testament === "OT");
  const nt = books.filter((b) => b.testament === "NT");

  // Parse "John 3:16" or "John 3" or "Joh 3:16"
  function handleGoTo(e: React.FormEvent) {
    e.preventDefault();
    const raw = goTo.trim();
    const match = raw.match(/^(.+?)\s+(\d+)(?::(\d+))?$/i);
    if (!match) { setGoToError("Try: John 3:16 or Genesis 1"); return; }
    const [, bookInput, chStr, verseStr] = match;
    const bookQuery = bookInput.toLowerCase();
    const found = books.find(
      (b) =>
        b.name.toLowerCase().startsWith(bookQuery) ||
        b.id.toLowerCase() === bookQuery ||
        b.name.toLowerCase() === bookQuery
    );
    if (!found) { setGoToError(`Book not found: "${bookInput}"`); return; }
    const ch = Math.min(parseInt(chStr), found.chapters);
    const verse = verseStr ? `#v${verseStr}` : "";
    router.push(`/bible/read/${found.id}/${ch}?bibleId=${preferredBibleId}${verse}`);
  }

  function renderBookGrid(list: Book[]) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {list.map((book) => (
          <div key={book.id}>
            {/* Book row */}
            <button
              onClick={() => setExpanded(expanded === book.id ? null : book.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", background: expanded === book.id ? "var(--color-accent-soft)" : "var(--color-bg-card)",
                border: `1px solid ${expanded === book.id ? "var(--color-accent)" : "var(--color-rule)"}`,
                borderRadius: expanded === book.id ? "8px 8px 0 0" : 8,
                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 500, color: expanded === book.id ? "var(--color-accent)" : "var(--color-ink)" }}>{book.name}</span>
              <span style={{ fontSize: 11, color: "var(--color-ink-4)" }}>{book.chapters} ch. {expanded === book.id ? "▲" : "▼"}</span>
            </button>

            {/* Chapter grid — shows when expanded */}
            {expanded === book.id && (
              <div style={{ padding: "10px 12px 12px", background: "var(--color-bg-deep)", border: "1px solid var(--color-accent)", borderTop: "none", borderRadius: "0 0 8px 8px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 8 }}>
                  Chapter
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(38px, 1fr))", gap: 4 }}>
                  {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => (
                    <a
                      key={ch}
                      href={`/bible/read/${book.id}/${ch}?bibleId=${preferredBibleId}`}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        height: 36, borderRadius: 6,
                        background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
                        color: "var(--color-ink)", fontSize: 13, fontWeight: 500,
                        textDecoration: "none", transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-accent)"; (e.currentTarget as HTMLElement).style.color = "#FFFDF8"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-bg-card)"; (e.currentTarget as HTMLElement).style.color = "var(--color-ink)"; }}
                    >
                      {ch}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Go To reference */}
      <form onSubmit={handleGoTo} style={{ marginBottom: 24, display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <input
            value={goTo}
            onChange={(e) => { setGoTo(e.target.value); setGoToError(""); }}
            placeholder="Go to a reference — e.g. John 3:16"
            style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: `1px solid ${goToError ? "var(--color-red)" : "var(--color-rule)"}`, background: "var(--color-bg-card)", color: "var(--color-ink)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
          {goToError && <div style={{ fontSize: 11, color: "var(--color-red)", marginTop: 4 }}>{goToError}</div>}
        </div>
        <button type="submit" style={{ padding: "11px 16px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
          Go →
        </button>
      </form>

      {/* OT */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 10 }}>
          Old Testament
        </div>
        {renderBookGrid(ot)}
      </div>

      {/* NT */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 10 }}>
          New Testament
        </div>
        {renderBookGrid(nt)}
      </div>
    </div>
  );
}
