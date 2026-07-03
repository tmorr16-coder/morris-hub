"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { List } from "@/components/ios";

interface Book { id: string; name: string; chapters: number; testament: "OT" | "NT" }

interface Props {
  books: Book[];
  preferredBibleId: string;
}

export default function BookPickerClient({ books, preferredBibleId }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testament, setTestament] = useState<"OT" | "NT">("OT");
  const [goTo, setGoTo] = useState("");
  const [goToError, setGoToError] = useState("");

  const list = books.filter((b) => b.testament === testament);

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

  return (
    <>
      {/* Go To reference */}
      <form onSubmit={handleGoTo} style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--ios-fill)", borderRadius: 10, padding: "10px 12px", border: goToError ? "1px solid var(--ios-red)" : "1px solid transparent" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17, flex: "0 0 auto", color: "var(--ios-label-3)" }} aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
            </svg>
            <input
              value={goTo}
              onChange={(e) => { setGoTo(e.target.value); setGoToError(""); }}
              placeholder="Go to a reference — e.g. John 3:16"
              style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontSize: 17, color: "var(--ios-label)" }}
            />
          </div>
          {goToError && <div className="ios-footnote" style={{ color: "var(--ios-red)", marginTop: 5, paddingLeft: 4 }}>{goToError}</div>}
        </div>
        <button
          type="submit"
          style={{ flexShrink: 0, padding: "11px 18px", borderRadius: 10, background: "var(--ios-tint)", color: "var(--ios-on-tint)", fontSize: 15, fontWeight: 600, whiteSpace: "nowrap" }}
        >
          Go
        </button>
      </form>

      {/* Testament switch */}
      <div className="ios-segmented" role="tablist" aria-label="Testament" style={{ margin: "18px 0 14px" }}>
        <button type="button" role="tab" aria-selected={testament === "OT"} onClick={() => { setTestament("OT"); setExpanded(null); }}>Old Testament</button>
        <button type="button" role="tab" aria-selected={testament === "NT"} onClick={() => { setTestament("NT"); setExpanded(null); }}>New Testament</button>
      </div>

      <List style={{ margin: 0 }}>
        {list.map((book) => {
          const isOpen = expanded === book.id;
          return (
            <div key={book.id}>
              <button
                type="button"
                className="ios-cell"
                onClick={() => setExpanded(isOpen ? null : book.id)}
                style={{ background: isOpen ? "var(--ios-cell-pressed)" : undefined }}
              >
                <span className="ios-cell-body">
                  <span className="ios-cell-title" style={{ color: isOpen ? "var(--ios-tint)" : "var(--ios-label)" }}>{book.name}</span>
                </span>
                <span className="ios-cell-trail">
                  <span className="ios-num ios-footnote">{book.chapters} ch</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, color: "var(--ios-label-3)", transform: isOpen ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform 0.15s" }} aria-hidden>
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: "10px 14px 14px", background: "var(--ios-bg)" }}>
                  <div className="ios-group-header" style={{ padding: "0 0 8px" }}>Chapter</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))", gap: 6 }}>
                    {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => (
                      <a
                        key={ch}
                        href={`/bible/read/${book.id}/${ch}?bibleId=${preferredBibleId}`}
                        className="ios-num"
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          height: 40, borderRadius: 8,
                          background: "var(--ios-cell)", color: "var(--ios-label)",
                          fontSize: 15, fontWeight: 500, textDecoration: "none", transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ios-tint)"; (e.currentTarget as HTMLElement).style.color = "var(--ios-on-tint)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ios-cell)"; (e.currentTarget as HTMLElement).style.color = "var(--ios-label)"; }}
                      >
                        {ch}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </List>

      <div style={{ height: 12 }} />
    </>
  );
}
