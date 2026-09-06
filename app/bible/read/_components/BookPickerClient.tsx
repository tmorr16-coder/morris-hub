"use client";

import { useState } from "react";
import { List } from "@/components/ios";

interface Book { id: string; name: string; chapters: number; testament: "OT" | "NT" }

interface Props {
  books: Book[];
  preferredBibleId: string;
}

// Browsing, and only browsing.
//
// This used to carry its own "Go to a reference" field, with its own parser
// that matched on name.startsWith() and knew no abbreviations — so "Jn 3:16"
// failed here while working on Search, which had a third parser of its own.
// Finding a passage is ReferenceField's job now, once, above this list. What
// is left is the thing a list is actually good for: not knowing what you want
// and looking down the shelf.

export default function BookPickerClient({ books, preferredBibleId }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testament, setTestament] = useState<"OT" | "NT">("OT");

  const list = books.filter((b) => b.testament === testament);

  return (
    <>
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
                        href={`/bible/read/${book.id}/${ch}?v=${preferredBibleId}`}
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
