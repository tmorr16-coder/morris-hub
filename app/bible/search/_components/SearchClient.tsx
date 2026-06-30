"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BibleVersion } from "@/lib/bible-api";

const TOPIC_SUGGESTIONS = [
  "faith", "hope", "love", "prayer", "forgiveness", "grace", "salvation",
  "wisdom", "peace", "strength", "joy", "fear not", "trust", "eternal life",
];

interface SearchResult {
  id: string;
  reference: string;
  text: string;
  bookId?: string;
  chapterNum?: number;
}

interface Props {
  versions: BibleVersion[];
  defaultBibleId: string;
}

export default function SearchClient({ versions, defaultBibleId }: Props) {
  const router = useRouter();
  const [bibleId, setBibleId] = useState(defaultBibleId);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [goTo, setGoTo] = useState("");
  const [goToError, setGoToError] = useState("");

  const BIBLE_BOOKS_ABBR: Record<string, { id: string; chapters: number }> = {
    genesis: { id: "GEN", chapters: 50 }, gen: { id: "GEN", chapters: 50 },
    exodus: { id: "EXO", chapters: 40 }, exo: { id: "EXO", chapters: 40 },
    leviticus: { id: "LEV", chapters: 27 }, lev: { id: "LEV", chapters: 27 },
    numbers: { id: "NUM", chapters: 36 }, num: { id: "NUM", chapters: 36 },
    deuteronomy: { id: "DEU", chapters: 34 }, deut: { id: "DEU", chapters: 34 },
    joshua: { id: "JOS", chapters: 24 }, jos: { id: "JOS", chapters: 24 },
    judges: { id: "JDG", chapters: 21 }, jdg: { id: "JDG", chapters: 21 },
    ruth: { id: "RUT", chapters: 4 }, rut: { id: "RUT", chapters: 4 },
    psalms: { id: "PSA", chapters: 150 }, psalm: { id: "PSA", chapters: 150 }, psa: { id: "PSA", chapters: 150 },
    proverbs: { id: "PRO", chapters: 31 }, prov: { id: "PRO", chapters: 31 }, pro: { id: "PRO", chapters: 31 },
    isaiah: { id: "ISA", chapters: 66 }, isa: { id: "ISA", chapters: 66 },
    jeremiah: { id: "JER", chapters: 52 }, jer: { id: "JER", chapters: 52 },
    ezekiel: { id: "EZK", chapters: 48 }, ezk: { id: "EZK", chapters: 48 },
    daniel: { id: "DAN", chapters: 12 }, dan: { id: "DAN", chapters: 12 },
    matthew: { id: "MAT", chapters: 28 }, mat: { id: "MAT", chapters: 28 },
    mark: { id: "MRK", chapters: 16 }, mrk: { id: "MRK", chapters: 16 },
    luke: { id: "LUK", chapters: 24 }, luk: { id: "LUK", chapters: 24 },
    john: { id: "JHN", chapters: 21 }, jhn: { id: "JHN", chapters: 21 },
    acts: { id: "ACT", chapters: 28 }, act: { id: "ACT", chapters: 28 },
    romans: { id: "ROM", chapters: 16 }, rom: { id: "ROM", chapters: 16 },
    galatians: { id: "GAL", chapters: 6 }, gal: { id: "GAL", chapters: 6 },
    ephesians: { id: "EPH", chapters: 6 }, eph: { id: "EPH", chapters: 6 },
    philippians: { id: "PHP", chapters: 4 }, php: { id: "PHP", chapters: 4 },
    colossians: { id: "COL", chapters: 4 }, col: { id: "COL", chapters: 4 },
    hebrews: { id: "HEB", chapters: 13 }, heb: { id: "HEB", chapters: 13 },
    james: { id: "JAS", chapters: 5 }, jas: { id: "JAS", chapters: 5 },
    revelation: { id: "REV", chapters: 22 }, rev: { id: "REV", chapters: 22 },
  };

  async function search(q = query) {
    if (!q.trim()) return;
    setSearching(true);
    setSearched(false);
    try {
      const res = await fetch(`/api/bible/search?bibleId=${encodeURIComponent(bibleId)}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data ?? []);
    } catch { setResults([]); }
    setSearching(false);
    setSearched(true);
  }

  function handleGoTo(e: React.FormEvent) {
    e.preventDefault();
    const raw = goTo.trim();
    const match = raw.match(/^(.+?)\s+(\d+)(?::(\d+))?$/i);
    if (!match) { setGoToError("Try: John 3:16 or Psalms 23"); return; }
    const [, bookInput, chStr, verseStr] = match;
    const key = bookInput.toLowerCase();
    const found = BIBLE_BOOKS_ABBR[key];
    if (!found) { setGoToError(`Book not recognised: "${bookInput}"`); return; }
    const ch = Math.min(parseInt(chStr), found.chapters);
    const hash = verseStr ? `#v${verseStr}` : "";
    router.push(`/read/${found.id}/${ch}?bibleId=${bibleId}${hash}`);
  }

  function resultHref(r: SearchResult): string {
    if (!r.id) return "#";
    const parts = r.id.split(".");
    if (parts.length >= 2) return `/read/${parts[0]}/${parts[1]}?bibleId=${bibleId}`;
    return "#";
  }

  return (
    <div>
      {/* Translation + search */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <select
          value={bibleId}
          onChange={(e) => setBibleId(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg-card)", color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit", outline: "none", flexShrink: 0 }}
        >
          {versions.map((v) => <option key={v.id} value={v.id}>{v.abbreviation}</option>)}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") search(); }}
          placeholder="Search scripture, topic, or phrase…"
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg-card)", color: "var(--color-ink)", fontSize: 14, fontFamily: "inherit", outline: "none" }}
        />
        <button
          onClick={() => search()}
          disabled={searching}
          style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {searching ? "…" : "Search"}
        </button>
      </div>

      {/* Topic chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {TOPIC_SUGGESTIONS.map((t) => (
          <button key={t} onClick={() => { setQuery(t); search(t); }}
            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 16, border: "1px solid var(--color-rule)", background: "var(--color-bg-card)", color: "var(--color-ink-3)", cursor: "pointer", fontFamily: "inherit" }}>
            {t}
          </button>
        ))}
      </div>

      {/* Go to reference */}
      <form onSubmit={handleGoTo} style={{ display: "flex", gap: 8, marginBottom: 24, padding: "14px 16px", background: "var(--color-bg-deep)", borderRadius: 10, border: "1px solid var(--color-rule)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>Go to reference</div>
          <input
            value={goTo}
            onChange={(e) => { setGoTo(e.target.value); setGoToError(""); }}
            placeholder="e.g. John 3:16  ·  Psalms 23  ·  Romans 8:28"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${goToError ? "var(--color-red)" : "var(--color-rule)"}`, background: "var(--color-bg)", color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
          {goToError && <div style={{ fontSize: 11, color: "var(--color-red)", marginTop: 3 }}>{goToError}</div>}
        </div>
        <button type="submit" style={{ alignSelf: "flex-end", padding: "9px 14px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Go →</button>
      </form>

      {/* Results */}
      {searched && results.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-ink-4)", fontSize: 14 }}>
          No results found for &ldquo;{query}&rdquo;
        </div>
      )}
      {results.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginBottom: 12 }}>{results.length} result{results.length !== 1 ? "s" : ""}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.map((r, i) => (
              <a key={r.id || i} href={resultHref(r)}
                style={{ display: "block", padding: "12px 14px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 10, textDecoration: "none", transition: "box-shadow 0.1s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-accent)", marginBottom: 4 }}>{r.reference}</div>
                <div style={{ fontSize: 14, color: "var(--color-ink)", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: r.text }} />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
