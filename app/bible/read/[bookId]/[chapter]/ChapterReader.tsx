"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { SVGProps } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { BibleChapter, BibleVerse, BibleVersion } from "@/lib/bible-api";
import { rankVoices, pickBestVoice } from "@/lib/tts-voices";
import { Icons } from "@/components/ios";
import FocusReader from "./FocusReader";

interface Props {
  book: { id: string; name: string; chapters: number; testament: "OT" | "NT" };
  chapterNum: number;
  chapterData: BibleChapter | null;
  version: BibleVersion;
  allVersions: BibleVersion[];
  prevChapter: number | null;
  nextChapter: number | null;
  userId: string;
  initialHighlights: any[];
  initialBookmarks: any[];
  initialNotes: any[];
  bibleId: string;
  autoFocus?: boolean;
  nextReadingHref?: string | null;
  nextReadingLabel?: string | null;
}

const HIGHLIGHT_COLORS = [
  { key: "yellow", label: "Gold",  bg: "rgba(184,138,46,0.22)",  dot: "#B88A2E" },
  { key: "blue",   label: "Blue",  bg: "rgba(59,92,127,0.18)",   dot: "#3B5C7F" },
  { key: "green",  label: "Green", bg: "rgba(74,107,58,0.18)",   dot: "#4A6B3A" },
  { key: "pink",   label: "Rose",  bg: "rgba(154,59,90,0.18)",   dot: "#9A3B5A" },
];

// ── Inline SF-style glyphs (24×24, currentColor) ─────────────
const strokeSvg = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  width: "1em", height: "1em", "aria-hidden": true, ...p,
});
const PlayIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" aria-hidden {...p}>
    <path d="M7 5.3v13.4a1 1 0 0 0 1.5.87l11-6.7a1 1 0 0 0 0-1.74l-11-6.7A1 1 0 0 0 7 5.3Z" />
  </svg>
);
const PauseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...strokeSvg(p)}><path d="M8.5 5v14M15.5 5v14" /></svg>
);
const StopIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" aria-hidden {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
  </svg>
);
const BookmarkIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...strokeSvg(p)}><path d="M6.5 4h11a1 1 0 0 1 1 1v15l-6.5-4-6.5 4V5a1 1 0 0 1 1-1Z" /></svg>
);

export default function ChapterReader({
  book, chapterNum, chapterData, version, allVersions,
  prevChapter, nextChapter, userId, initialHighlights, initialBookmarks, initialNotes, bibleId,
  autoFocus = false, nextReadingHref, nextReadingLabel,
}: Props) {
  const router = useRouter();
  const db = createClient() as any;

  // ── Core state ────────────────────────────────────────────
  const [highlights, setHighlights] = useState<Record<string, string>>(
    Object.fromEntries(initialHighlights.map((h) => [h.verse_id, h.color]))
  );
  const [bookmarked, setBookmarked] = useState(initialBookmarks.length > 0);
  const [notes, setNotes] = useState<Record<number, string>>(
    Object.fromEntries(initialNotes.map((n) => [n.verse_start ?? 0, n.content]))
  );
  const [selectedVerse, setSelectedVerse] = useState<BibleVerse | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // ── TTS state ─────────────────────────────────────────────
  const [speaking, setSpeaking] = useState(false);
  const [focusMode, setFocusMode] = useState(autoFocus && !!chapterData);
  const [paused, setPaused] = useState(false);
  const [readingVerseIdx, setReadingVerseIdx] = useState<number | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speechRate, setSpeechRate] = useState(0.88);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load available English voices and honor the voice/speed saved in
  // Bible → Settings (the single source of truth), falling back to the
  // best-ranked voice when none is saved.
  useEffect(() => {
    let savedVoiceName: string | null = null;
    fetch("/api/tts-prefs").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.tts_voice) savedVoiceName = d.tts_voice;
      if (typeof d?.tts_speed === "number") setSpeechRate(d.tts_speed);
    }).catch(() => {});
    function loadVoices() {
      const all = window.speechSynthesis.getVoices();
      if (all.length === 0) return;
      const ranked = rankVoices(all);
      if (ranked.length > 0) {
        const fromSaved = savedVoiceName ? ranked.find((v) => v.name === savedVoiceName) : null;
        setSelectedVoice((prev) => prev ?? fromSaved ?? pickBestVoice(ranked));
      }
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // ── TTS ── speak from a specific verse index ──────────────
  const speakFrom = useCallback((startIdx: number) => {
    if (!chapterData) return;
    window.speechSynthesis.cancel();
    setPaused(false);

    const verses = chapterData.verses.slice(startIdx);

    // Build full text + per-verse character offsets for onboundary tracking
    let fullText = "";
    const offsets: number[] = []; // offsets[i] = char index where verse startIdx+i begins
    verses.forEach((v) => {
      offsets.push(fullText.length);
      fullText += v.text + "  "; // double-space between verses
    });

    const utter = new SpeechSynthesisUtterance(fullText);
    utter.rate = speechRate;
    utter.pitch = 1;
    if (selectedVoice) utter.voice = selectedVoice;

    utter.onstart = () => {
      setSpeaking(true);
      setReadingVerseIdx(startIdx);
    };

    utter.onboundary = (e) => {
      if (e.name !== "word") return;
      const charIdx = e.charIndex;
      // Find which verse is being read
      let currentVerse = startIdx;
      for (let i = 0; i < offsets.length; i++) {
        if (charIdx >= offsets[i]) currentVerse = startIdx + i;
        else break;
      }
      setReadingVerseIdx(currentVerse);
    };

    utter.onend = () => {
      setSpeaking(false);
      setPaused(false);
      setReadingVerseIdx(null);
    };
    utter.onerror = () => {
      setSpeaking(false);
      setPaused(false);
      setReadingVerseIdx(null);
    };

    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [chapterData, selectedVoice, speechRate]);

  const pauseResume = useCallback(() => {
    if (!speaking) return;
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }, [speaking, paused]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
    setReadingVerseIdx(null);
  }, []);

  // ── Highlight ─────────────────────────────────────────────
  const toggleHighlight = async (verse: BibleVerse, color: string) => {
    const vId = verse.id;
    const existing = highlights[vId];
    if (existing === color) {
      const next = { ...highlights };
      delete next[vId];
      setHighlights(next);
      await db.schema("bible").from("highlights").delete()
        .eq("user_id", userId).eq("bible_id", bibleId).eq("verse_id", vId);
    } else {
      setHighlights({ ...highlights, [vId]: color });
      await db.schema("bible").from("highlights").upsert({
        user_id: userId, bible_id: bibleId,
        reference: verse.reference, verse_id: vId, color,
      }, { onConflict: "user_id,bible_id,verse_id" });
    }
    setSelectedVerse(null);
  };

  // ── Bookmark ──────────────────────────────────────────────
  const toggleBookmark = async () => {
    if (bookmarked) {
      setBookmarked(false);
      await db.schema("bible").from("bookmarks").delete()
        .eq("user_id", userId).eq("bible_id", bibleId)
        .eq("book_id", book.id).eq("chapter_num", chapterNum);
    } else {
      setBookmarked(true);
      await db.schema("bible").from("bookmarks").upsert({
        user_id: userId, bible_id: bibleId,
        reference: `${book.name} ${chapterNum}`,
        book_id: book.id, chapter_num: chapterNum,
      }, { onConflict: "user_id,bible_id,reference" });
    }
  };

  // ── Save note ─────────────────────────────────────────────
  const saveNote = async () => {
    if (!selectedVerse || !noteText.trim()) return;
    setSavingNote(true);
    await db.schema("bible").from("notes").insert({
      user_id: userId, bible_id: bibleId,
      book_id: book.id, chapter_num: chapterNum,
      verse_start: selectedVerse.number, verse_end: selectedVerse.number,
      reference: selectedVerse.reference,
      content: noteText.trim(),
    });
    setNotes({ ...notes, [selectedVerse.number]: noteText.trim() });
    setNoteText("");
    setSavingNote(false);
    setSelectedVerse(null);
  };

  // ── Shared chrome styles ──────────────────────────────────
  const iconBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 38, height: 38, borderRadius: 10, fontSize: 18,
    background: "var(--ios-fill)", border: "none", color: "var(--ios-label)",
    cursor: "pointer", flexShrink: 0,
  };
  const pillBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6,
    padding: "0 14px", height: 38, borderRadius: 999, border: "none",
    background: "var(--ios-tint)", color: "var(--ios-on-tint)",
    fontSize: 15, fontWeight: 600, cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: "var(--reader-width)", margin: "0 auto", padding: "24px 16px 120px" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div className="ios-caption" style={{
          color: "var(--ios-label-2)", fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
        }}>
          {book.testament === "OT" ? "Old Testament" : "New Testament"}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <h1 className="ios-large-title" style={{ margin: 0, color: "var(--ios-label)" }}>
            {book.name} {chapterNum}
          </h1>

          {/* Controls */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Version */}
            <select
              value={bibleId}
              onChange={(e) => router.push(`/bible/read/${book.id}/${chapterNum}?v=${e.target.value}`)}
              aria-label="Bible version"
              style={{
                height: 38, padding: "0 12px", borderRadius: 10, border: "none",
                background: "var(--ios-fill)", fontSize: 15, fontWeight: 600, fontFamily: "inherit",
                color: "var(--ios-label)", cursor: "pointer",
              }}
            >
              {allVersions.map((v) => (
                <option key={v.id} value={v.id}>{v.abbreviation}</option>
              ))}
            </select>

            {/* Bookmark */}
            <button onClick={toggleBookmark}
              title={bookmarked ? "Remove bookmark" : "Bookmark"}
              aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
              style={{
                ...iconBtn,
                background: bookmarked ? "var(--ios-tint)" : "var(--ios-fill)",
                color: bookmarked ? "var(--ios-on-tint)" : "var(--ios-label)",
              }}>
              <BookmarkIcon />
            </button>

            {/* Focus Mode */}
            {chapterData && (
              <button
                onClick={() => setFocusMode(true)}
                title="Focus mode: word-by-word with audio"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  height: 38, padding: "0 14px", borderRadius: 999,
                  border: "none", background: "var(--ios-fill)",
                  color: "var(--ios-label)", fontSize: 15, fontWeight: 600, cursor: "pointer",
                }}
              >
                <Icons.SparkleIcon style={{ fontSize: 16, color: "var(--ios-tint)" }} /> Focus
              </button>
            )}

            {/* Read aloud from start */}
            {!speaking ? (
              <button onClick={() => speakFrom(0)} style={pillBtn}>
                <PlayIcon style={{ fontSize: 14 }} /> Read aloud
              </button>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={pauseResume} style={pillBtn}>
                  {paused ? <><PlayIcon style={{ fontSize: 14 }} /> Resume</> : <><PauseIcon style={{ fontSize: 16 }} /> Pause</>}
                </button>
                <button onClick={stopSpeaking} title="Stop"
                  aria-label="Stop reading"
                  style={{ ...iconBtn, color: "var(--ios-red)" }}>
                  <StopIcon />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TTS Settings Bar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        padding: "10px 14px", borderRadius: 12,
        background: "var(--ios-fill)",
        marginBottom: 22,
      }}>
        {/* Speed */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="ios-footnote" style={{ color: "var(--ios-label-2)", fontWeight: 600 }}>Speed</span>
          <input
            type="range" min={0.5} max={1.4} step={0.05}
            value={speechRate}
            onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
            aria-label="Reading speed"
            style={{ width: 90, accentColor: "var(--ios-tint)" }}
          />
          <span className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)", minWidth: 34 }}>{speechRate.toFixed(2)}×</span>
        </div>

        {/* Reading indicator */}
        {speaking && readingVerseIdx !== null && chapterData && (
          <div className="ios-footnote" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ios-tint)", fontWeight: 600 }}>
            <Icons.SparkleIcon style={{ fontSize: 15, animation: "pulse 1s infinite" }} />
            v.{chapterData.verses[readingVerseIdx]?.number}
          </div>
        )}
      </div>

      {/* ── Chapter navigation ── */}
      <div className="ios-footnote" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        {prevChapter
          ? <Link href={`/bible/read/${book.id}/${prevChapter}?v=${bibleId}`} style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--ios-tint)", textDecoration: "none", fontWeight: 500 }}><Icons.ChevronLeft style={{ fontSize: 14 }} />Ch. {prevChapter}</Link>
          : <span />}
        <Link href="/bible/read" style={{ color: "var(--ios-label-2)", textDecoration: "none" }}>All books</Link>
        {nextChapter
          ? <Link href={`/bible/read/${book.id}/${nextChapter}?v=${bibleId}`} style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--ios-tint)", textDecoration: "none", fontWeight: 500 }}>Ch. {nextChapter}<Icons.ChevronRight style={{ fontSize: 14 }} /></Link>
          : <span />}
      </div>

      {/* ── Error state ── */}
      {!chapterData && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--ios-label-2)" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", margin: "0 auto 14px",
            background: "var(--ios-fill)", display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--ios-orange)",
          }}>
            <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3.5 22 20H2L12 3.5Z" /><path d="M12 10v4M12 17h.01" />
            </svg>
          </div>
          <div className="ios-headline" style={{ color: "var(--ios-label)" }}>Unable to load this chapter</div>
          <div className="ios-footnote" style={{ marginTop: 4 }}>Set BIBLE_API_KEY for all versions, or choose KJV / ASV / WEB.</div>
        </div>
      )}

      {/* ── Verse text — one verse per row ── */}
      {chapterData && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {chapterData.verses.map((verse, idx) => {
            const hlColor  = highlights[verse.id];
            const hlDef    = HIGHLIGHT_COLORS.find((c) => c.key === hlColor);
            const hasNote  = notes[verse.number];
            const isReading = readingVerseIdx === idx;
            const isSelected = selectedVerse?.id === verse.id;

            return (
              <div
                key={verse.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: isReading
                    ? "color-mix(in srgb, var(--ios-tint) 12%, transparent)"
                    : isSelected
                    ? "var(--ios-fill)"
                    : hlDef
                    ? hlDef.bg
                    : "transparent",
                  border: isSelected
                    ? "1px solid var(--ios-tint)"
                    : "1px solid transparent",
                  cursor: "pointer",
                  transition: "background 120ms",
                }}
                onClick={() => setSelectedVerse(isSelected ? null : verse)}
              >
                {/* Left: verse number + play button */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 4, flexShrink: 0, paddingTop: 2,
                }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); speakFrom(idx); }}
                    title={`Read from verse ${verse.number}`}
                    aria-label={`Read from verse ${verse.number}`}
                    style={{
                      background: isReading ? "var(--ios-tint)" : "transparent",
                      border: "none", cursor: "pointer", padding: "3px 5px",
                      borderRadius: 6, fontSize: 9,
                      color: isReading ? "var(--ios-on-tint)" : "var(--ios-label-3)",
                      opacity: isReading ? 1 : 0.6,
                      transition: "opacity 120ms",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = isReading ? "1" : "0.6"; }}
                  >
                    <PlayIcon />
                  </button>
                  <span className="ios-num" style={{
                    fontSize: 11, fontWeight: 700,
                    color: isReading ? "var(--ios-tint)" : "var(--ios-label-3)",
                    minWidth: 20, textAlign: "center",
                  }}>
                    {verse.number}
                  </span>
                </div>

                {/* Right: verse text */}
                <div style={{
                  fontSize: 18,
                  lineHeight: 1.75,
                  color: "var(--ios-label)",
                  flex: 1,
                }}>
                  {verse.text}
                  {hasNote && (
                    <span
                      title="You have a note here"
                      style={{ display: "inline-flex", verticalAlign: "middle", fontSize: 13, color: "var(--ios-tint)", marginLeft: 6, cursor: "pointer" }}
                      onClick={(e) => { e.stopPropagation(); setSelectedVerse(verse); }}
                    ><Icons.ComposeIcon /></span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bottom chapter nav ── */}
      {chapterData && (
        <div className="ios-footnote" style={{ display: "flex", justifyContent: "space-between", marginTop: 44, paddingTop: 20, borderTop: "1px solid var(--ios-separator)" }}>
          {prevChapter
            ? <Link href={`/bible/read/${book.id}/${prevChapter}?v=${bibleId}`} style={{
                display: "flex", alignItems: "center", gap: 4,
                color: "var(--ios-tint)", textDecoration: "none", fontWeight: 500,
              }}><Icons.ChevronLeft style={{ fontSize: 15 }} />{book.name} {prevChapter}</Link>
            : <span />}
          {nextChapter
            ? <Link href={`/bible/read/${book.id}/${nextChapter}?v=${bibleId}`} style={{
                display: "flex", alignItems: "center", gap: 4,
                color: "var(--ios-tint)", textDecoration: "none", fontWeight: 500,
              }}>{book.name} {nextChapter}<Icons.ChevronRight style={{ fontSize: 15 }} /></Link>
            : <span />}
        </div>
      )}

      {/* ── Verse action sheet ── */}
      {selectedVerse && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setSelectedVerse(null)} aria-hidden="true" />
          <div className="ios-sheet" role="dialog" aria-modal="true" aria-label={`Verse ${selectedVerse.reference}`}>
            <div className="ios-grabber" />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ width: 60 }} />
              <span className="ios-headline">{selectedVerse.reference}</span>
              <button className="ios-btn--plain" style={{ width: 60, textAlign: "right" }} onClick={() => setSelectedVerse(null)}>Done</button>
            </div>

            {/* Verse preview */}
            <div style={{
              fontSize: 16, color: "var(--ios-label-2)", margin: "4px 0 14px",
              lineHeight: 1.6,
              borderLeft: "3px solid var(--ios-tint)", paddingLeft: 12,
            }}>
              {selectedVerse.text}
            </div>

            {/* Read from here */}
            <button
              onClick={() => {
                const idx = chapterData?.verses.findIndex((v) => v.id === selectedVerse.id) ?? 0;
                speakFrom(idx);
                setSelectedVerse(null);
              }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "12px", borderRadius: 12, border: "none",
                background: "var(--ios-fill)", color: "var(--ios-tint)",
                fontSize: 16, fontWeight: 600, cursor: "pointer", marginBottom: 18,
              }}
            >
              <PlayIcon style={{ fontSize: 14 }} /> Read from here
            </button>

            {/* Highlight colors */}
            <div className="ios-group-header" style={{ padding: "0 0 8px" }}>Highlight</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => toggleHighlight(selectedVerse, c.key)}
                  title={c.label}
                  aria-label={c.label}
                  style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: c.bg,
                    border: highlights[selectedVerse.id] === c.key
                      ? `2px solid ${c.dot}` : "2px solid transparent",
                    cursor: "pointer", position: "relative",
                  }}
                >
                  {highlights[selectedVerse.id] === c.key && (
                    <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: c.dot }}>
                      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4 4L19 7" /></svg>
                    </span>
                  )}
                </button>
              ))}
              {highlights[selectedVerse.id] && (
                <button
                  onClick={() => toggleHighlight(selectedVerse, highlights[selectedVerse.id])}
                  className="ios-footnote"
                  style={{ color: "var(--ios-label-2)", background: "none", border: "none", cursor: "pointer", marginLeft: "auto" }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Note */}
            <div className="ios-group-header" style={{ padding: "0 0 8px" }}>Note</div>
            <textarea
              placeholder={notes[selectedVerse.number] ? "Edit note…" : "Add a note…"}
              defaultValue={notes[selectedVerse.number] ?? ""}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              style={{
                width: "100%", padding: "12px 14px",
                border: "none", borderRadius: 12,
                fontSize: 16, fontFamily: "inherit", resize: "none",
                boxSizing: "border-box", background: "var(--ios-fill)",
                color: "var(--ios-label)", lineHeight: 1.5, marginBottom: 12,
              }}
            />

            {noteText.trim() && (
              <button onClick={saveNote} disabled={savingNote} className="ios-btn ios-btn--primary">
                {savingNote ? "Saving…" : "Save note"}
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Focus Reader overlay ── */}
      {focusMode && chapterData && (
        <FocusReader
          book={book}
          chapterNum={chapterNum}
          chapterData={chapterData}
          onClose={() => setFocusMode(false)}
          initialVerseIdx={readingVerseIdx ?? 0}
          nextReadingHref={nextReadingHref ?? undefined}
          nextReadingLabel={nextReadingLabel ?? undefined}
        />
      )}
    </div>
  );
}
