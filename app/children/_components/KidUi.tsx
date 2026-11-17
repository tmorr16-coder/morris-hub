"use client";

// The pieces of the child's screen: Buddy the owl, the learning path, the
// level bar, the explore tiles and the confetti.
//
// The model is Khan Academy Kids: a character who talks to you, one obvious
// thing to do next, colour and size doing the work that words do for adults,
// and progress you can see. A six-year-old reads slowly, so every piece here
// says what it is with a picture first and at most three or four words.

import type { CSSProperties, ReactNode } from "react";

/** Fixed, vivid colours. They carry white text in both light and dark themes. */
export const KID = {
  green: "#22B573", greenDark: "#17895A",
  blue: "#3D8BFD", blueDark: "#2A66C4",
  orange: "#FF8A3D", orangeDark: "#D9661E",
  purple: "#8B5CF6", purpleDark: "#6B3FD4",
  pink: "#EC4E8A", pinkDark: "#C13069",
  gold: "#F5B301", goldDark: "#C48A00",
  teal: "#14B8C4", tealDark: "#0C8C96",
} as const;

export const KID_CSS = `
@keyframes kidBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes kidTalk { 0%,100% { transform: scale(1) rotate(0) } 25% { transform: scale(1.06) rotate(-3deg) } 75% { transform: scale(1.06) rotate(3deg) } }
@keyframes kidThink { 0%,100% { transform: rotate(-6deg) } 50% { transform: rotate(6deg) } }
@keyframes kidRing { 0% { transform: scale(1); opacity: .55 } 100% { transform: scale(1.55); opacity: 0 } }
@keyframes kidPop { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
@keyframes kidFall { 0% { transform: translateY(-10vh) rotate(0); opacity: 1 } 100% { transform: translateY(105vh) rotate(540deg); opacity: .9 } }
.kid-press { transition: transform .08s ease; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.kid-press:active { transform: translateY(3px) scale(.98); }
.kid-press:focus-visible { outline: 4px solid var(--ios-tint); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  .kid-anim, .kid-anim * { animation: none !important; }
  .kid-confetti { display: none !important; }
}
`;

// ── Levels ──────────────────────────────────────────────────────────────────
// Stars were a number that only went up. A level turns them into somewhere to
// get to: ten stars a level, each with a name, and a bar that fills.
const LEVELS = [
  { name: "Egg", emoji: "🥚" }, { name: "Hatchling", emoji: "🐣" }, { name: "Chick", emoji: "🐥" },
  { name: "Owlet", emoji: "🦉" }, { name: "Flyer", emoji: "🪽" }, { name: "Explorer", emoji: "🧭" },
  { name: "Star Finder", emoji: "🌟" }, { name: "Moon Scout", emoji: "🌙" }, { name: "Rocket Owl", emoji: "🚀" },
  { name: "Wise Owl", emoji: "🎓" },
];
export const STARS_PER_LEVEL = 10;
export function levelFor(totalStars: number) {
  const safe = Math.max(0, Math.floor(totalStars || 0));
  const index = Math.min(LEVELS.length - 1, Math.floor(safe / STARS_PER_LEVEL));
  const top = index === LEVELS.length - 1;
  const into = top ? STARS_PER_LEVEL : safe - index * STARS_PER_LEVEL;
  return { number: index + 1, ...LEVELS[index], into, need: STARS_PER_LEVEL, toGo: top ? 0 : STARS_PER_LEVEL - into, next: top ? null : LEVELS[index + 1] };
}

export function LevelBar({ stars, streak }: { stars: number; streak: number }) {
  const lv = levelFor(stars);
  const pct = Math.round((lv.into / lv.need) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--ios-cell)", border: "1px solid var(--ios-separator)", borderRadius: 20, padding: "10px 14px" }}>
      <span aria-hidden style={{ fontSize: 30, lineHeight: 1 }}>{lv.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Level {lv.number} · {lv.name}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ios-label-2)", whiteSpace: "nowrap" }}>{lv.next ? `${lv.toGo} ⭐ to ${lv.next.emoji}` : "Top level!"}</span>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={lv.need} aria-valuenow={lv.into} aria-label={`Level ${lv.number} progress`}
          style={{ height: 12, borderRadius: 999, background: "var(--ios-fill)", marginTop: 6, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${KID.gold}, ${KID.orange})`, transition: "width .5s ease" }} />
        </div>
      </div>
      <div style={{ display: "grid", justifyItems: "center", gap: 0, paddingLeft: 4 }}>
        <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.1, whiteSpace: "nowrap" }}>⭐ {stars}</span>
        {streak > 0 && <span style={{ fontSize: 13, fontWeight: 800, color: KID.orangeDark, whiteSpace: "nowrap" }}>🔥 {streak} day{streak === 1 ? "" : "s"}</span>}
      </div>
    </div>
  );
}

// ── Buddy ───────────────────────────────────────────────────────────────────
export type Mood = "idle" | "talking" | "listening" | "thinking" | "cheer";

export function Mascot({ mood = "idle", size = 84 }: { mood?: Mood; size?: number }) {
  const anim = mood === "talking" ? "kidTalk .7s ease-in-out infinite"
    : mood === "thinking" ? "kidThink 1.1s ease-in-out infinite"
    : mood === "cheer" ? "kidTalk .45s ease-in-out infinite"
    : "kidBob 3s ease-in-out infinite";
  const ring = mood === "listening" ? KID.green : mood === "talking" ? KID.orange : null;
  return (
    <span className="kid-anim" aria-hidden style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "inline-grid", placeItems: "center" }}>
      {ring && <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `4px solid ${ring}`, animation: "kidRing 1.2s ease-out infinite" }} />}
      <span style={{ width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: size * 0.58, lineHeight: 1,
        background: "linear-gradient(160deg, #FFE7B8, #FFC56B)", boxShadow: "0 6px 0 rgba(0,0,0,.12)", animation: anim }}>
        🦉
      </span>
    </span>
  );
}

/** What Buddy is saying, in a bubble you can tap to hear again. */
export function Bubble({ children, onTap, side = "left" }: { children: ReactNode; onTap?: () => void; side?: "left" | "top" }) {
  const tail: CSSProperties = side === "left"
    ? { left: -9, top: 26, borderRight: "10px solid var(--ios-cell)", borderTop: "8px solid transparent", borderBottom: "8px solid transparent" }
    : { top: -9, left: "50%", marginLeft: -8, borderBottom: "10px solid var(--ios-cell)", borderLeft: "8px solid transparent", borderRight: "8px solid transparent" };
  const inner = (
    <>
      <span aria-hidden style={{ position: "absolute", width: 0, height: 0, ...tail }} />
      {children}
      {onTap && <span aria-hidden style={{ marginLeft: 8, fontSize: 18, opacity: 0.7 }}>🔊</span>}
    </>
  );
  const style: CSSProperties = { position: "relative", background: "var(--ios-cell)", border: "none", borderRadius: 22, padding: "14px 18px", fontSize: 20, fontWeight: 700, lineHeight: 1.35, color: "var(--ios-label)", textAlign: "left", boxShadow: "0 4px 0 rgba(0,0,0,.08)", flex: 1, minWidth: 0 };
  return onTap
    ? <button type="button" className="kid-press" onClick={onTap} style={{ ...style, cursor: "pointer" }}>{inner}</button>
    : <div style={style}>{inner}</div>;
}

// ── The path ────────────────────────────────────────────────────────────────
// Today's jobs as stepping stones, top to bottom, weaving left and right. The
// next one is green and pulsing; finished ones turn gold. Nothing is locked: a
// child who wants the third one first can have it.
export function PathNode({ emoji, label, state, offset, stars = 0, onTap }: {
  emoji: string; label: string; state: "done" | "next" | "todo" | "trophy" | "trophy-won"; offset: number; stars?: number; onTap?: () => void;
}) {
  const colour = state === "done" ? [KID.gold, KID.goldDark]
    : state === "next" ? [KID.green, KID.greenDark]
    : state === "trophy-won" ? [KID.gold, KID.goldDark]
    : state === "trophy" ? ["var(--ios-fill)", "var(--ios-separator)"]
    : [KID.blue, KID.blueDark];
  const size = state === "next" ? 104 : 88;
  const body = (
    <span style={{ position: "relative", width: size, height: size, display: "grid", placeItems: "center" }}>
      {state === "next" && <span className="kid-anim" style={{ position: "absolute", inset: 0 }}><span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `5px solid ${KID.green}`, animation: "kidRing 1.4s ease-out infinite" }} /></span>}
      <span style={{ width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: size * 0.46, lineHeight: 1,
        background: colour[0], boxShadow: `0 8px 0 ${colour[1]}`, filter: state === "trophy" ? "grayscale(1)" : undefined, opacity: state === "trophy" ? 0.7 : 1 }}>
        {state === "done" ? "✅" : emoji}
      </span>
      {state === "next" && <span style={{ position: "absolute", top: -14, background: "#fff", color: KID.greenDark, fontSize: 14, fontWeight: 900, letterSpacing: "0.08em", borderRadius: 999, padding: "4px 12px", boxShadow: "0 3px 0 rgba(0,0,0,.15)" }}>START</span>}
    </span>
  );
  const text = (
    <span style={{ display: "block", marginTop: 14, maxWidth: 190, fontSize: 18, fontWeight: 800, lineHeight: 1.2, textAlign: "center",
      color: state === "done" ? "var(--ios-label-2)" : "var(--ios-label)", textDecoration: state === "done" ? "line-through" : "none" }}>
      {label}
      {state === "done" && stars > 0 && <span style={{ display: "block", textDecoration: "none", fontSize: 16 }}>{"⭐".repeat(Math.min(5, stars))}</span>}
    </span>
  );
  const wrap: CSSProperties = { display: "grid", justifyItems: "center", transform: `translateX(${offset}px)`, background: "none", border: "none", padding: 0, color: "inherit" };
  return onTap
    ? <button type="button" className="kid-press" onClick={onTap} style={{ ...wrap, cursor: "pointer" }}>{body}{text}</button>
    : <div style={wrap}>{body}{text}</div>;
}

/** The dotted trail between two stones. */
export function PathTrail({ from, to }: { from: number; to: number }) {
  return (
    <div aria-hidden style={{ height: 34, display: "grid", placeItems: "center", transform: `translateX(${(from + to) / 2}px)` }}>
      <span style={{ display: "grid", gap: 6 }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ios-separator)", transform: `translateX(${((to - from) / 4) * (i - 1)}px)` }} />)}
      </span>
    </div>
  );
}

// ── Explore tiles ───────────────────────────────────────────────────────────
export function Tile({ emoji, label, colour, dark, onTap, wide = false }: { emoji: string; label: string; colour: string; dark: string; onTap: () => void; wide?: boolean }) {
  return (
    <button type="button" className="kid-press" onClick={onTap}
      style={{ gridColumn: wide ? "1 / -1" : undefined, display: "flex", alignItems: "center", gap: 12, minHeight: 84, padding: "14px 16px", borderRadius: 22, border: "none",
        background: colour, boxShadow: `0 6px 0 ${dark}`, color: "#fff", cursor: "pointer", textAlign: "left" }}>
      <span aria-hidden style={{ fontSize: 38, lineHeight: 1 }}>{emoji}</span>
      <span style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.15 }}>{label}</span>
    </button>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ios-label-2)", margin: "26px 0 12px" }}>{children}</h2>;
}

// ── Celebration ─────────────────────────────────────────────────────────────
const BITS = ["⭐", "🎉", "✨", "🌟", "🎈", "💛"];
export function Confetti() {
  return (
    <div className="kid-confetti" aria-hidden style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 49 }}>
      {Array.from({ length: 26 }, (_, i) => (
        <span key={i} style={{ position: "absolute", top: 0, left: `${(i * 37) % 100}%`, fontSize: 20 + ((i * 7) % 18),
          animation: `kidFall ${1.3 + ((i * 13) % 10) / 10}s linear ${((i * 11) % 6) / 10}s both` }}>
          {BITS[i % BITS.length]}
        </span>
      ))}
    </div>
  );
}

/** Dots along the top of a run of questions: which one you are on, which are behind you. */
export function StepDots({ total, at }: { total: number; at: number }) {
  const shown = Math.min(total, 14);
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={at} aria-label={`Word ${at + 1} of ${total}`} style={{ display: "flex", gap: 5, flex: 1 }}>
      {Array.from({ length: shown }, (_, i) => {
        const idx = Math.round((i / Math.max(1, shown - 1)) * (total - 1));
        return <span key={i} style={{ flex: 1, height: 12, borderRadius: 999, background: idx < at ? KID.green : idx === at ? KID.gold : "var(--ios-fill)" }} />;
      })}
    </div>
  );
}
