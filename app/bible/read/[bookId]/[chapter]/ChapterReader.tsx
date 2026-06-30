"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { BibleChapter, BibleVerse, BibleVersion } from "@/lib/bible-api";
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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speechRate, setSpeechRate] = useState(0.88);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load available English voices
  useEffect(() => {
    function loadVoices() {
      const all = window.speechSynthesis.getVoices();
      const english = all.filter(
        (v) => v.lang.startsWith("en") && !v.name.includes("(compact)")
      );
      if (english.length > 0) {
        setVoices(english);
        // Default: prefer a natural-sounding US voice
        const preferred = english.find(
          (v) =>
            v.name.includes("Google US English") ||
            v.name.includes("Samantha") ||
            v.name.includes("Alex") ||
            v.name === "Karen" ||
            v.name === "Daniel"
        );
        setSelectedVoice(preferred ?? english[0]);
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

  // ── Voice name shortener ──────────────────────────────────
  const shortVoiceName = (v: SpeechSynthesisVoice) =>
    v.name.replace(/\(.*?\)/g, "").replace("Google", "").trim();

  return (
    <div style={{ maxWidth: "var(--reader-width)", margin: "0 auto", padding: "24px 20px 120px" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 10, color: "var(--color-ink-4)", fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6,
        }}>
          {book.testament === "OT" ? "Old Testament" : "New Testament"}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 400,
            margin: 0, letterSpacing: "-0.01em", lineHeight: 1,
          }}>
            {book.name} {chapterNum}
          </h1>

          {/* Controls */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Version */}
            <select
              value={bibleId}
              onChange={(e) => router.push(`/read/${book.id}/${chapterNum}?v=${e.target.value}`)}
              style={{
                padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-rule)",
                background: "var(--color-bg-card)", fontSize: 12, fontFamily: "inherit",
                color: "var(--color-ink)", cursor: "pointer",
              }}
            >
              {allVersions.map((v) => (
                <option key={v.id} value={v.id}>{v.abbreviation}</option>
              ))}
            </select>

            {/* Bookmark */}
            <button onClick={toggleBookmark}
              title={bookmarked ? "Remove bookmark" : "Bookmark"}
              style={{
                background: bookmarked ? "var(--color-accent-soft)" : "var(--color-bg-card)",
                border: "1px solid var(--color-rule)", borderRadius: 8,
                padding: "6px 10px", cursor: "pointer", fontSize: 14,
              }}>
              {bookmarked ? "🔖" : "🗂"}
            </button>

            {/* Focus Mode */}
            {chapterData && (
              <button
                onClick={() => setFocusMode(true)}
                title="Focus mode: word-by-word with audio"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8,
                  border: "1px solid var(--color-rule)",
                  background: "var(--color-bg-card)",
                  color: "var(--color-ink-2)", fontSize: 12, fontWeight: 500, cursor: "pointer",
                }}
              >
                ◈ Focus
              </button>
            )}

          {/* Read aloud from start */}
            {!speaking ? (
              <button onClick={() => speakFrom(0)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8, border: "none",
                  background: "var(--color-accent)", color: "#fff",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                ▶ Read aloud
              </button>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={pauseResume}
                  style={{
                    padding: "7px 14px", borderRadius: 8, border: "none",
                    background: "var(--color-accent)", color: "#fff",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                  {paused ? "▶ Resume" : "⏸ Pause"}
                </button>
                <button onClick={stopSpeaking}
                  style={{
                    padding: "7px 12px", borderRadius: 8,
                    border: "1px solid var(--color-rule)",
                    background: "var(--color-bg-card)", color: "var(--color-ink-2)",
                    fontSize: 12, cursor: "pointer",
                  }}>
                  ⏹
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TTS Settings Bar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        padding: "10px 14px", borderRadius: 10,
        background: "var(--color-bg-deep)",
        border: "1px solid var(--color-rule)",
        marginBottom: 24, fontSize: 12,
      }}>
        {/* Voice picker */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--color-ink-3)", fontWeight: 600 }}>Voice</span>
          <select
            value={selectedVoice?.name ?? ""}
            onChange={(e) => setSelectedVoice(voices.find((v) => v.name === e.target.value) ?? null)}
            style={{
              padding: "4px 8px", borderRadius: 6, border: "1px solid var(--color-rule)",
              background: "var(--color-bg-card)", fontSize: 11, fontFamily: "inherit",
              color: "var(--color-ink)", cursor: "pointer", maxWidth: 180,
            }}
          >
            {voices.map((v) => (
              <option key={v.name} value={v.name}>{shortVoiceName(v)} ({v.lang})</option>
            ))}
          </select>
        </div>

        {/* Speed */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--color-ink-3)", fontWeight: 600 }}>Speed</span>
          <input
            type="range" min={0.5} max={1.4} step={0.05}
            value={speechRate}
            onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
            style={{ width: 80, accentColor: "var(--color-accent)" }}
          />
          <span style={{ color: "var(--color-ink-3)", minWidth: 28 }}>{speechRate.toFixed(2)}×</span>
        </div>

        {/* Reading indicator */}
        {speaking && readingVerseIdx !== null && chapterData && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-accent)", fontWeight: 600 }}>
            <span style={{ animation: "pulse 1s infinite", display: "inline-block" }}>♪</span>
            v.{chapterData.verses[readingVerseIdx]?.number}
          </div>
        )}
      </div>

      {/* ── Chapter navigation ── */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, fontSize: 13 }}>
        {prevChapter
          ? <Link href={`/read/${book.id}/${prevChapter}?v=${bibleId}`} style={{ color: "var(--color-accent)", textDecoration: "none" }}>← Ch. {prevChapter}</Link>
          : <span />}
        <Link href="/bible/read" style={{ color: "var(--color-ink-3)", textDecoration: "none" }}>All books</Link>
        {nextChapter
          ? <Link href={`/read/${book.id}/${nextChapter}?v=${bibleId}`} style={{ color: "var(--color-accent)", textDecoration: "none" }}>Ch. {nextChapter} →</Link>
          : <span />}
      </div>

      {/* ── Error state ── */}
      {!chapterData && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-ink-3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 600 }}>Unable to load this chapter</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Set BIBLE_API_KEY for all versions, or choose KJV / ASV / WEB.</div>
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
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: isReading
                    ? "rgba(107,59,124,0.08)"
                    : isSelected
                    ? "var(--color-accent-soft)"
                    : hlDef
                    ? hlDef.bg
                    : "transparent",
                  border: isSelected
                    ? "1px solid var(--color-accent)"
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
                    style={{
                      background: isReading ? "var(--color-accent)" : "transparent",
                      border: "none", cursor: "pointer", padding: "2px 4px",
                      borderRadius: 4, fontSize: 10,
                      color: isReading ? "#fff" : "var(--color-ink-4)",
                      opacity: isReading ? 1 : 0.5,
                      transition: "opacity 120ms",
                      lineHeight: 1,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = isReading ? "1" : "0.5"; }}
                  >
                    ▶
                  </button>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: isReading ? "var(--color-accent)" : "var(--color-ink-4)",
                    fontFamily: "var(--font-sans)",
                    minWidth: 20, textAlign: "center",
                    letterSpacing: "0.02em",
                  }}>
                    {verse.number}
                  </span>
                </div>

                {/* Right: verse text */}
                <div style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 18,
                  lineHeight: 1.75,
                  color: "var(--color-ink)",
                  flex: 1,
                  letterSpacing: "0.01em",
                }}>
                  {verse.text}
                  {hasNote && (
                    <span
                      title="You have a note here"
                      style={{ fontSize: 10, color: "var(--color-accent)", marginLeft: 6, cursor: "pointer" }}
                      onClick={(e) => { e.stopPropagation(); setSelectedVerse(verse); }}
                    >✎</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bottom chapter nav ── */}
      {chapterData && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 48, paddingTop: 20, borderTop: "1px solid var(--color-rule)", fontSize: 13 }}>
          {prevChapter
            ? <Link href={`/read/${book.id}/${prevChapter}?v=${bibleId}`} style={{
                display: "flex", alignItems: "center", gap: 6,
                color: "var(--color-accent)", textDecoration: "none", fontWeight: 500,
              }}>← {book.name} {prevChapter}</Link>
            : <span />}
          {nextChapter
            ? <Link href={`/read/${book.id}/${nextChapter}?v=${bibleId}`} style={{
                display: "flex", alignItems: "center", gap: 6,
                color: "var(--color-accent)", textDecoration: "none", fontWeight: 500,
              }}>{book.name} {nextChapter} →</Link>
            : <span />}
        </div>
      )}

      {/* ── Verse action panel (fixed bottom) ── */}
      {selectedVerse && (
        <div style={{
          position: "fixed", bottom: 72, left: 0, right: 0, zIndex: 60,
          display: "flex", justifyContent: "center", padding: "0 16px",
          pointerEvents: "none",
        }}>
          <div style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 18,
            padding: "18px 22px",
            boxShadow: "var(--shadow-float)",
            width: "100%", maxWidth: 680,
            pointerEvents: "all",
          }}>
            {/* Reference + play this verse */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--color-accent)", fontWeight: 700, letterSpacing: "0.05em" }}>
                {selectedVerse.reference}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    const idx = chapterData?.verses.findIndex((v) => v.id === selectedVerse.id) ?? 0;
                    speakFrom(idx);
                    setSelectedVerse(null);
                  }}
                  style={{
                    padding: "4px 10px", borderRadius: 6, border: "1px solid var(--color-rule)",
                    background: "var(--color-bg-deep)", fontSize: 11, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  ▶ Read from here
                </button>
                <button
                  onClick={() => setSelectedVerse(null)}
                  style={{
                    padding: "4px 10px", borderRadius: 6, border: "1px solid var(--color-rule)",
                    background: "transparent", fontSize: 11, cursor: "pointer", color: "var(--color-ink-3)",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Verse text */}
            <div style={{
              fontSize: 15, color: "var(--color-ink-2)", marginBottom: 14,
              fontFamily: "var(--font-display)", lineHeight: 1.65,
              borderLeft: "3px solid var(--color-accent-soft)", paddingLeft: 12,
            }}>
              {selectedVerse.text}
            </div>

            {/* Highlight colors */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: "var(--color-ink-3)", fontWeight: 600 }}>Highlight</span>
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => toggleHighlight(selectedVerse, c.key)}
                  title={c.label}
                  style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: c.bg,
                    border: highlights[selectedVerse.id] === c.key
                      ? `2px solid ${c.dot}` : "2px solid transparent",
                    cursor: "pointer", position: "relative",
                  }}
                >
                  {highlights[selectedVerse.id] === c.key && (
                    <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✓</span>
                  )}
                </button>
              ))}
              {highlights[selectedVerse.id] && (
                <button
                  onClick={() => toggleHighlight(selectedVerse, highlights[selectedVerse.id])}
                  style={{ fontSize: 10, color: "var(--color-ink-4)", background: "none", border: "none", cursor: "pointer" }}
                >
                  clear
                </button>
              )}
            </div>

            {/* Note */}
            <textarea
              placeholder={notes[selectedVerse.number] ? "Edit note…" : "Add a note…"}
              defaultValue={notes[selectedVerse.number] ?? ""}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              style={{
                width: "100%", padding: "8px 12px",
                border: "1px solid var(--color-rule)", borderRadius: 8,
                fontSize: 13, fontFamily: "inherit", resize: "none",
                boxSizing: "border-box", background: "var(--color-bg)",
                marginBottom: 10,
              }}
            />

            {noteText.trim() && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={saveNote} disabled={savingNote} style={{
                  padding: "6px 16px", borderRadius: 8, border: "none",
                  background: "var(--color-accent)", color: "#fff",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                  {savingNote ? "Saving…" : "Save note"}
                </button>
              </div>
            )}
          </div>
        </div>
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
