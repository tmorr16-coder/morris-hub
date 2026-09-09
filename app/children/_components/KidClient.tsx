"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

// A six-year-old's screen.
//
// Rules it is built on: one thing at a time, letters big enough to read from
// a lap, the app says everything out loud, every success gets a star, and
// there is nothing to get lost in. A small "Grown-ups" link at the bottom is
// the only way out, and it goes back to the parents' workspace.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { pickBestVoice } from "@/lib/tts-voices";
import { CLOUD_VOICES, DEFAULT_CLOUD_VOICE } from "@/lib/openai-tts";
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
  /** "buddy" opens straight into the tutor. The link is bookmarkable, so the
      iPad can have Buddy on its home screen and never show this menu at all. */
  openTo?: "home" | "buddy";
  /** Whether the server has an OpenAI key. Without one this is the device voice only. */
  cloudVoices?: boolean;
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
const BUDDY_VOICE_KEY = "buddy-voice";
const BUDDY_RATE_KEY = "buddy-rate";

/**
 * A warm adult voice a child likes, from what this device has. Apple's
 * neural voices in a natural register first — Ava, Zoe, Joelle, Noelle, then
 * Evan, Nathan, Aaron — Premium over Enhanced, then whatever ranks best.
 * Never a classic or sound-effect voice, though both are still offered below.
 */
const KID_FRIENDLY = ["Ava", "Zoe", "Samantha", "Allison", "Joelle", "Noelle", "Nicky", "Evan", "Nathan", "Aaron", "Tom", "Susan"];

/**
 * Sound effects, not voices. Zarvox is a robot, Bells sings the sentence,
 * Bubbles gargles it. Nothing here can read a spelling word to a child, so
 * they are the only names dropped outright.
 */
const NOVELTY = /compact|eloquence|bahh|bells|boing|bubbles|cellos|deranged|good news|bad news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|hysterical|pipe|deity|diety/i;

/**
 * Apple's classic speech voices — Fred was the Mac's default for years, and
 * Junior, Kathy, Ralph, Albert, Bruce, Agnes and Victoria are its siblings.
 * They are thin next to the neural voices, so they sort to the bottom of the
 * list and are never chosen automatically, but a grown-up asking for Fred
 * should find Fred. They exist on macOS; an iPad or iPhone does not ship them.
 */
const CLASSIC = /\b(fred|junior|kathy|ralph|albert|bruce|agnes|victoria|princess)\b/i;

/** Every real English voice on this device: only the sound-effect voices are dropped. */
function englishVoices(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const lang = (v: SpeechSynthesisVoice) => (v.lang || "").replace("_", "-");
  const quality = (v: SpeechSynthesisVoice) => (/\bpremium\b/i.test(v.name) ? 2 : /\benhanced\b/i.test(v.name) ? 1 : 0);
  return all
    .filter((v) => lang(v).toLowerCase().startsWith("en") && !NOVELTY.test(v.name))
    .sort((a, b) => {
      const us = (lang(b) === "en-US" ? 1 : 0) - (lang(a) === "en-US" ? 1 : 0);
      if (us) return us;
      const cl = (CLASSIC.test(a.name) ? 1 : 0) - (CLASSIC.test(b.name) ? 1 : 0);
      if (cl) return cl;
      const q = quality(b) - quality(a);
      if (q) return q;
      const ka = KID_FRIENDLY.findIndex((n) => new RegExp(`\\b${n}\\b`, "i").test(a.name));
      const kb = KID_FRIENDLY.findIndex((n) => new RegExp(`\\b${n}\\b`, "i").test(b.name));
      return (ka < 0 ? 99 : ka) - (kb < 0 ? 99 : kb) || a.name.localeCompare(b.name);
    });
}

/** The default: the most natural US voice this device has, in a warm adult register. */
function pickKidVoice(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const us = englishVoices(all).filter((v) => (v.lang || "").replace("_", "-") === "en-US");
  for (const tier of [/\bpremium\b/i, /\benhanced\b/i]) {
    for (const n of KID_FRIENDLY) {
      const v = us.find((x) => tier.test(x.name) && new RegExp(`\\b${n}\\b`, "i").test(x.name));
      if (v) return v;
    }
  }
  for (const n of KID_FRIENDLY) {
    const v = us.find((x) => new RegExp(`\\b${n}\\b`, "i").test(x.name));
    if (v) return v;
  }
  const natural = englishVoices(all).filter((v) => !CLASSIC.test(v.name));
  return natural.find((v) => (v.lang || "").replace("_", "-") === "en-US") ?? natural[0] ?? us[0] ?? pickBestVoice(all);
}

function readLocal(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

// A valid, empty WAV. Played once inside a real tap so iOS marks the element
// as user-activated; after that Buddy may speak without one, which he must,
// because most of what he says follows a network round trip and the gesture is
// long gone by the time the audio arrives.
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";

/** A cloud voice is stored with a prefix so it can never collide with a device voice name. */
const CLOUD_PREFIX = "openai:";

// The saved voice, read through an external store. It was an effect that
// copied localStorage into state on mount, which is a second render of the
// whole screen every visit and a warning from React about it. Derived from one
// source instead: the server and the first paint see null, the real value
// arrives without a cascade, and choose() notifies everyone at once.
let voicePref: string | null | undefined;
const voiceListeners = new Set<() => void>();
function readVoicePref(): string | null {
  if (voicePref === undefined) {
    try { voicePref = localStorage.getItem(BUDDY_VOICE_KEY); } catch { voicePref = null; }
  }
  return voicePref;
}
function writeVoicePref(value: string) {
  voicePref = value;
  try { localStorage.setItem(BUDDY_VOICE_KEY, value); } catch { /* private mode */ }
  for (const l of voiceListeners) l();
}
function subscribeVoicePref(cb: () => void): () => void {
  voiceListeners.add(cb);
  return () => { voiceListeners.delete(cb); };
}

function useSpeech(childId: string, cloudAvailable: boolean) {
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const rateRef = useRef(0.92);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [choices, setChoices] = useState<SpeechSynthesisVoice[]>([]);
  const [loading, setLoading] = useState(false);

  // Which cloud voice is in use, or null for "the device". Cloud is the better
  // voice, so it is what you get when it is available and nothing was chosen;
  // picking a device voice sticks.
  const pref = useSyncExternalStore(subscribeVoicePref, readVoicePref, () => null);
  const cloudVoice = !cloudAvailable
    ? null
    : pref?.startsWith(CLOUD_PREFIX)
      ? pref.slice(CLOUD_PREFIX.length)
      : pref
        ? null
        : DEFAULT_CLOUD_VOICE;

  // One element for the life of the screen. A fresh Audio() per phrase would
  // need unlocking per phrase, which iOS will not grant.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  // Clips already fetched this sitting, by cache key. Buddy repeats himself.
  const clipsRef = useRef<Map<string, string>>(new Map());
  // Bumped on every stop() and every new phrase, so a fetch that lands late
  // cannot start talking over whatever is being said now.
  const genRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const savedRate = parseFloat(readLocal(BUDDY_RATE_KEY) ?? "");
    if (Number.isFinite(savedRate) && savedRate >= 0.5 && savedRate <= 2) rateRef.current = savedRate;
    const apply = () => {
      const all = window.speechSynthesis.getVoices();
      if (all.length === 0) return;
      // The grown-ups' choice on this device wins; otherwise the kid-friendly
      // default. The platform read-aloud voice is not used here on purpose —
      // it is chosen for reading Scripture to an adult, not for a tutor
      // talking to a six-year-old.
      const chosen = readLocal(BUDDY_VOICE_KEY);
      const deviceChoice = chosen && !chosen.startsWith(CLOUD_PREFIX) ? chosen : null;
      const picked = (deviceChoice ? all.find((v) => v.name === deviceChoice) : null) ?? pickKidVoice(all);
      voiceRef.current = picked;
      setVoiceName(picked?.name ?? null);
      setChoices(englishVoices(all));
    };
    apply();
    window.speechSynthesis.addEventListener("voiceschanged", apply);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", apply);
  }, []);

  const choose = useCallback((name: string) => {
    if (name.startsWith(CLOUD_PREFIX)) { writeVoicePref(name); return; }
    const all = window.speechSynthesis.getVoices();
    const v = all.find((x) => x.name === name);
    if (!v) return;
    voiceRef.current = v;
    setVoiceName(v.name);
    writeVoicePref(name);
  }, []);
  // The utterance being spoken is held here so it is not collected mid-sentence,
  // which silences Chrome; and speak() is never called in the same tick as
  // cancel(), which silences Safari on iPad and iPhone.
  const currentRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [speaking, setSpeaking] = useState(false);
  // ── The device voice ────────────────────────────────────────────────────
  // Still here, still the fallback, unchanged: free, instant, and it works on
  // a plane.
  const deviceSpeak = useCallback((text: string, pace = 0.95) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate = Math.max(0.5, Math.min(2, rateRef.current * pace));
    u.onstart = () => setSpeaking(true);
    u.onend = () => { if (currentRef.current === u) setSpeaking(false); };
    u.onerror = () => { if (currentRef.current === u) setSpeaking(false); };
    currentRef.current = u;
    const wasBusy = synth.speaking || synth.pending;
    if (wasBusy) synth.cancel();
    // Safari leaves synthesis paused after a cancel or a backgrounded tab;
    // a resume is harmless everywhere else.
    try { synth.resume(); } catch { /* not every browser has it */ }
    window.setTimeout(() => { if (currentRef.current === u) synth.speak(u); }, wasBusy ? 150 : 0);
  }, []);

  // ── The cloud voice ─────────────────────────────────────────────────────
  const speak = useCallback((text: string, pace = 0.95) => {
    const said = text.trim();
    if (!said) return;
    const gen = ++genRef.current;

    if (!cloudAvailable || !cloudVoice) { deviceSpeak(said, pace); return; }
    const voice = cloudVoice;

    // Unlock inside the tap. Everything after this point may happen a second
    // later, off the back of a fetch, with no gesture in sight.
    const el = audioRef.current ?? (audioRef.current = new Audio());
    if (!unlockedRef.current) {
      el.src = SILENCE;
      el.play().then(() => { unlockedRef.current = true; }).catch(() => { /* the next tap will do */ });
    }

    const speed = Math.max(0.5, Math.min(1.5, rateRef.current * pace));
    const key = `${voice}|${speed.toFixed(2)}|${said}`;

    const play = (src: string) => {
      if (genRef.current !== gen) return;   // something newer is talking
      el.src = src;
      el.onplay = () => setSpeaking(true);
      el.onended = () => { if (genRef.current === gen) setSpeaking(false); };
      el.onerror = () => { if (genRef.current === gen) { setSpeaking(false); deviceSpeak(said, pace); } };
      el.play().catch(() => { if (genRef.current === gen) deviceSpeak(said, pace); });
    };

    const cached = clipsRef.current.get(key);
    if (cached) { play(cached); return; }

    setLoading(true);
    fetch("/api/children/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId, text: said, voice, speed }),
    })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        // A sitting is short and the clips are seconds long; a cap keeps a very
        // chatty session from holding on to more than a few megabytes.
        if (clipsRef.current.size > 60) {
          for (const u of clipsRef.current.values()) URL.revokeObjectURL(u);
          clipsRef.current.clear();
        }
        clipsRef.current.set(key, url);
        play(url);
      })
      // No key, no network, a provider outage, a 429 — all the same to a child
      // waiting to be read to. Say it with the device voice instead.
      .catch(() => { if (genRef.current === gen) deviceSpeak(said, pace); })
      .finally(() => setLoading(false));
  }, [childId, cloudAvailable, cloudVoice, deviceSpeak]);

  // Stop: the child (or parent) wants quiet now — mid-story, mid-quiz.
  const stop = useCallback(() => {
    genRef.current++;
    const el = audioRef.current;
    if (el) { el.pause(); el.currentTime = 0; }
    currentRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  // Object URLs outlive the component unless they are let go.
  useEffect(() => {
    const clips = clipsRef.current;
    return () => { for (const u of clips.values()) URL.revokeObjectURL(u); clips.clear(); };
  }, []);

  const label = cloudVoice
    ? (CLOUD_VOICES.find((v) => v.id === cloudVoice)?.label ?? cloudVoice)
    : voiceName;

  return { speak, stop, speaking, loading, voiceName, voiceLabel: label, cloudVoice, choices, choose };
}

/**
 * Listen, using the device's own speech recognition (Safari and Chrome both
 * have it; iOS has had it since 14.5). Typing is a lot to ask of a first
 * grader; talking is not. Returns null where the device cannot do it, and the
 * button is simply not drawn.
 */
const noSubscribe = () => () => {};
const hasRecognition = () => !!((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition);

function useListening(onResult: (text: string, final: boolean) => void) {
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  // Read once on the client, false on the server, no state to set in an effect.
  const supported = useSyncExternalStore(noSubscribe, hasRecognition, () => false);
  const cb = useRef(onResult);
  useEffect(() => { cb.current = onResult; });
  useEffect(() => {
    if (!supported) return;
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let text = "";
      let final = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      cb.current(text.trim(), final);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.abort(); } catch { /* already stopped */ } };
  }, [supported]);
  const start = useCallback(() => {
    if (!recRef.current) return;
    try { window.speechSynthesis?.cancel(); recRef.current.start(); setListening(true); } catch { setListening(false); }
  }, []);
  const stop = useCallback(() => { try { recRef.current?.stop(); } catch { /* fine */ } }, []);
  return { supported, listening, start, stop };
}

const big: React.CSSProperties = { fontSize: 28, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.01em" };
const cardStyle: React.CSSProperties = { background: "var(--ios-cell)", borderRadius: 22, padding: "18px 20px", boxShadow: "0 8px 24px -16px rgba(0,0,0,0.4)", border: "1px solid var(--ios-separator)" };
const bigBtn = (bg: string): React.CSSProperties => ({ width: "100%", padding: "18px 20px", borderRadius: 18, border: "none", background: bg, color: "#fff", fontSize: 22, fontWeight: 800, cursor: "pointer", boxShadow: "0 6px 0 rgba(0,0,0,0.15)" });

export default function KidClient({ childId, name, gradeLabel, tasks: initialTasks, exercises, spelling, stars: initialStars, openTo = "home", cloudVoices = false }: Props) {
  const { speak, stop, speaking, loading, voiceLabel, cloudVoice, choices, choose } = useSpeech(childId, cloudVoices);
  const [pickingVoice, setPickingVoice] = useState(false);
  const first = name.split(" ")[0] || name;
  const [tasks, setTasks] = useState<ChildTask[]>(initialTasks);
  const [stars, setStars] = useState(initialStars);
  const [view, setView] = useState<View>(openTo === "buddy" ? { kind: "tutor" } : { kind: "home" });
  const [burst, setBurst] = useState<string | null>(null);
  const open = tasks.filter((t) => !t.completedAt);
  const doneToday = tasks.filter((t) => t.completedAt);

  function celebrate(text: string) {
    setBurst(text);
    speak(text, 1);
    setTimeout(() => setBurst(null), 1400);
  }

  function askBuddy() {
    setView({ kind: "tutor" });
    speak(`Hi ${first}! I'm Buddy. What do you want to work on?`);
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
      <Shell burst={burst} speaking={speaking} loading={loading} onStop={stop}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h1 style={{ ...big, fontSize: 36, margin: 0 }}>Hi, {first}! 👋</h1>
          <span style={{ fontSize: 22, fontWeight: 800, whiteSpace: "nowrap" }}>⭐ {stars.total}</span>
        </div>
        <p style={{ fontSize: 18, color: "var(--ios-label-2)", margin: "4px 0 10px" }}>
          {open.length === 0 ? "No jobs right now. Ask your tutor a question!" : open.length === 1 ? "You have 1 job today." : `You have ${open.length} jobs today.`}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <button type="button" onClick={() => speak(`Hi ${first}! Can you hear me? Let's go!`, 1)} style={{ background: "var(--ios-fill)", border: "none", borderRadius: 999, padding: "10px 16px", fontSize: 16, fontWeight: 700, color: "var(--ios-label)", cursor: "pointer" }}>
            🔊 Tap if you can&rsquo;t hear me
          </button>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <button type="button" onClick={askBuddy} style={{ ...cardStyle, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, background: "linear-gradient(135deg, #FFB13A, #FF7A59)", color: "#fff", border: "none" }}>
            <span style={{ fontSize: 40 }}>🦉</span>
            <span><span style={{ ...big, fontSize: 22, display: "block" }}>Ask Buddy</span><span style={{ fontSize: 16, opacity: 0.95 }}>Your tutor. Ask about your words or your math.</span></span>
          </button>
          {open.map((t) => (
            <button key={t.id} type="button" onClick={() => { setView({ kind: "task", task: t }); speak(t.title); }} style={{ ...cardStyle, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 40 }}>{TASK_EMOJI[t.kind] ?? "⭐"}</span>
              <span style={{ ...big, fontSize: 22 }}>{t.title}</span>
            </button>
          ))}
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
        {pickingVoice && (
          <div style={{ ...cardStyle, marginBottom: 14, padding: "12px 14px" }}>
            <div style={{ fontSize: 14, color: "var(--ios-label-2)", marginBottom: 8 }}>For grown-ups: pick the voice Buddy uses on this device. Tap a name to hear it.</div>

            {/* Buddy's own voices first. They are better than anything on the
                device by a wide margin, and they sound the same on every screen
                the family opens this on. */}
            {cloudVoices && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ios-label-3)", margin: "10px 0 4px" }}>Buddy&rsquo;s own voices</div>
                {CLOUD_VOICES.map((v) => {
                  const on = cloudVoice === v.id;
                  return (
                    <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--ios-separator)" }}>
                      <button
                        type="button"
                        onClick={() => { choose(`openai:${v.id}`); speak(`Hi ${first}, I'm Buddy! Let's learn something.`, 1); }}
                        style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        <span style={{ display: "block", fontSize: 17, fontWeight: on ? 800 : 500, color: on ? "var(--ios-tint)" : "var(--ios-label)" }}>
                          {on ? "✓ " : ""}{v.label}
                        </span>
                        <span style={{ display: "block", fontSize: 13, color: "var(--ios-label-2)", marginTop: 1 }}>{v.note}</span>
                      </button>
                    </div>
                  );
                })}
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ios-label-3)", margin: "14px 0 4px" }}>On this device</div>
              </div>
            )}

            {choices.length === 0 && <div style={{ fontSize: 15, color: "var(--ios-label-3)" }}>No voices loaded yet — tap the sound check first.</div>}
            {(["en-US", "other"] as const).map((group) => {
              const list = choices.filter((v) => ((v.lang || "").replace("_", "-") === "en-US") === (group === "en-US"));
              if (list.length === 0) return null;
              return (
                <div key={group}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ios-label-3)", margin: "10px 0 4px" }}>{group === "en-US" ? "US English" : "Other English"}</div>
                  {list.map((v) => {
                    const q = /\bpremium\b/i.test(v.name) ? "Premium" : /\benhanced\b/i.test(v.name) ? "Enhanced" : CLASSIC.test(v.name) ? "Classic" : null;
                    return (
                      <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--ios-separator)" }}>
                        <button type="button" onClick={() => { choose(v.name); speak(`Hi ${first}, I'm Buddy! Let's learn something.`, 1); }} style={{ flex: 1, textAlign: "left", background: "none", border: "none", fontSize: 17, fontWeight: !cloudVoice && v.name === voiceLabel ? 800 : 500, color: !cloudVoice && v.name === voiceLabel ? "var(--ios-tint)" : "var(--ios-label)", cursor: "pointer", padding: 0 }}>
                          {!cloudVoice && v.name === voiceLabel ? "✓ " : ""}{v.name.replace(/\s*\((premium|enhanced)\)/i, "")}
                        </button>
                        {q && <span style={{ fontSize: 11, fontWeight: 700, color: q === "Premium" ? "var(--ios-green)" : q === "Enhanced" ? "var(--ios-tint)" : "var(--ios-label-3)", border: "1px solid currentColor", borderRadius: 999, padding: "2px 8px" }}>{q}</span>}
                        <span style={{ fontSize: 12, color: "var(--ios-label-3)" }}>{v.lang}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div style={{ fontSize: 13, color: "var(--ios-label-2)", lineHeight: 1.5, marginTop: 12, padding: "10px 12px", background: "var(--ios-fill)", borderRadius: 10 }}>
              {cloudVoices
                ? <><strong>Buddy&rsquo;s own voices need the internet.</strong> They sound far better and they sound the same on every device, but out of signal Buddy falls back to the device voice below without saying anything about it — so it is worth having a good one of those too.</>
                : <><strong>The natural ones have to be downloaded first.</strong></>}
              {" "}On the iPad or iPhone: Settings → Accessibility → Spoken Content → Voices → English → tap <em>Ava</em>, <em>Zoe</em>, <em>Evan</em> or <em>Nathan</em> and download the <em>Premium</em> version (about 200 MB each). Then close Safari fully and reopen this screen; they appear here marked Premium. The <em>Classic</em> voices — Fred, Junior, Kathy, Ralph — are a Mac thing; an iPad or iPhone does not ship them, so they only show up here on a computer.
            </div>
          </div>
        )}
        <Footer
          childId={childId}
          onVoice={() => setPickingVoice((v) => !v)}
          voiceLabel={pickingVoice ? "Done" : `Voice${voiceLabel ? `: ${voiceLabel.replace(/\s*\(.*?\)/g, "")}` : ""}`}
        />
      </Shell>
    );
  }

  // ── A task ──────────────────────────────────────────────────────────────
  if (view.kind === "task") {
    const t = view.task;
    if (t.kind === "spelling" && (t.payload.words?.length ?? 0) > 0) {
      return (
        <Shell burst={burst} speaking={speaking} loading={loading} onStop={stop}>
          <SpellingRun words={t.payload.words!} speak={speak} childId={childId} weekId={spelling?.weekId ?? null} onBack={() => setView({ kind: "home" })} onFinish={(right) => finish(t, right >= t.payload.words!.length ? 3 : right > 0 ? 2 : 1)} onRight={(w) => celebrate(`${PRAISE[Math.floor(Math.random() * PRAISE.length)]} ${w}!`)} />
        </Shell>
      );
    }
    const ex = t.exerciseId ? exercises.find((e) => e.id === t.exerciseId) : null;
    const text = t.instructions ?? t.payload.steps ?? ex?.steps ?? "";
    return (
      <Shell burst={burst} speaking={speaking} loading={loading} onStop={stop}>
        <BackButton onClick={() => setView({ kind: "home" })} />
        <div style={{ fontSize: 48, marginTop: 8 }}>{TASK_EMOJI[t.kind] ?? "⭐"}</div>
        <h1 style={{ ...big, margin: "8px 0 12px" }}>{t.title}</h1>
        {text && <div style={{ ...cardStyle, fontSize: 20, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text}</div>}
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {text && <button type="button" style={bigBtn("var(--ios-tint)")} onClick={() => speak(`${t.title}. ${text}`)}>🔊 Read it to me</button>}
          <button type="button" style={bigBtn("#2ACF5F")} onClick={() => finish(t, 1)}>⭐ I did it!</button>
          {/* Stuck is the moment help is wanted. Going Back, finding the owl and
              starting over is three taps and a lost train of thought. */}
          <button type="button" style={{ ...bigBtn("#FF8C42"), fontSize: 19 }} onClick={askBuddy}>🦉 Ask Buddy about this</button>
        </div>
        <Footer childId={childId} />
      </Shell>
    );
  }

  // ── Tutor ───────────────────────────────────────────────────────────────
  return (
    <Shell burst={burst} speaking={speaking} loading={loading} onStop={stop}>
      <BackButton onClick={() => setView({ kind: "home" })} />
      <Tutor childId={childId} first={first} gradeLabel={gradeLabel} speak={speak} words={spelling ? [...spelling.words, ...spelling.sightWords] : []} />
      <Footer childId={childId} />
    </Shell>
  );
}

function Shell({ children, burst, speaking, loading, onStop }: { children: React.ReactNode; burst: string | null; speaking?: boolean; loading?: boolean; onStop?: () => void }) {
  return (
    <main className="ios-scroll" style={{ padding: "max(16px, env(safe-area-inset-top)) 18px 40px", maxWidth: 560, margin: "0 auto", position: "relative" }}>
      {children}
      {loading && !speaking && (
        <div aria-live="polite" style={{ position: "fixed", right: 16, bottom: "max(20px, env(safe-area-inset-bottom))", zIndex: 40, background: "var(--ios-fill)", color: "var(--ios-label-2)", borderRadius: 999, padding: "14px 20px", fontSize: 18, fontWeight: 800 }}>
          🔊 …
        </div>
      )}
      {speaking && onStop && (
        <button type="button" onClick={onStop} aria-label="Stop talking" style={{ position: "fixed", right: 16, bottom: "max(20px, env(safe-area-inset-bottom))", zIndex: 40, background: "#FF4D42", color: "#fff", border: "none", borderRadius: 999, padding: "14px 20px", fontSize: 18, fontWeight: 800, boxShadow: "0 8px 24px -8px rgba(0,0,0,0.5)", cursor: "pointer" }}>
          ⏹ Stop
        </button>
      )}
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

function Footer({ childId, onVoice, voiceLabel }: { childId: string; onVoice?: () => void; voiceLabel?: string }) {
  return (
    <div style={{ marginTop: 40, display: "flex", justifyContent: "center", gap: 18 }}>
      <Link href={`/children/${childId}`} style={{ fontSize: 13, color: "var(--ios-label-3)", textDecoration: "none" }}>Grown-ups</Link>
      {onVoice && (
        <button type="button" onClick={onVoice} style={{ background: "none", border: "none", padding: 0, fontSize: 13, color: "var(--ios-label-3)", cursor: "pointer" }}>
          {voiceLabel}
        </button>
      )}
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
      setTyped("");
      speak(`Not yet. Listen again: ${word}. Try again.`, 0.9);
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
        {/* The word is not on the screen at all until a first try or "Show me": a child can read a faint word. */}
        <div style={{ marginTop: 16, minHeight: 44, fontSize: 40, fontWeight: 900, letterSpacing: "0.12em", color: shown ? "var(--ios-orange)" : "var(--ios-label-3)" }}>{shown ? word : "•".repeat(word.length)}</div>
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
        {wrongOnce && !shown && <div style={{ marginTop: 10, fontSize: 16, color: "var(--ios-label-2)" }}>Not yet — listen and try again. Tap Show me if you need a peek.</div>}
      </div>
      <div style={{ marginTop: 14, textAlign: "center", fontSize: 18 }}>{"⭐".repeat(Math.min(right, 10))}</div>
    </>
  );
}

// ── Buddy, the tutor ────────────────────────────────────────────────────────

/** Words Buddy is testing arrive as [[word]]: hidden on screen, spoken aloud, shown after the child's first try. */
const HIDDEN = /\[\[([^\]]+)\]\]/g;
function forSpeech(text: string): string { return text.replace(HIDDEN, "$1"); }
function forScreen(text: string, revealed: boolean): string { return text.replace(HIDDEN, (_m, w: string) => (revealed ? w : "🔊 " + "•".repeat(Math.min(8, Math.max(3, w.length))))); }

function Tutor({ childId, first, gradeLabel, speak, words }: { childId: string; first: string; gradeLabel: string | null; speak: (t: string, rate?: number) => void; words: string[] }) {
  const [sessionId] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; revealed?: boolean }[]>([
    { role: "assistant", content: `Hi ${first}! I'm Buddy. 🦉 What do you want to work on?` },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const ears = useListening((text, final) => {
    setHeard(text);
    if (final && text) { setHeard(""); void send(text); }
  });

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/children/tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId, sessionId, messages: next.slice(-8).map((m) => ({ role: m.role, content: m.content })) }) });
      const data = await res.json();
      const reply = res.ok ? String(data.reply) : "Hmm, I got a little mixed up. Ask me again?";
      setMessages((m) => [...m, { role: "assistant", content: reply, revealed: false }]);
      speak(forSpeech(reply));
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
            {m.role === "assistant" ? forScreen(m.content, m.revealed !== false) : m.content}
            {m.role === "assistant" && i > 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => speak(forSpeech(m.content))} style={{ background: "var(--ios-fill)", border: "none", borderRadius: 999, padding: "8px 14px", fontSize: 16, fontWeight: 700, color: "var(--ios-label)", cursor: "pointer" }}>🔊 Say it again</button>
                {HIDDEN.test(m.content) && m.revealed === false && (
                  <button type="button" onClick={() => setMessages((all) => all.map((x, k) => (k === i ? { ...x, revealed: true } : x)))} style={{ background: "var(--ios-fill)", border: "none", borderRadius: 999, padding: "8px 14px", fontSize: 16, fontWeight: 700, color: "var(--ios-label)", cursor: "pointer" }}>👀 Show me</button>
                )}
              </div>
            )}
          </div>
        ))}
        {busy && <div style={{ fontSize: 18, color: "var(--ios-label-3)" }}>Buddy is thinking…</div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {quick.map((q) => <button key={q} type="button" onClick={() => send(q)} style={{ background: "var(--ios-fill)", border: "none", borderRadius: 999, padding: "10px 14px", fontSize: 16, fontWeight: 700, color: "var(--ios-label)", cursor: "pointer" }}>{q}</button>)}
      </div>
      {ears.supported && (
        <button type="button" onClick={ears.listening ? ears.stop : ears.start} disabled={busy} style={{ ...bigBtn(ears.listening ? "#FF4D42" : "#2ACF5F"), marginTop: 14 }}>
          {ears.listening ? (heard ? `“${heard}”` : "🎤 Listening… tap when done") : "🎤 Talk to Buddy"}
        </button>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder={ears.supported ? "or type here…" : "Ask Buddy…"} style={{ flex: 1, padding: "14px", borderRadius: 16, border: "2px solid var(--ios-separator)", fontSize: 20, background: "var(--ios-bg-elevated)", color: "var(--ios-label)" }} />
        <button type="button" onClick={() => send(input)} disabled={busy || !input.trim()} style={{ ...bigBtn("var(--ios-tint)"), width: "auto", padding: "0 20px", fontSize: 18 }}>Send</button>
      </div>
    </>
  );
}
