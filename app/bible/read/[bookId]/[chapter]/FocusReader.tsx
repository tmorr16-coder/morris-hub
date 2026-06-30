"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { BibleChapter } from "@/lib/bible-api";

const VOICE_STORAGE_KEY = "bible-focus-voice";

interface Props {
  book: { id: string; name: string };
  chapterNum: number;
  chapterData: BibleChapter;
  onClose: () => void;
  initialVerseIdx?: number;
  nextReadingHref?: string;
  nextReadingLabel?: string;
}

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

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
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
      const eng = all.filter(v => v.lang.startsWith("en") && !v.name.includes("compact"));
      if (eng.length === 0) return;
      setVoices(eng);

      // Priority: 1) platform preference, 2) localStorage legacy, 3) quality defaults
      const fromPlatform = platformVoiceName ? eng.find(v => v.name === platformVoiceName) : null;
      const fromLocal = !fromPlatform ? eng.find(v => v.name === localStorage.getItem(VOICE_STORAGE_KEY)) : null;
      const fromDefault = eng.find(v =>
        v.name.includes("Samantha") || v.name.includes("Alex") ||
        v.name.includes("Microsoft Aria") || v.name.includes("Google US English")
      ) ?? eng[0];

      const pref = fromPlatform ?? fromLocal ?? fromDefault;
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

  // ── Voice change — save preference ────────────────────────
  function handleVoiceChange(name: string) {
    const v = voices.find(v => v.name === name);
    setSelectedVoice(v ?? null);
    selectedVoiceRef.current = v ?? null;
    if (name) localStorage.setItem(VOICE_STORAGE_KEY, name);
  }

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

  const shortVoiceName = (v: SpeechSynthesisVoice) =>
    v.name.replace(/\(.*?\)/g, "").replace("Google", "").replace("Microsoft", "").trim();

  const pct = ((currentVerseIdx + 1) / verses.length) * 100;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "#0d0d0f",
      display: "flex", flexDirection: "column",
      fontFamily: "var(--font-display, Georgia, serif)",
      color: "#f0ebe0",
    }}>
      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => { stop(); onClose(); }}
            style={{ background: "none", border: "none", color: "#666", fontSize: 20, cursor: "pointer", padding: 4, lineHeight: 1 }}>
            ✕
          </button>
          <span style={{ fontSize: 15, color: "#c0b8a8" }}>{book.name} {chapterNum}</span>
          <span style={{ fontSize: 11, color: "#444", fontFamily: "system-ui" }}>
            {currentVerseIdx + 1} / {verses.length}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={selectedVoice?.name ?? ""} onChange={e => handleVoiceChange(e.target.value)}
            style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid #2a2a2f", background: "#1a1a1f", color: "#c0b8a8", fontSize: 11, fontFamily: "system-ui", cursor: "pointer", maxWidth: 170 }}>
            {voices.map(v => <option key={v.name} value={v.name}>{shortVoiceName(v)}</option>)}
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="range" min={0.5} max={1.4} step={0.05} value={speechRate}
              onChange={e => setSpeechRate(parseFloat(e.target.value))}
              style={{ width: 70, accentColor: "#7c5cbf" }} />
            <span style={{ fontSize: 11, color: "#555", fontFamily: "system-ui", minWidth: 28 }}>{speechRate.toFixed(2)}×</span>
          </div>

          <button onClick={restart} title="Restart (R)"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #2a2a2f", color: "#777", fontSize: 14, cursor: "pointer", padding: "5px 10px", borderRadius: 7 }}>
            ↺ Restart
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
                background: isActive ? "rgba(124,92,191,0.09)" : "transparent",
                borderLeft: isActive ? "3px solid #7c5cbf" : "3px solid transparent",
                transition: "background 200ms",
              }}
            >
              <div style={{
                fontSize: 10, fontWeight: 700, fontFamily: "system-ui",
                color: isActive ? "#7c5cbf" : "#383330",
                textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 7,
              }}>
                Verse {verse.number}
              </div>

              <div style={{
                fontSize: isActive ? 26 : isFuture ? 18 : 16,
                lineHeight: isActive ? 1.9 : 1.7,
                color: isActive ? "#f5efe0" : isPast ? "#2e2b26" : "#6a6258",
                transition: "font-size 250ms, color 200ms",
                letterSpacing: "0.01em",
              }}>
                {isActive && words ? (
                  // Current verse: word-by-word highlighting
                  words.map((word, wi) => (
                    <span key={wi} style={{
                      display: "inline",
                      background: currentWordIdx === wi ? "#7c5cbf" : "transparent",
                      color: currentWordIdx === wi ? "#fff" : undefined,
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
            <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
            <div style={{ fontSize: 18, color: "#c0b8a8", fontFamily: "var(--font-display, Georgia, serif)", marginBottom: 4 }}>
              {book.name} {chapterNum} complete
            </div>

            {nextReadingHref && nextReadingLabel ? (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, color: "#555", fontFamily: "system-ui", marginBottom: 12 }}>
                  Up next
                </div>
                <div style={{ fontSize: 20, color: "#a78bdc", fontFamily: "var(--font-display, Georgia, serif)", marginBottom: 20 }}>
                  {nextReadingLabel}
                </div>

                {/* Countdown ring */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
                  <button
                    onClick={() => { setCountdown(null); setDone(false); router.push(nextReadingHref); }}
                    style={{
                      padding: "12px 28px", borderRadius: 10, border: "none",
                      background: "linear-gradient(135deg, #7c5cbf, #a78bdc)",
                      color: "#fff", fontSize: 15, fontWeight: 600,
                      fontFamily: "system-ui", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    Continue
                    {countdown !== null && (
                      <span style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: "rgba(255,255,255,0.25)",
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
                      padding: "12px 20px", borderRadius: 10,
                      border: "1px solid #2a2a2f", background: "transparent",
                      color: "#666", fontSize: 13, fontFamily: "system-ui", cursor: "pointer",
                    }}
                  >
                    Pause
                  </button>
                </div>

                {countdown === null && (
                  <div style={{ marginTop: 14 }}>
                    <button
                      onClick={() => router.push(nextReadingHref)}
                      style={{ background: "none", border: "none", color: "#7c5cbf", fontSize: 13, fontFamily: "system-ui", cursor: "pointer", textDecoration: "underline" }}
                    >
                      Go to {nextReadingLabel} →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 20 }}>
                <button onClick={() => startFrom(0)}
                  style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#7c5cbf", color: "#fff", fontSize: 14, fontFamily: "system-ui", cursor: "pointer" }}>
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
        background: "rgba(13,13,15,0.96)", backdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "14px 24px 18px", gap: 12, flexShrink: 0,
      }}>
        {/* Progress */}
        <div style={{ width: "100%", maxWidth: 560, height: 3, background: "#1e1e22", borderRadius: 2 }}>
          <div style={{
            height: "100%", borderRadius: 2,
            background: "linear-gradient(90deg, #7c5cbf, #a78bdc)",
            width: `${pct}%`, transition: "width 400ms",
          }} />
        </div>

        {/* Playback controls */}
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <button onClick={() => startFrom(Math.max(0, currentVerseIdx - 1))}
            title="Previous verse (←)"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #2a2a2f", color: "#777", fontSize: 18, cursor: "pointer", width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            ⏮
          </button>

          {!speaking ? (
            <button onClick={() => startFrom(currentVerseIdx)}
              title="Play (Space)"
              style={{
                width: 64, height: 64, borderRadius: "50%", border: "none",
                background: "linear-gradient(135deg, #7c5cbf, #a78bdc)",
                color: "#fff", fontSize: 26, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 20px rgba(124,92,191,0.4)",
              }}>
              ▶
            </button>
          ) : (
            <button onClick={pauseResume}
              title="Pause/Resume (Space)"
              style={{
                width: 64, height: 64, borderRadius: "50%", border: "none",
                background: paused ? "linear-gradient(135deg, #7c5cbf, #a78bdc)" : "rgba(255,255,255,0.10)",
                color: "#fff", fontSize: 22, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              {paused ? "▶" : "⏸"}
            </button>
          )}

          <button onClick={() => startFrom(Math.min(verses.length - 1, currentVerseIdx + 1))}
            title="Next verse (→)"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #2a2a2f", color: "#777", fontSize: 18, cursor: "pointer", width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            ⏭
          </button>
        </div>

        <div style={{ fontSize: 10, color: "#333", fontFamily: "system-ui" }}>
          Space · R = restart · ← → = prev/next verse · Esc = close · Click any verse to jump
        </div>
      </div>
    </div>
  );
}
