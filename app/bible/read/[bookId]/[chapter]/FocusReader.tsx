"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { SVGProps } from "react";
import { useRouter } from "next/navigation";
import type { BibleChapter } from "@/lib/bible-api";
import { rankVoices, pickBestVoice } from "@/lib/tts-voices";

interface Props {
  book: { id: string; name: string };
  chapterNum: number;
  chapterData: BibleChapter;
  onClose: () => void;
  initialVerseIdx?: number;
  nextReadingHref?: string;
  nextReadingLabel?: string;
}

// ── Inline SF-style glyphs (24×24, currentColor) ─────────────
const strokeSvg = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  width: "1em", height: "1em", "aria-hidden": true, ...p,
});
const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...strokeSvg(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
const RestartIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...strokeSvg(p)}><path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4M4.5 4v4h4" /></svg>
);
const PlayIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" aria-hidden {...p}>
    <path d="M7 5.3v13.4a1 1 0 0 0 1.5.87l11-6.7a1 1 0 0 0 0-1.74l-11-6.7A1 1 0 0 0 7 5.3Z" />
  </svg>
);
const PauseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...strokeSvg(p)} strokeWidth={2}><path d="M8.5 5v14M15.5 5v14" /></svg>
);
const PrevIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" aria-hidden {...p}>
    <path d="M18 5.5v13a.8.8 0 0 1-1.2.66L8 13.3V18a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v4.7l8.8-5.86A.8.8 0 0 1 18 5.5Z" />
  </svg>
);
const NextIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" aria-hidden {...p}>
    <path d="M6 5.5v13a.8.8 0 0 0 1.2.66L16 13.3V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v4.7L7.2 4.84A.8.8 0 0 0 6 5.5Z" />
  </svg>
);
const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...strokeSvg(p)} strokeWidth={2}><path d="M5 12.5l4.5 4.5L19 7" /></svg>
);

export default function FocusReader({ book, chapterNum, chapterData, onClose, initialVerseIdx = 0, nextReadingHref, nextReadingLabel }: Props) {
  const verses = chapterData.verses;

  // ── State ──────────────────────────────────────────────────
  const [currentVerseIdx, setCurrentVerseIdx] = useState(initialVerseIdx);
  const [currentWordIdx, setCurrentWordIdx] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const router = useRouter();

  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speechRate, setSpeechRate] = useState(0.85);

  // Refs that don't trigger re-renders but are always fresh inside callbacks
  const selectedVoiceRef = useRef(selectedVoice);
  const speechRateRef = useRef(speechRate);
  const autoPlayRef = useRef<{ active: boolean; startVerse: number }>({ active: false, startVerse: initialVerseIdx });
  const verseRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => { selectedVoiceRef.current = selectedVoice; }, [selectedVoice]);
  useEffect(() => { speechRateRef.current = speechRate; }, [speechRate]);

  // ── Load voices — prefer platform preference from hub settings ─
  useEffect(() => {
    // Fetch platform TTS preference (stored in hub.preferences)
    let platformVoiceName: string | null = null;
    let platformSpeed: number | null = null;
    fetch("/api/tts-prefs").then(r => r.ok ? r.json() : null).then(data => {
      if (data?.tts_voice) platformVoiceName = data.tts_voice;
      if (data?.tts_speed != null) { const spd: number = data.tts_speed; platformSpeed = spd; setSpeechRate(spd); speechRateRef.current = spd; }
    }).catch(() => {});

    function loadVoices() {
      const all = window.speechSynthesis.getVoices();
      if (all.length === 0) return;
      // Rank best-first: modern Apple neural / premium / enhanced en-US
      // voices win; non-English and legacy "compact" voices sink or drop.
      const ranked = rankVoices(all);
      if (ranked.length === 0) return;

      // Priority: 1) platform preference (set in Bible → Settings), 2) best-ranked voice
      const fromPlatform = platformVoiceName ? ranked.find(v => v.name === platformVoiceName) : null;
      const pref = fromPlatform ?? pickBestVoice(ranked);
      setSelectedVoice(pref);
      selectedVoiceRef.current = pref;
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // ── Auto-scroll to current verse ───────────────────────────
  useEffect(() => {
    verseRefs.current[currentVerseIdx]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentVerseIdx]);

  // ── Core: play one verse, then auto-advance ────────────────
  const playVerse = useCallback((verseIdx: number) => {
    if (verseIdx >= verses.length) {
      // All verses done
      setSpeaking(false);
      setPaused(false);
      setCurrentWordIdx(null);
      setDone(true);
      autoPlayRef.current.active = false;
      return;
    }

    const verse = verses[verseIdx];
    setCurrentVerseIdx(verseIdx);
    setCurrentWordIdx(null);
    setDone(false);

    // Build word offset map for this verse
    const words = verse.text.trim().split(/\s+/);
    const offsets: number[] = [];
    let off = 0;
    words.forEach(w => { offsets.push(off); off += w.length + 1; });

    const utter = new SpeechSynthesisUtterance(verse.text);
    utter.rate = speechRateRef.current;
    utter.pitch = 1;
    if (selectedVoiceRef.current) utter.voice = selectedVoiceRef.current;

    utter.onboundary = (e) => {
      if (e.name !== "word") return;
      // Find the word index by charIndex
      let wi = 0;
      for (let i = offsets.length - 1; i >= 0; i--) {
        if (offsets[i] <= e.charIndex) { wi = i; break; }
      }
      setCurrentWordIdx(wi);
    };

    utter.onstart = () => { setSpeaking(true); };

    utter.onend = () => {
      setCurrentWordIdx(null);
      if (autoPlayRef.current.active) {
        // Pause briefly between verses, then advance
        setTimeout(() => {
          if (autoPlayRef.current.active) {
            playVerse(verseIdx + 1);
          }
        }, 350);
      } else {
        setSpeaking(false);
        setPaused(false);
      }
    };

    utter.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") return;
      setSpeaking(false);
      setPaused(false);
      autoPlayRef.current.active = false;
    };

    window.speechSynthesis.speak(utter);
  }, [verses]);

  // ── Public controls ────────────────────────────────────────
  const startFrom = useCallback((verseIdx: number) => {
    window.speechSynthesis.cancel();
    autoPlayRef.current = { active: true, startVerse: verseIdx };
    setSpeaking(true);
    setPaused(false);
    setDone(false);
    // Small delay so cancel() finishes
    setTimeout(() => playVerse(verseIdx), 80);
  }, [playVerse]);

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

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    autoPlayRef.current.active = false;
    setSpeaking(false);
    setPaused(false);
    setCurrentWordIdx(null);
  }, []);

  const restart = useCallback(() => {
    stop();
    setTimeout(() => startFrom(autoPlayRef.current.startVerse), 120);
  }, [stop, startFrom]);

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { stop(); onClose(); }
      if (e.key === " ") { e.preventDefault(); speaking ? pauseResume() : startFrom(currentVerseIdx); }
      if (e.key === "r" || e.key === "R") { restart(); }
      if (e.key === "ArrowRight") startFrom(Math.min(verses.length - 1, currentVerseIdx + 1));
      if (e.key === "ArrowLeft")  startFrom(Math.max(0, currentVerseIdx - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [speaking, pauseResume, startFrom, currentVerseIdx, stop, onClose, restart, verses.length]);

  useEffect(() => () => { window.speechSynthesis.cancel(); }, []);

  // Auto-navigate to next reading when chapter is done
  useEffect(() => {
    if (!done || !nextReadingHref) return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          router.push(nextReadingHref);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [done, nextReadingHref, router]);

  const pct = ((currentVerseIdx + 1) / verses.length) * 100;

  const roundBtn: React.CSSProperties = {
    background: "var(--ios-fill)", border: "none", color: "var(--ios-label)",
    fontSize: 18, cursor: "pointer", width: 44, height: 44, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "var(--ios-bg)",
      display: "flex", flexDirection: "column",
      color: "var(--ios-label)",
    }}>
      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px", borderBottom: "1px solid var(--ios-separator)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => { stop(); onClose(); }}
            aria-label="Close focus reader"
            style={{ background: "var(--ios-fill)", border: "none", color: "var(--ios-label)", fontSize: 18, cursor: "pointer", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CloseIcon />
          </button>
          <span className="ios-headline" style={{ color: "var(--ios-label)" }}>{book.name} {chapterNum}</span>
          <span className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)" }}>
            {currentVerseIdx + 1} / {verses.length}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="range" min={0.5} max={1.4} step={0.05} value={speechRate}
              onChange={e => setSpeechRate(parseFloat(e.target.value))}
              aria-label="Reading speed"
              style={{ width: 70, accentColor: "var(--ios-tint)" }} />
            <span className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)", minWidth: 32 }}>{speechRate.toFixed(2)}×</span>
          </div>

          <button onClick={restart} title="Restart (R)"
            style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--ios-fill)", border: "none", color: "var(--ios-label)", fontSize: 14, cursor: "pointer", padding: "7px 12px", borderRadius: 999, fontWeight: 500 }}>
            <RestartIcon style={{ fontSize: 15 }} /> Restart
          </button>
        </div>
      </div>

      {/* ── Verse list ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 0 120px" }}>
        {verses.map((verse, vi) => {
          const isActive = vi === currentVerseIdx;
          const isPast   = vi < currentVerseIdx;
          const isFuture = vi > currentVerseIdx;

          // Build per-verse word list for current verse rendering
          const words = isActive ? verse.text.trim().split(/\s+/) : null;

          return (
            <div
              key={verse.id}
              ref={el => { verseRefs.current[vi] = el; }}
              onClick={() => startFrom(vi)}
              style={{
                cursor: "pointer",
                padding: "16px 10vw",
                background: isActive ? "color-mix(in srgb, var(--ios-tint) 10%, transparent)" : "transparent",
                borderLeft: isActive ? "3px solid var(--ios-tint)" : "3px solid transparent",
                transition: "background 200ms",
              }}
            >
              <div className="ios-caption" style={{
                fontWeight: 700,
                color: isActive ? "var(--ios-tint)" : "var(--ios-label-3)",
                textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7,
              }}>
                Verse {verse.number}
              </div>

              <div style={{
                fontSize: isActive ? 26 : isFuture ? 18 : 16,
                lineHeight: isActive ? 1.9 : 1.7,
                color: isActive ? "var(--ios-label)" : isPast ? "var(--ios-label-3)" : "var(--ios-label-2)",
                transition: "font-size 250ms, color 200ms",
              }}>
                {isActive && words ? (
                  // Current verse: word-by-word highlighting
                  words.map((word, wi) => (
                    <span key={wi} style={{
                      display: "inline",
                      background: currentWordIdx === wi ? "var(--ios-tint)" : "transparent",
                      color: currentWordIdx === wi ? "var(--ios-on-tint)" : undefined,
                      borderRadius: currentWordIdx === wi ? 4 : 0,
                      padding: currentWordIdx === wi ? "0 3px" : undefined,
                      transition: "background 60ms",
                      marginRight: "0.28em",
                    }}>
                      {word}
                    </span>
                  ))
                ) : (
                  verse.text
                )}
              </div>
            </div>
          );
        })}

        {/* Done state */}
        {done && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", margin: "0 auto 14px",
              background: "color-mix(in srgb, var(--ios-tint) 16%, transparent)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ios-tint)",
            }}>
              <CheckIcon style={{ fontSize: 32 }} />
            </div>
            <div className="ios-title-3" style={{ color: "var(--ios-label)", marginBottom: 4 }}>
              {book.name} {chapterNum} complete
            </div>

            {nextReadingHref && nextReadingLabel ? (
              <div style={{ marginTop: 20 }}>
                <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Up next
                </div>
                <div className="ios-title-3" style={{ color: "var(--ios-tint)", marginBottom: 20 }}>
                  {nextReadingLabel}
                </div>

                {/* Countdown ring */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
                  <button
                    onClick={() => { setCountdown(null); setDone(false); router.push(nextReadingHref); }}
                    style={{
                      padding: "12px 28px", borderRadius: 12, border: "none",
                      background: "var(--ios-tint)",
                      color: "var(--ios-on-tint)", fontSize: 16, fontWeight: 600,
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    Continue
                    {countdown !== null && (
                      <span className="ios-num" style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: "color-mix(in srgb, var(--ios-on-tint) 25%, transparent)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700,
                      }}>
                        {countdown}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setCountdown(null)}
                    style={{
                      padding: "12px 20px", borderRadius: 12,
                      border: "none", background: "var(--ios-fill)",
                      color: "var(--ios-label)", fontSize: 15, fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    Pause
                  </button>
                </div>

                {countdown === null && (
                  <div style={{ marginTop: 14 }}>
                    <button
                      onClick={() => router.push(nextReadingHref)}
                      className="ios-footnote"
                      style={{ background: "none", border: "none", color: "var(--ios-tint)", cursor: "pointer", fontWeight: 500 }}
                    >
                      Go to {nextReadingLabel} →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 20 }}>
                <button onClick={() => startFrom(0)}
                  style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "var(--ios-tint)", color: "var(--ios-on-tint)", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                  Read again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--ios-bg-elevated)", backdropFilter: "blur(16px)",
        borderTop: "1px solid var(--ios-separator)",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "14px 24px 18px", gap: 12, flexShrink: 0,
      }}>
        {/* Progress */}
        <div style={{ width: "100%", maxWidth: 560, height: 4, background: "var(--ios-fill)", borderRadius: 2 }}>
          <div style={{
            height: "100%", borderRadius: 2,
            background: "var(--ios-tint)",
            width: `${pct}%`, transition: "width 400ms",
          }} />
        </div>

        {/* Playback controls */}
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <button onClick={() => startFrom(Math.max(0, currentVerseIdx - 1))}
            title="Previous verse (←)" aria-label="Previous verse"
            style={roundBtn}>
            <PrevIcon />
          </button>

          {!speaking ? (
            <button onClick={() => startFrom(currentVerseIdx)}
              title="Play (Space)" aria-label="Play"
              style={{
                width: 64, height: 64, borderRadius: "50%", border: "none",
                background: "var(--ios-tint)",
                color: "var(--ios-on-tint)", fontSize: 26, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              <PlayIcon />
            </button>
          ) : (
            <button onClick={pauseResume}
              title="Pause/Resume (Space)" aria-label={paused ? "Resume" : "Pause"}
              style={{
                width: 64, height: 64, borderRadius: "50%", border: "none",
                background: paused ? "var(--ios-tint)" : "var(--ios-fill)",
                color: paused ? "var(--ios-on-tint)" : "var(--ios-label)", fontSize: 24, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              {paused ? <PlayIcon /> : <PauseIcon />}
            </button>
          )}

          <button onClick={() => startFrom(Math.min(verses.length - 1, currentVerseIdx + 1))}
            title="Next verse (→)" aria-label="Next verse"
            style={roundBtn}>
            <NextIcon />
          </button>
        </div>

        <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>
          Space · R = restart · ← → = prev/next verse · Esc = close · Click any verse to jump
        </div>
      </div>
    </div>
  );
}
