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
import type { CloudVoice } from "@/lib/buddy-voice";
import type { ChildTask } from "../_lib/learning";
import { completeTask, markWordPracticed } from "../_lib/learning-actions";
import { Bubble, Confetti, KID, KID_CSS, LevelBar, Mascot, PathNode, PathTrail, SectionTitle, StepDots, Tile, levelFor, type Mood } from "./KidUi";

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
  /** Buddy's own voices on this deployment (Kokoro, OpenAI), best first.
      Empty means the device voice only. */
  cloudVoices?: CloudVoice[];
  /** On the child's own iPad (/kid): no links into the grown-ups' pages,
      which would only ask for an account the iPad does not have. */
  kidMode?: boolean;
  /** Days in a row with a finished job, counting today or yesterday as the latest. */
  streak?: number;
}

type View = { kind: "home" } | { kind: "task"; task: ChildTask } | { kind: "practice" } | { kind: "tutor"; starter?: string };

/** Things to do with Buddy. One tap starts each; nothing to type or read first. */
interface Activity { emoji: string; label: string; prompt: string; lead: string; colour: string; dark: string }
function activitiesFor(hasWords: boolean): Activity[] {
  return [
    ...(hasWords ? [
      { emoji: "🔤", label: "Quiz my words", prompt: "Quiz me on my spelling words, one at a time.", lead: "Word quiz!", colour: KID.blue, dark: KID.blueDark },
      { emoji: "📖", label: "Silly story", prompt: "Tell me a silly story with my spelling words.", lead: "Story time!", colour: KID.purple, dark: KID.purpleDark },
    ] : []),
    { emoji: "➕", label: "Math game", prompt: "Let's play a math game. Give me one problem at a time.", lead: "Math game!", colour: KID.teal, dark: KID.tealDark },
    { emoji: "🙏", label: "My verse", prompt: "Help me learn my memory verse, a little bit at a time.", lead: "Let's learn your verse!", colour: KID.pink, dark: KID.pinkDark },
    { emoji: "🦁", label: "Animal facts", prompt: "Tell me one amazing animal fact, then ask me a question about it.", lead: "Animal facts!", colour: KID.green, dark: KID.greenDark },
  ];
}

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

// A tenth of a second of silence, as a WAV. Played once inside a real tap so
// iOS marks the element as user-activated; after that Buddy may speak without
// one, which he must, because most of what he says follows a network round
// trip and the gesture is long gone by the time the audio arrives. It carries
// real samples: an empty data chunk is a decode error on some iOS versions,
// and an element that errored is not an element that played.
let silence: string | null = null;
function silentWav(): string {
  if (silence) return silence;
  const rate = 8000, samples = rate / 10, bytes = 44 + samples * 2;
  const b = new DataView(new ArrayBuffer(bytes));
  const str = (o: number, t: string) => { for (let i = 0; i < t.length; i++) b.setUint8(o + i, t.charCodeAt(i)); };
  str(0, "RIFF"); b.setUint32(4, bytes - 8, true); str(8, "WAVE");
  str(12, "fmt "); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, rate, true); b.setUint32(28, rate * 2, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true);
  str(36, "data"); b.setUint32(40, samples * 2, true);
  let bin = "";
  for (let i = 0; i < bytes; i++) bin += String.fromCharCode(b.getUint8(i));
  silence = `data:audio/wav;base64,${btoa(bin)}`;
  return silence;
}

/** What the grown-up is told when Buddy's own voice cannot be had. */
const CLOUD_TROUBLE: Record<string, string> = {
  billing: "MAI voices are paused: the voice account is out of credits. Until a grown-up tops it up, Buddy uses the device voice below.",
  rate: "MAI voices are catching their breath (too many requests). Buddy is using the device voice for a few minutes.",
  provider: "MAI voices can\u2019t be reached right now. Buddy is using the device voice below.",
};

/** Voices are stored with a prefix saying which kind they are; a bare name is a legacy device choice.
 *  The cloud prefix predates Kokoro and is kept so saved choices survive. */
const CLOUD_PREFIX = "openai:";
const DEVICE_PREFIX = "device:";

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

function useSpeech(childId: string, voices: CloudVoice[]) {
  const cloudAvailable = voices.length > 0;
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const rateRef = useRef(0.92);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [choices, setChoices] = useState<SpeechSynthesisVoice[]>([]);
  const [loading, setLoading] = useState(false);

  // Which cloud voice is in use, or null for "the device". Cloud is the better
  // voice, so it is what you get when it is available and nothing was chosen;
  // picking a device voice sticks.
  const pref = useSyncExternalStore(subscribeVoicePref, readVoicePref, () => null);
  //
  // A device voice only wins when it was chosen from the picker that also
  // offered the cloud voices — stored with the "device:" prefix. A bare name
  // is a choice made before the cloud voices existed, and it was keeping the
  // better voice off every iPad that had ever tried Fred.
  //
  // A saved cloud voice the deployment no longer offers (an OpenAI name after
  // the move to Kokoro) falls through to the best voice it does have.
  const saved = pref?.startsWith(CLOUD_PREFIX) ? pref.slice(CLOUD_PREFIX.length) : null;
  const cloudVoice = !cloudAvailable
    ? null
    : saved
      ? (voices.some((v) => v.id === saved) ? saved : voices[0].id)
      : pref?.startsWith(DEVICE_PREFIX)
        ? null
        : voices[0].id;

  // One element for the life of the screen. A fresh Audio() per phrase would
  // need unlocking per phrase, which iOS will not grant.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  // After the route fails, Buddy goes straight to the device voice for a while
  // rather than paying a round trip to be told no on every sentence. The code
  // is shown to the grown-up, who is the only one who can do anything about it.
  const cloudDownRef = useRef<{ until: number; code: string } | null>(null);
  const [cloudTrouble, setCloudTrouble] = useState<string | null>(null);
  // iOS will not start speech synthesis outside a tap until it has started it
  // inside one. The first phrase after a cloud failure arrives outside a tap,
  // so the tap that asked for it also speaks nothing, once, to open the door.
  const primedRef = useRef(false);
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
      const deviceChoice = chosen?.startsWith(DEVICE_PREFIX) ? chosen.slice(DEVICE_PREFIX.length)
        : chosen && !chosen.startsWith(CLOUD_PREFIX) ? chosen : null;
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
    writeVoicePref(DEVICE_PREFIX + name);
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
    primedRef.current = true;
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
    const down = cloudDownRef.current;
    if (down && down.until > Date.now()) { deviceSpeak(said, pace); return; }
    if (down) cloudDownRef.current = null;
    const voice = cloudVoice;

    // Unlock inside the tap. Everything after this point may happen a second
    // later, off the back of a fetch, with no gesture in sight.
    const el = audioRef.current ?? (audioRef.current = new Audio());
    if (!unlockedRef.current) {
      el.src = silentWav();
      el.play().then(() => { unlockedRef.current = true; }).catch(() => { /* the next tap will do */ });
    }
    // And the fallback's door too, while there is still a tap to open it with.
    if (!primedRef.current && typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        window.speechSynthesis.speak(u);
        primedRef.current = true;
      } catch { /* then the device voice was never going to work here either */ }
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
      .then(async (r) => {
        if (r.ok) {
          if (genRef.current === gen) setCloudTrouble(null);
          return r.blob();
        }
        // Remember why, and for how long. Out of credits is not going to fix
        // itself in the next sentence; a 429 might in a minute.
        const code = (await r.json().catch(() => null))?.code as string | undefined;
        const kind = code && code in CLOUD_TROUBLE ? code : r.status === 429 ? "rate" : "provider";
        cloudDownRef.current = { until: Date.now() + (kind === "billing" ? 30 : 3) * 60_000, code: kind };
        setCloudTrouble(CLOUD_TROUBLE[kind]);
        throw new Error(String(r.status));
      })
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

  // The footer names the voice that is actually talking. While the cloud is
  // down that is the device voice, whatever was picked.
  const label = cloudVoice && !cloudTrouble
    ? (voices.find((v) => v.id === cloudVoice)?.label ?? cloudVoice)
    : voiceName;

  return { speak, stop, speaking, loading, voiceName, voiceLabel: label, cloudVoice, cloudTrouble, choices, choose };
}

/**
 * Listen, using the device's own speech recognition (Safari and Chrome both
 * have it; iOS has had it since 14.5). Typing is a lot to ask of a first
 * grader; talking is not. Returns null where the device cannot do it, and the
 * button is simply not drawn.
 */
const noSubscribe = () => () => {};
const hasRecognition = () => !!((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition);

function useListening(
  onResult: (text: string, final: boolean) => void,
  /** A listen ended. `heard` is false for silence; `blocked` when the browser refused the microphone. */
  onEnd?: (heard: boolean, blocked: boolean) => void,
) {
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const heardRef = useRef(false);
  const blockedRef = useRef(false);
  const endCb = useRef(onEnd);
  useEffect(() => { endCb.current = onEnd; });
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
      if (text.trim()) heardRef.current = true;
      cb.current(text.trim(), final);
    };
    rec.onend = () => { setListening(false); endCb.current?.(heardRef.current, blockedRef.current); };
    rec.onerror = (e: any) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") blockedRef.current = true;
      setListening(false);
    };
    recRef.current = rec;
    return () => { try { rec.abort(); } catch { /* already stopped */ } };
  }, [supported]);
  const start = useCallback(() => {
    if (!recRef.current) return;
    heardRef.current = false; blockedRef.current = false;
    try { window.speechSynthesis?.cancel(); recRef.current.start(); setListening(true); } catch { setListening(false); endCb.current?.(false, true); }
  }, []);
  const stop = useCallback(() => { try { recRef.current?.stop(); } catch { /* fine */ } }, []);
  return { supported, listening, start, stop };
}

const big: React.CSSProperties = { fontSize: 28, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.01em" };
const cardStyle: React.CSSProperties = { background: "var(--ios-cell)", borderRadius: 22, padding: "18px 20px", boxShadow: "0 8px 24px -16px rgba(0,0,0,0.4)", border: "1px solid var(--ios-separator)" };
const bigBtn = (bg: string, ledge = "rgba(0,0,0,0.18)"): React.CSSProperties => ({ width: "100%", padding: "18px 20px", borderRadius: 20, border: "none", background: bg, color: "#fff", fontSize: 22, fontWeight: 800, cursor: "pointer", boxShadow: `0 6px 0 ${ledge}` });

export default function KidClient({ childId, name, gradeLabel, tasks: initialTasks, exercises, spelling, stars: initialStars, openTo = "home", cloudVoices = [], kidMode = false, streak: initialStreak = 0 }: Props) {
  const { speak, stop, speaking, loading, voiceLabel, cloudVoice, cloudTrouble, choices, choose } = useSpeech(childId, cloudVoices);
  const hasCloud = cloudVoices.length > 0;
  const [pickingVoice, setPickingVoice] = useState(false);
  const first = name.split(" ")[0] || name;
  const [tasks, setTasks] = useState<ChildTask[]>(initialTasks);
  const [stars, setStars] = useState(initialStars);
  const [streak, setStreak] = useState(initialStreak);
  const [view, setView] = useState<View>(openTo === "buddy" ? { kind: "tutor" } : { kind: "home" });
  const [burst, setBurst] = useState<string | null>(null);
  const open = tasks.filter((t) => !t.completedAt);
  const doneToday = tasks.filter((t) => t.completedAt);

  const allWords = spelling ? [...spelling.words, ...spelling.sightWords] : [];
  const activities = activitiesFor(allWords.length > 0);

  function celebrate(text: string) {
    setBurst(text);
    speak(text, 1);
    setTimeout(() => setBurst(null), 2200);
  }

  function askBuddy() {
    setView({ kind: "tutor" });
    speak(`Hi ${first}! I'm Buddy. What do you want to do?`);
  }
  // The few words spoken here are inside the tap, which is what lets Buddy's
  // answer be heard on an iPad when it arrives a second later.
  function startActivity(a: Activity) {
    setView({ kind: "tutor", starter: a.prompt });
    speak(a.lead, 1);
  }

  async function finish(task: ChildTask, earned: number) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completedAt: new Date().toISOString(), stars: earned } : t)));
    setStars((s) => ({ total: s.total + earned, week: s.week + earned }));
    if (doneToday.length === 0) setStreak((n) => n + 1);   // today's first finished job
    const before = levelFor(stars.total), after = levelFor(stars.total + earned);
    celebrate(after.number > before.number
      ? `Level up! You are a ${after.name} now!`
      : `${PRAISE[Math.floor(Math.random() * PRAISE.length)]} ${earned} star${earned === 1 ? "" : "s"}!`);
    setView({ kind: "home" });
    await completeTask(childId, task.id, earned);
  }

  const voicePicker = pickingVoice ? (
          <div style={{ ...cardStyle, marginBottom: 14, padding: "12px 14px" }}>
            <div style={{ fontSize: 14, color: "var(--ios-label-2)", marginBottom: 8 }}>For grown-ups: pick the voice Buddy uses on this device. Tap a name to hear it.</div>

            {/* Buddy's own voices first. They are better than anything on the
                device by a wide margin, and they sound the same on every screen
                the family opens this on. */}
            {hasCloud && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ios-label-3)", margin: "10px 0 4px" }}>MAI voices</div>
                {cloudTrouble && (
                  <div role="status" style={{ fontSize: 14, lineHeight: "19px", color: "var(--ios-orange, #ff9500)", background: "var(--ios-fill)", borderRadius: 10, padding: "8px 10px", margin: "4px 0 8px" }}>
                    {cloudTrouble}
                  </div>
                )}
                {cloudVoices.map((v) => {
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
              {hasCloud
                ? <><strong>MAI voices need the internet.</strong> They sound far better and they sound the same on every device, but out of signal Buddy falls back to the device voice below without saying anything about it — so it is worth having a good one of those too.</>
                : <><strong>The natural ones have to be downloaded first.</strong></>}
              {" "}On the iPad or iPhone: Settings → Accessibility → Spoken Content → Voices → English → tap <em>Ava</em>, <em>Zoe</em>, <em>Evan</em> or <em>Nathan</em> and download the <em>Premium</em> version (about 200 MB each). Then close Safari fully and reopen this screen; they appear here marked Premium. The <em>Classic</em> voices — Fred, Junior, Kathy, Ralph — are a Mac thing; an iPad or iPhone does not ship them, so they only show up here on a computer.
            </div>
          </div>
  ) : null;

  // ── Home: Buddy, today's path, things to explore ────────────────────────
  if (view.kind === "home") {
    const greeting = open.length === 0
      ? (doneToday.length > 0 ? `You finished everything, ${first}! Want to explore?` : `Hi ${first}! No jobs right now. Let's explore!`)
      : doneToday.length === 0
        ? `Hi ${first}! You have ${open.length} job${open.length === 1 ? "" : "s"} today. Tap the green one!`
        : `Great going, ${first}! ${open.length} more to go.`;
    // Finished stones first, then what is left, then the trophy at the end.
    const stones = [...doneToday.map((t) => ({ t, done: true })), ...open.map((t) => ({ t, done: false }))];
    const weave = [0, 58, 0, -58];
    return (
      <Shell burst={burst} speaking={speaking} loading={loading} onStop={stop}>
        <LevelBar stars={stars.total} streak={streak} />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: 18 }}>
          <Mascot mood={speaking ? "talking" : burst ? "cheer" : "idle"} />
          <Bubble onTap={() => speak(greeting, 1)}>{greeting}</Bubble>
        </div>

        {stones.length > 0 && (
          <>
            <SectionTitle>Today&rsquo;s path</SectionTitle>
            <div style={{ display: "grid", justifyItems: "center", padding: "10px 0 4px" }}>
              {stones.map(({ t, done }, i) => (
                <div key={t.id} style={{ display: "grid", justifyItems: "center" }}>
                  {i > 0 && <PathTrail from={weave[(i - 1) % 4]} to={weave[i % 4]} />}
                  <PathNode
                    emoji={TASK_EMOJI[t.kind] ?? "⭐"}
                    label={t.title}
                    state={done ? "done" : t.id === open[0]?.id ? "next" : "todo"}
                    stars={t.stars}
                    offset={weave[i % 4]}
                    onTap={done ? undefined : () => { setView({ kind: "task", task: t }); speak(t.title); }}
                  />
                </div>
              ))}
              <PathTrail from={weave[(stones.length - 1) % 4]} to={0} />
              <PathNode emoji="🏆" label={open.length === 0 ? "All done today!" : "Finish line"} state={open.length === 0 ? "trophy-won" : "trophy"} offset={0} />
            </div>
          </>
        )}

        <SectionTitle>Explore with Buddy</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
          <Tile wide emoji="🦉" label="Talk to Buddy" colour={KID.orange} dark={KID.orangeDark} onTap={askBuddy} />
          {allWords.length > 0 && (
            <Tile emoji="✏️" label="Practice my words" colour={KID.gold} dark={KID.goldDark} onTap={() => { setView({ kind: "practice" }); speak("Let's practice your words!", 1); }} />
          )}
          {activities.map((a) => <Tile key={a.label} emoji={a.emoji} label={a.label} colour={a.colour} dark={a.dark} onTap={() => startActivity(a)} />)}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 22 }}>
          <button type="button" className="kid-press" onClick={() => speak(`Hi ${first}! Can you hear me? Let's go!`, 1)} style={{ background: "var(--ios-fill)", border: "none", borderRadius: 999, padding: "10px 16px", fontSize: 15, fontWeight: 700, color: "var(--ios-label-2)", cursor: "pointer" }}>
            🔊 Tap if you can&rsquo;t hear Buddy
          </button>
        </div>

        {voicePicker}
        <Footer
          childId={childId}
          kidMode={kidMode}
          onVoice={() => setPickingVoice((v) => !v)}
          voiceLabel={pickingVoice ? "Done" : `Voice${voiceLabel ? `: ${voiceLabel.replace(/\s*\(.*?\)/g, "")}` : ""}`}
        />
      </Shell>
    );
  }

  // ── Practising this week's words, any time, no job needed ───────────────
  if (view.kind === "practice") {
    return (
      <Shell burst={burst} speaking={speaking} loading={loading} onStop={stop}>
        <SpellingRun words={allWords} speak={speak} childId={childId} weekId={spelling?.weekId ?? null} onBack={() => setView({ kind: "home" })}
          onFinish={(right) => { celebrate(right > 0 ? `You spelled ${right} word${right === 1 ? "" : "s"}! Great practice!` : "Good try! Practice makes you stronger!"); setView({ kind: "home" }); }}
          onRight={(w) => celebrate(`${PRAISE[Math.floor(Math.random() * PRAISE.length)]} ${w}!`)} />
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
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: 14 }}>
          <Mascot mood={speaking ? "talking" : "idle"} size={72} />
          <Bubble onTap={() => speak(text ? `${t.title}. ${text}` : t.title)}>
            <span style={{ fontSize: 24, fontWeight: 800 }}>{TASK_EMOJI[t.kind] ?? "⭐"} {t.title}</span>
          </Bubble>
        </div>
        {text && <div style={{ ...cardStyle, marginTop: 14, fontSize: 21, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text}</div>}
        <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
          {text && <button type="button" className="kid-press" style={bigBtn(KID.blue, KID.blueDark)} onClick={() => speak(`${t.title}. ${text}`)}>🔊 Read it to me</button>}
          <button type="button" className="kid-press" style={bigBtn(KID.green, KID.greenDark)} onClick={() => finish(t, 1)}>⭐ I did it!</button>
          {/* Stuck is the moment help is wanted. Going Back, finding the owl and
              starting over is three taps and a lost train of thought. */}
          <button type="button" className="kid-press" style={{ ...bigBtn(KID.orange, KID.orangeDark), fontSize: 19 }}
            onClick={() => { setView({ kind: "tutor", starter: `I need help with this job: ${t.title}.${text ? ` It says: ${text.slice(0, 300)}` : ""}` }); speak("Okay, let's figure it out together!", 1); }}>
            🦉 Help me, Buddy
          </button>
        </div>
        <Footer childId={childId} kidMode={kidMode} />
      </Shell>
    );
  }

  // ── Tutor ───────────────────────────────────────────────────────────────
  return (
    <Shell burst={burst} speaking={speaking} loading={loading} onStop={stop}>
      <BackButton onClick={() => setView({ kind: "home" })} />
      <Tutor key={view.starter ?? "open"} childId={childId} first={first} gradeLabel={gradeLabel} speak={speak} speaking={speaking} stopSpeaking={stop} activities={activities} starter={view.starter} />
      <Footer childId={childId} kidMode={kidMode} />
    </Shell>
  );
}

function Shell({ children, burst, speaking, loading, onStop }: { children: React.ReactNode; burst: string | null; speaking?: boolean; loading?: boolean; onStop?: () => void }) {
  return (
    <main className="ios-scroll" style={{ padding: "max(16px, env(safe-area-inset-top)) 18px 40px", maxWidth: 620, margin: "0 auto", position: "relative" }}>
      <style>{KID_CSS}</style>
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
        <>
          <Confetti />
          <div aria-live="polite" style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 50, padding: 24 }}>
            <div className="kid-anim" style={{ display: "grid", justifyItems: "center", gap: 10, background: "var(--ios-cell)", borderRadius: 32, padding: "24px 30px", fontSize: 32, fontWeight: 900, textAlign: "center", lineHeight: 1.2, boxShadow: "0 20px 60px -20px rgba(0,0,0,0.5)", animation: "kidPop 0.35s ease-out", maxWidth: 440 }}>
              <Mascot mood="cheer" size={76} />
              {burst}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="kid-press" onClick={onClick} aria-label="Back" style={{ background: "var(--ios-fill)", border: "none", borderRadius: 999, padding: "12px 20px", fontSize: 19, fontWeight: 800, color: "var(--ios-label)", cursor: "pointer", flexShrink: 0 }}>← Back</button>;
}

function Footer({ childId, onVoice, voiceLabel, kidMode = false }: { childId: string; onVoice?: () => void; voiceLabel?: string; kidMode?: boolean }) {
  return (
    <div style={{ marginTop: 40, display: "flex", justifyContent: "center", gap: 18 }}>
      {!kidMode && <Link href={`/children/${childId}`} style={{ fontSize: 13, color: "var(--ios-label-3)", textDecoration: "none" }}>Grown-ups</Link>}
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
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <BackButton onClick={onBack} />
        <StepDots total={words.length} at={i} />
        <span style={{ fontSize: 16, fontWeight: 800, color: "var(--ios-label-2)", whiteSpace: "nowrap" }}>{i + 1}/{words.length}</span>
      </div>
      <div style={{ ...cardStyle, marginTop: 16, textAlign: "center" }}>
        <div style={{ fontSize: 18, color: "var(--ios-label-2)" }}>Listen, then spell it</div>
        <button type="button" className="kid-press" onClick={() => speak(word)} style={{ ...bigBtn(KID.blue, KID.blueDark), marginTop: 12 }}>🔊 Hear the word</button>
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
          <button type="button" className="kid-press" style={{ ...bigBtn(KID.green, KID.greenDark), opacity: typed.trim() ? 1 : 0.5 }} onClick={check} disabled={!typed.trim()}>✓ Check</button>
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

/**
 * Keep-talking limits. A conversation is meant to feel like one, not to run
 * all evening on its own: Buddy listens again after each answer, but stops
 * after two silences in a row, after a run of turns, and after a stretch of
 * time — and then it is one tap to carry on.
 */
const KEEP_TALKING_TURNS = 20;
const KEEP_TALKING_MINUTES = 15;
const KEEP_TALKING_SILENCES = 2;

function Tutor({ childId, first, gradeLabel, speak, speaking, stopSpeaking, activities, starter }: { childId: string; first: string; gradeLabel: string | null; speak: (t: string, rate?: number) => void; speaking: boolean; stopSpeaking: () => void; activities: Activity[]; starter?: string }) {
  // randomUUID needs a secure context; getRandomValues does not, so the
  // fallback is just as unguessable rather than a Math.random string.
  const [sessionId] = useState(() => (typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("")));
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; revealed?: boolean }[]>([
    { role: "assistant", content: `Hi ${first}! I'm Buddy. What do you want to do?` },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  // ── Keep talking ──────────────────────────────────────────────────────────
  // On by default once the child has used the microphone: after Buddy has
  // finished speaking, the microphone opens again by itself, so a back-and-
  // forth needs no tapping. Never while Buddy is talking — he would hear
  // himself — and never past the limits above.
  const [keepTalking, setKeepTalking] = useState(true);
  const [handsFree, setHandsFreeState] = useState(false);  // the child started with the mic
  const handsFreeRef = useRef(false);
  const setHandsFree = useCallback((v: boolean) => { handsFreeRef.current = v; setHandsFreeState(v); }, []);
  const [pausedWhy, setPausedWhy] = useState<string | null>(null);
  const run = useRef({ turns: 0, startedAt: 0, silences: 0 });
  const awaitingVoice = useRef(false);                    // a reply came back and has not finished speaking

  const pause = useCallback((why: string) => {
    setHandsFree(false);
    awaitingVoice.current = false;
    setPausedWhy(why);
  }, [setHandsFree]);

  const ears = useListening(
    (text, final) => {
      setHeard(text);
      if (final && text) { setHeard(""); run.current.silences = 0; void send(text, true); }
    },
    (heardSomething, blocked) => {
      if (!handsFreeRef.current) return;
      if (blocked) { pause("Tap the green button to talk — this device needs a tap each time."); return; }
      if (heardSomething) return;
      run.current.silences += 1;
      if (run.current.silences >= KEEP_TALKING_SILENCES) {
        pause(`Buddy stopped listening because it got quiet. Tap to keep talking, ${first}!`);
      } else {
        // One quiet turn: try once more.
        setTimeout(() => { if (handsFreeRef.current) ears.start(); }, 600);
      }
    },
  );

  function startTalking() {
    stopSpeaking();
    setPausedWhy(null);
    if (keepTalking) {
      setHandsFree(true);
      if (!run.current.startedAt || pausedWhy) run.current = { turns: 0, startedAt: Date.now(), silences: 0 };
    }
    ears.start();
  }
  function stopTalking() {
    setHandsFree(false);
    awaitingVoice.current = false;
    ears.stop();
  }

  // Buddy finished speaking: listen again, within reason.
  const wasSpeaking = useRef(false);
  useEffect(() => {
    const ended = wasSpeaking.current && !speaking;
    wasSpeaking.current = speaking;
    if (!ended || !handsFree || !awaitingVoice.current || busy || ears.listening) return;
    awaitingVoice.current = false;
    const r = run.current;
    if (r.turns >= KEEP_TALKING_TURNS) { pause(`That was a lot of great talking! Take a break, or tap to keep going.`); return; }
    if (Date.now() - r.startedAt > KEEP_TALKING_MINUTES * 60_000) { pause(`Time for a little break. Tap when you want to talk again.`); return; }
    const t = setTimeout(() => { if (handsFreeRef.current) ears.start(); }, 450);
    return () => clearTimeout(t);
  }, [speaking, handsFree, busy, ears, pause]);
  // (handsFree in the deps re-runs the check when hands-free is switched on.)

  // If the voice never starts (no sound on this device), do not wait forever.
  useEffect(() => {
    if (!handsFree || busy) return;
    const t = setTimeout(() => {
      if (handsFreeRef.current && awaitingVoice.current && !speaking && !ears.listening) { awaitingVoice.current = false; ears.start(); }
    }, 9000);
    return () => clearTimeout(t);
  }, [messages, handsFree, busy, speaking, ears]);

  async function send(text: string, byVoice = false) {
    const q = text.trim();
    if (!q || busy) return;
    // Typing or a quick button ends hands-free; the next mic tap starts it again.
    if (!byVoice) setHandsFree(false);
    else run.current.turns += 1;
    setInput("");
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/children/tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId, sessionId, messages: next.slice(-20).map((m) => ({ role: m.role, content: m.content })) }) });
      const data = await res.json();
      const reply = res.ok ? String(data.reply) : "Hmm, I got a little mixed up. Ask me again?";
      setMessages((m) => [...m, { role: "assistant", content: reply, revealed: false }]);
      if (byVoice) awaitingVoice.current = true;
      speak(forSpeech(reply));
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Hmm, I got a little mixed up. Ask me again?" }]);
    } finally {
      setBusy(false);
    }
  }

  // An activity tile or "Help me, Buddy" arrives with its first line already
  // chosen. It is sent once, a beat after the screen appears, as if the child
  // had said it.
  const started = useRef(false);
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; });
  useEffect(() => {
    if (!starter || started.current) return;
    const t = setTimeout(() => { started.current = true; void sendRef.current(starter); }, 350);
    return () => clearTimeout(t);
  }, [starter]);

  const mood: Mood = ears.listening ? "listening" : busy ? "thinking" : speaking ? "talking" : "idle";
  const status = ears.listening ? (heard ? `“${heard}”` : "I'm listening…")
    : busy ? "Hmm, let me think…"
    : speaking ? "Buddy is talking"
    : handsFree ? "Your turn!"
    : ears.supported ? "Tap the green button and talk to me" : "Type a question for me";
  const fresh = messages.length === 1 && !starter;
  const micColour = ears.listening ? ["#FF4D42", "#C7281F"] : handsFree ? [KID.orange, KID.orangeDark] : [KID.green, KID.greenDark];

  return (
    <>
      <div style={{ display: "grid", justifyItems: "center", gap: 8, margin: "10px 0 16px" }}>
        <Mascot mood={mood} size={112} />
        <div aria-live="polite" style={{ fontSize: 19, fontWeight: 800, color: "var(--ios-label-2)", textAlign: "center", minHeight: 26 }}>{status}</div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {messages.map((m, i) => m.role === "user" ? (
          <div key={i} style={{ justifySelf: "end", maxWidth: "82%", background: KID.blue, color: "#fff", borderRadius: "22px 22px 6px 22px", padding: "12px 16px", fontSize: 20, fontWeight: 600, lineHeight: 1.4 }}>{m.content}</div>
        ) : (
          <div key={i} style={{ display: "flex", alignItems: "flex-end", gap: 8, maxWidth: "94%" }}>
            <span aria-hidden style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(160deg, #FFE7B8, #FFC56B)", display: "grid", placeItems: "center", fontSize: 22, flexShrink: 0 }}>🦉</span>
            <div style={{ background: "var(--ios-cell)", border: "1px solid var(--ios-separator)", borderRadius: "22px 22px 22px 6px", padding: "12px 16px", fontSize: 21, lineHeight: 1.45, minWidth: 0 }}>
              {forScreen(m.content, m.revealed !== false)}
              {i > 0 && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" className="kid-press" onClick={() => speak(forSpeech(m.content))} style={{ background: "var(--ios-fill)", border: "none", borderRadius: 999, padding: "9px 15px", fontSize: 16, fontWeight: 800, color: "var(--ios-label)", cursor: "pointer" }}>🔊 Again</button>
                  {HIDDEN.test(m.content) && m.revealed === false && (
                    <button type="button" className="kid-press" onClick={() => setMessages((all) => all.map((x, k) => (k === i ? { ...x, revealed: true } : x)))} style={{ background: "var(--ios-fill)", border: "none", borderRadius: 999, padding: "9px 15px", fontSize: 16, fontWeight: 800, color: "var(--ios-label)", cursor: "pointer" }}>👀 Show me</button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="kid-anim" aria-hidden style={{ display: "flex", gap: 6, paddingLeft: 50 }}>
            {[0, 1, 2].map((d) => <span key={d} style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--ios-label-3)", animation: `kidBob .9s ease-in-out ${d * 0.15}s infinite` }} />)}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Before anything has been said: what Buddy can do, as pictures. After
          that the same choices shrink to a row, so the talk has the room. */}
      {fresh ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginTop: 18 }}>
          {activities.map((a) => <Tile key={a.label} emoji={a.emoji} label={a.label} colour={a.colour} dark={a.dark} onTap={() => { speak(a.lead, 1); void send(a.prompt); }} />)}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 16, overflowX: "auto", paddingBottom: 4 }}>
          {activities.map((a) => (
            <button key={a.label} type="button" className="kid-press" disabled={busy} onClick={() => send(a.prompt)}
              style={{ flexShrink: 0, background: a.colour, color: "#fff", border: "none", borderRadius: 999, padding: "10px 16px", fontSize: 16, fontWeight: 800, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
              {a.emoji} {a.label}
            </button>
          ))}
        </div>
      )}

      {ears.supported && (
        <div style={{ display: "grid", justifyItems: "center", gap: 10, marginTop: 22 }}>
          <button
            type="button"
            className="kid-press"
            onClick={ears.listening || handsFree ? stopTalking : startTalking}
            disabled={busy && !handsFree}
            aria-label={ears.listening || handsFree ? "Stop talking" : "Talk to Buddy"}
            style={{ position: "relative", width: 112, height: 112, borderRadius: "50%", border: "none", background: micColour[0], boxShadow: `0 8px 0 ${micColour[1]}`, color: "#fff", fontSize: 48, cursor: "pointer" }}
          >
            {ears.listening && <span className="kid-anim" style={{ position: "absolute", inset: 0 }}><span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "5px solid #FF4D42", animation: "kidRing 1.2s ease-out infinite" }} /></span>}
            {ears.listening ? "⏹" : handsFree ? "⏸" : "🎤"}
          </button>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ios-label-2)", textAlign: "center" }}>
            {ears.listening ? "Tap when you are done" : handsFree ? "Tap to stop" : "Tap to talk"}
          </div>
          {pausedWhy && !handsFree && <div style={{ fontSize: 17, color: "var(--ios-label-2)", textAlign: "center" }}>{pausedWhy}</div>}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <label htmlFor="buddy-type" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Type to Buddy</label>
        <input id="buddy-type" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder={ears.supported ? "or type here…" : "Ask Buddy…"} style={{ flex: 1, minWidth: 0, padding: "14px 16px", borderRadius: 18, border: "2px solid var(--ios-separator)", fontSize: 20, background: "var(--ios-bg-elevated)", color: "var(--ios-label)" }} />
        <button type="button" className="kid-press" onClick={() => send(input)} disabled={busy || !input.trim()} aria-label="Send" style={{ ...bigBtn(KID.blue, KID.blueDark), width: "auto", padding: "0 22px", fontSize: 22, opacity: busy || !input.trim() ? 0.5 : 1 }}>➤</button>
      </div>
      {ears.supported && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 14, fontSize: 13, color: "var(--ios-label-3)" }}>
          <input type="checkbox" checked={keepTalking} onChange={(e) => { setKeepTalking(e.target.checked); if (!e.target.checked) setHandsFree(false); }} />
          For grown-ups: keep the conversation going hands-free
        </label>
      )}
      <div style={{ fontSize: 13, color: "var(--ios-label-3)", textAlign: "center", marginTop: 8 }}>Buddy is a {gradeLabel ?? "school"} tutor and only talks about learning.</div>
    </>
  );
}
