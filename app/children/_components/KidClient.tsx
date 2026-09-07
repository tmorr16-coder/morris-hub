"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

// A six-year-old's screen.
//
// Rules it is built on: one thing at a time, letters big enough to read from
// a lap, the app says everything out loud, every success gets a star, and
// there is nothing to get lost in. A small "Grown-ups" link at the bottom is
// the only way out, and it goes back to the parents' workspace.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { pickBestVoice } from "@/lib/tts-voices";
import type { ChildTask } from "../_lib/learning";
import { completeTask, markWordPracticed } from "../_lib/learning-actions";

interface Props {
  childId: string;
  name: string;
  gradeLabel: string | null;
  tasks: ChildTask[];
  exercises: { id: string; title: string; steps: string | null; minutes: number | null }[];
  spelling: { weekId: string; words: string[]; sightWords: string[]; pattern: string | null } | null;
  stars: { total: number; week: number };
}

type View = { kind: "home" } | { kind: "task"; task: ChildTask } | { kind: "tutor" };

const TASK_EMOJI: Record<string, string> = { exercise: "✏️", spelling: "🔤", reading: "📖", custom: "⭐" };
const PRAISE = ["Yes!", "You got it!", "Super!", "Great job!", "Wow!", "Nice work!"];

/**
 * Read aloud with the platform voice.
 *
 * The voice and speed chosen under Bible → Settings are saved through
 * /api/tts-prefs, the single source of truth for read-aloud everywhere in the
 * app. The first version ranked the device's voices on its own and picked the
 * top one, which on the phone was not the one the family had chosen and
 * sounded it. Now: the saved voice when the device has it, the best-ranked
 * voice only until the preference arrives or when it is missing.
 */
function useSpeech() {
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const rateRef = useRef(1);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    let savedName: string | null = null;
    const apply = () => {
      const all = window.speechSynthesis.getVoices();
      if (all.length === 0) return;
      const saved = savedName ? all.find((v) => v.name === savedName) ?? null : null;
      if (saved) voiceRef.current = saved;
      else if (!voiceRef.current) voiceRef.current = pickBestVoice(all);
    };
    fetch("/api/tts-prefs").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.tts_voice) savedName = d.tts_voice;
      if (typeof d?.tts_speed === "number") rateRef.current = d.tts_speed;
      apply();
    }).catch(() => {});
    apply();
    window.speechSynthesis.addEventListener("voiceschanged", apply);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", apply);
  }, []);
  // `pace` scales the saved speed: spelling letters go a little slower, a
  // cheer a little faster.
  return useCallback((text: string, pace = 0.95) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate = Math.max(0.5, Math.min(2, rateRef.current * pace));
    window.speechSynthesis.speak(u);
  }, []);
}

const big: React.CSSProperties = { fontSize: 28, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.01em" };
const cardStyle: React.CSSProperties = { background: "var(--ios-cell)", borderRadius: 22, padding: "18px 20px", boxShadow: "0 8px 24px -16px rgba(0,0,0,0.4)", border: "1px solid var(--ios-separator)" };
const bigBtn = (bg: string): React.CSSProperties => ({ width: "100%", padding: "18px 20px", borderRadius: 18, border: "none", background: bg, color: "#fff", fontSize: 22, fontWeight: 800, cursor: "pointer", boxShadow: "0 6px 0 rgba(0,0,0,0.15)" });

export default function KidClient({ childId, name, gradeLabel, tasks: initialTasks, exercises, spelling, stars: initialStars }: Props) {
  const speak = useSpeech();
  const first = name.split(" ")[0] || name;
  const [tasks, setTasks] = useState<ChildTask[]>(initialTasks);
  const [stars, setStars] = useState(initialStars);
  const [view, setView] = useState<View>({ kind: "home" });
  const [burst, setBurst] = useState<string | null>(null);
  const open = tasks.filter((t) => !t.completedAt);
  const doneToday = tasks.filter((t) => t.completedAt);

  function celebrate(text: string) {
    setBurst(text);
    speak(text, 1);
    setTimeout(() => setBurst(null), 1400);
  }

  async function finish(task: ChildTask, earned: number) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completedAt: new Date().toISOString(), stars: earned } : t)));
    setStars((s) => ({ total: s.total + earned, week: s.week + earned }));
    celebrate(`${PRAISE[Math.floor(Math.random() * PRAISE.length)]} ${earned} star${earned === 1 ? "" : "s"}!`);
    setView({ kind: "home" });
    await completeTask(childId, task.id, earned);
  }

  // ── Home ────────────────────────────────────────────────────────────────
  if (view.kind === "home") {
    return (
      <Shell burst={burst}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h1 style={{ ...big, fontSize: 36, margin: 0 }}>Hi, {first}! 👋</h1>
          <span style={{ fontSize: 22, fontWeight: 800, whiteSpace: "nowrap" }}>⭐ {stars.total}</span>
        </div>
        <p style={{ fontSize: 18, color: "var(--ios-label-2)", margin: "4px 0 18px" }}>
          {open.length === 0 ? "No jobs right now. Ask your tutor a question!" : open.length === 1 ? "You have 1 job today." : `You have ${open.length} jobs today.`}
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          {open.map((t) => (
            <button key={t.id} type="button" onClick={() => { setView({ kind: "task", task: t }); speak(t.title); }} style={{ ...cardStyle, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 40 }}>{TASK_EMOJI[t.kind] ?? "⭐"}</span>
              <span style={{ ...big, fontSize: 22 }}>{t.title}</span>
            </button>
          ))}
          <button type="button" onClick={() => { setView({ kind: "tutor" }); speak(`Hi ${first}! I'm Buddy. What do you want to work on?`); }} style={{ ...cardStyle, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, background: "linear-gradient(135deg, #FFB13A, #FF7A59)", color: "#fff", border: "none" }}>
            <span style={{ fontSize: 40 }}>🦉</span>
            <span><span style={{ ...big, fontSize: 22, display: "block" }}>Ask Buddy</span><span style={{ fontSize: 16, opacity: 0.95 }}>Your tutor. Ask about your words or your math.</span></span>
          </button>
        </div>

        {doneToday.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Done today</div>
            {doneToday.map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 4px", fontSize: 18, color: "var(--ios-label-2)", borderBottom: "1px solid var(--ios-separator)" }}>
                <span>{TASK_EMOJI[t.kind]} {t.title}</span><span>{"⭐".repeat(Math.max(1, t.stars))}</span>
              </div>
            ))}
          </div>
        )}
        <Footer childId={childId} />
      </Shell>
    );
  }

  // ── A task ──────────────────────────────────────────────────────────────
  if (view.kind === "task") {
    const t = view.task;
    if (t.kind === "spelling" && (t.payload.words?.length ?? 0) > 0) {
      return (
        <Shell burst={burst}>
          <SpellingRun words={t.payload.words!} speak={speak} childId={childId} weekId={spelling?.weekId ?? null} onBack={() => setView({ kind: "home" })} onFinish={(right) => finish(t, right >= t.payload.words!.length ? 3 : right > 0 ? 2 : 1)} onRight={(w) => celebrate(`${PRAISE[Math.floor(Math.random() * PRAISE.length)]} ${w}!`)} />
        </Shell>
      );
    }
    const ex = t.exerciseId ? exercises.find((e) => e.id === t.exerciseId) : null;
    const text = t.instructions ?? t.payload.steps ?? ex?.steps ?? "";
    return (
      <Shell burst={burst}>
        <BackButton onClick={() => setView({ kind: "home" })} />
        <div style={{ fontSize: 48, marginTop: 8 }}>{TASK_EMOJI[t.kind] ?? "⭐"}</div>
        <h1 style={{ ...big, margin: "8px 0 12px" }}>{t.title}</h1>
        {text && <div style={{ ...cardStyle, fontSize: 20, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text}</div>}
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {text && <button type="button" style={bigBtn("var(--ios-tint)")} onClick={() => speak(`${t.title}. ${text}`)}>🔊 Read it to me</button>}
          <button type="button" style={bigBtn("#2ACF5F")} onClick={() => finish(t, 1)}>⭐ I did it!</button>
        </div>
        <Footer childId={childId} />
      </Shell>
    );
  }

  // ── Tutor ───────────────────────────────────────────────────────────────
  return (
    <Shell burst={burst}>
      <BackButton onClick={() => setView({ kind: "home" })} />
      <Tutor childId={childId} first={first} gradeLabel={gradeLabel} speak={speak} words={spelling ? [...spelling.words, ...spelling.sightWords] : []} />
      <Footer childId={childId} />
    </Shell>
  );
}

function Shell({ children, burst }: { children: React.ReactNode; burst: string | null }) {
  return (
    <main className="ios-scroll" style={{ padding: "max(16px, env(safe-area-inset-top)) 18px 40px", maxWidth: 560, margin: "0 auto", position: "relative" }}>
      {children}
      {burst && (
        <div aria-live="polite" style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 50 }}>
          <div style={{ background: "var(--ios-cell)", borderRadius: 28, padding: "22px 30px", fontSize: 34, fontWeight: 900, boxShadow: "0 20px 60px -20px rgba(0,0,0,0.5)", animation: "kidpop 0.35s ease-out" }}>🎉 {burst}</div>
          <style>{`@keyframes kidpop { from { transform: scale(0.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
        </div>
      )}
    </main>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} style={{ background: "var(--ios-fill)", border: "none", borderRadius: 999, padding: "10px 18px", fontSize: 18, fontWeight: 700, color: "var(--ios-label)", cursor: "pointer" }}>← Back</button>;
}

function Footer({ childId }: { childId: string }) {
  return (
    <div style={{ marginTop: 40, textAlign: "center" }}>
      <Link href={`/children/${childId}`} style={{ fontSize: 13, color: "var(--ios-label-3)", textDecoration: "none" }}>Grown-ups</Link>
    </div>
  );
}

// ── Spelling: listen, spell, check ──────────────────────────────────────────

function SpellingRun({ words, speak, childId, weekId, onBack, onFinish, onRight }: {
  words: string[]; speak: (t: string, rate?: number) => void; childId: string; weekId: string | null;
  onBack: () => void; onFinish: (right: number) => void; onRight: (w: string) => void;
}) {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [shown, setShown] = useState(false);
  const [right, setRight] = useState(0);
  const [wrongOnce, setWrongOnce] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const word = words[i];

  useEffect(() => { speak(`Spell: ${word}`); inputRef.current?.focus(); }, [i, word, speak]);
  function go(next: number) { setTyped(""); setShown(false); setWrongOnce(false); setI(next); }

  function check() {
    const ok = typed.trim().toLowerCase() === word.toLowerCase();
    if (ok) {
      setRight((r) => r + 1);
      onRight(word);
      if (weekId) markWordPracticed(childId, weekId, word, 1);
      setTimeout(() => (i + 1 < words.length ? go(i + 1) : onFinish(right + 1)), 900);
    } else {
      setWrongOnce(true);
      speak(`Not yet. Listen again: ${word}. ${word.split("").join(", ")}.`, 0.8);
      setShown(true);
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <BackButton onClick={onBack} />
        <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ios-label-2)" }}>{i + 1} of {words.length}</span>
      </div>
      <div style={{ ...cardStyle, marginTop: 16, textAlign: "center" }}>
        <div style={{ fontSize: 18, color: "var(--ios-label-2)" }}>Listen, then spell it</div>
        <button type="button" onClick={() => speak(word)} style={{ ...bigBtn("var(--ios-tint)"), marginTop: 12 }}>🔊 Hear the word</button>
        <div style={{ marginTop: 16, minHeight: 44, fontSize: 40, fontWeight: 900, letterSpacing: "0.12em", color: shown ? "var(--ios-orange)" : "transparent" }}>{word}</div>
        <input
          ref={inputRef}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") check(); }}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="text"
          style={{ width: "100%", marginTop: 8, padding: "14px", borderRadius: 16, border: "3px solid var(--ios-separator)", fontSize: 34, fontWeight: 800, letterSpacing: "0.14em", textAlign: "center", background: "var(--ios-bg-elevated)", color: "var(--ios-label)" }}
          placeholder="type here"
        />
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <button type="button" style={bigBtn("#2ACF5F")} onClick={check} disabled={!typed.trim()}>✓ Check</button>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => { setShown(true); speak(word.split("").join(", "), 0.8); }} style={{ ...bigBtn("var(--ios-fill)"), color: "var(--ios-label)", fontSize: 18, boxShadow: "none" }}>👀 Show me</button>
            <button type="button" onClick={() => (i + 1 < words.length ? go(i + 1) : onFinish(right))} style={{ ...bigBtn("var(--ios-fill)"), color: "var(--ios-label)", fontSize: 18, boxShadow: "none" }}>Skip →</button>
          </div>
        </div>
        {wrongOnce && <div style={{ marginTop: 10, fontSize: 16, color: "var(--ios-label-2)" }}>Look at the word, then type it again.</div>}
      </div>
      <div style={{ marginTop: 14, textAlign: "center", fontSize: 18 }}>{"⭐".repeat(Math.min(right, 10))}</div>
    </>
  );
}

// ── Buddy, the tutor ────────────────────────────────────────────────────────

function Tutor({ childId, first, gradeLabel, speak, words }: { childId: string; first: string; gradeLabel: string | null; speak: (t: string, rate?: number) => void; words: string[] }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: `Hi ${first}! I'm Buddy. 🦉 What do you want to work on?` },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/children/tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId, messages: next.slice(-8) }) });
      const data = await res.json();
      const reply = res.ok ? String(data.reply) : "Hmm, I got a little mixed up. Ask me again?";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      speak(reply);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Hmm, I got a little mixed up. Ask me again?" }]);
    } finally {
      setBusy(false);
    }
  }

  const quick = [
    words.length ? "Quiz me on my spelling words" : null,
    words.length ? "Tell me a silly story with my words" : null,
    "Help me with doubles in math",
    "Why is the e silent?",
  ].filter(Boolean) as string[];

  return (
    <>
      <h1 style={{ ...big, margin: "12px 0 4px" }}>🦉 Buddy</h1>
      <div style={{ fontSize: 15, color: "var(--ios-label-3)", marginBottom: 12 }}>Your {gradeLabel ?? "school"} tutor. Buddy only talks about school stuff.</div>
      <div style={{ display: "grid", gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ ...cardStyle, padding: "12px 16px", fontSize: 20, lineHeight: 1.45, alignSelf: m.role === "user" ? "end" : "start", background: m.role === "user" ? "var(--ios-tint)" : "var(--ios-cell)", color: m.role === "user" ? "var(--ios-on-tint)" : "var(--ios-label)", maxWidth: "88%", justifySelf: m.role === "user" ? "end" : "start", border: m.role === "user" ? "none" : undefined }}>
            {m.content}
          </div>
        ))}
        {busy && <div style={{ fontSize: 18, color: "var(--ios-label-3)" }}>Buddy is thinking…</div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {quick.map((q) => <button key={q} type="button" onClick={() => send(q)} style={{ background: "var(--ios-fill)", border: "none", borderRadius: 999, padding: "10px 14px", fontSize: 16, fontWeight: 700, color: "var(--ios-label)", cursor: "pointer" }}>{q}</button>)}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder="Ask Buddy…" style={{ flex: 1, padding: "14px", borderRadius: 16, border: "2px solid var(--ios-separator)", fontSize: 20, background: "var(--ios-bg-elevated)", color: "var(--ios-label)" }} />
        <button type="button" onClick={() => send(input)} disabled={busy || !input.trim()} style={{ ...bigBtn("var(--ios-tint)"), width: "auto", padding: "0 20px", fontSize: 18 }}>Send</button>
      </div>
    </>
  );
}
