"use client";

// Buddy's workbook, on the child's screen.
//
// One problem to a page. Buddy says it, the child writes the answer with the
// pencil, and the page marks itself a moment after the pencil lifts — no
// keyboard, no Send button, nothing to read first. A miss gets a second go,
// then the answer to trace, and comes back once at the end (Kumon's
// corrections). The set is short enough to finish in one sitting.

import { useCallback, useEffect, useRef, useState } from "react";
import { startWorkbook, recordWorkbook } from "../_lib/learning-actions";
import { answerOf, labelOf, matches, MATH_LEVELS, type WorkItem, type WorkResult } from "../_lib/workbook";

type Phase = "loading" | "writing" | "checking" | "right" | "retry" | "trace" | "selfcheck" | "done" | "error";

/**
 * How long the page waits after the pencil lifts before it marks.
 * A first grader pauses between letters and between the digits of "15", so
 * the wait has to outlast that pause without making a finished answer feel
 * ignored. A half-written answer that is read early is not marked at all
 * (see the prefix rule in check), so these can stay short.
 */
const WAIT_NUMBER_MS = 1700;
const WAIT_WORD_MS = 2800;
const WAIT_TRACE_MS = 2000;
/** How long a miss stays on the page before it is wiped, so the child sees what was marked. */
const SHOW_MISS_MS = 1100;

const INK = "#1c3d8f";

/** A short two-note chime: instant, where a spoken "Yes!" would talk over the next question. */
function chime(good: boolean) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const notes = good ? [660, 880] : [330];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.25);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.12); o.stop(ctx.currentTime + i * 0.12 + 0.3);
    });
    setTimeout(() => ctx.close().catch(() => undefined), 800);
  } catch { /* no sound is fine */ }
}

/**
 * The writing box. Pointer events, so the Apple Pencil's pressure thickens the
 * line; once a pencil has been seen, fingers and the resting palm are ignored.
 */
function usePad(onInk: () => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const penSeen = useRef(false);
  const hasInk = useRef(false);
  /** Goes up with every stroke, so a mark for an older picture can be thrown away. */
  const strokes = useRef(0);
  const inkCb = useRef(onInk);
  useEffect(() => { inkCb.current = onInk; });

  const size = useCallback(() => {
    const c = ref.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = c.getBoundingClientRect();
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = INK;
    hasInk.current = false;
  }, []);
  useEffect(() => { size(); }, [size]);

  const at = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent) => {
    if (e.pointerType === "pen") penSeen.current = true;
    if (penSeen.current && e.pointerType === "touch") return;      // the palm
    e.preventDefault();
    ref.current!.setPointerCapture(e.pointerId);
    drawing.current = true; last.current = at(e);
    const ctx = ref.current!.getContext("2d")!;
    ctx.beginPath(); ctx.arc(last.current.x, last.current.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
    hasInk.current = true; strokes.current += 1; inkCb.current();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    if (penSeen.current && e.pointerType === "touch") return;
    const p = at(e);
    const ctx = ref.current!.getContext("2d")!;
    ctx.lineWidth = e.pointerType === "pen" ? 3 + (e.pressure || 0.5) * 5 : 6;
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
  };
  const up = () => { if (drawing.current) { drawing.current = false; last.current = null; inkCb.current(); } };

  const clear = useCallback(() => { size(); }, [size]);
  /** The answer as a small picture on white, for the reader. */
  const snapshot = useCallback((): string | null => {
    const c = ref.current; if (!c || !hasInk.current) return null;
    const scale = Math.min(1, 700 / c.width);
    const out = document.createElement("canvas");
    out.width = Math.round(c.width * scale); out.height = Math.round(c.height * scale);
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(c, 0, 0, out.width, out.height);
    return out.toDataURL("image/png");
  }, []);
  return { ref, down, move, up, clear, snapshot, hasInk, drawing, strokes };
}

export default function Workbook({ childId, first, speak, onBack, onFinish }: {
  childId: string; first: string;
  speak: (t: string, rate?: number) => void;
  onBack: () => void;
  onFinish: (stars: number, firstTry: number, total: number) => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [queue, setQueue] = useState<WorkItem[]>([]);
  const [pos, setPos] = useState(0);
  const [total, setTotal] = useState(0);
  const [level, setLevel] = useState(1);
  const [tries, setTries] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const results = useRef<Map<string, WorkResult>>(new Map());
  const corrected = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>("loading");
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const item = queue[pos] ?? null;

  const say = useCallback((it: WorkItem) => {
    if (it.type === "spell") speak(`Write the word: ${it.word}.`, 0.9);
    else if (it.type === "copy") speak(`Write this word: ${it.word}.`, 0.9);
    else speak(`${it.a} ${it.op === "+" ? "plus" : "take away"} ${it.b}`, 0.95);
  }, [speak]);

  // The pencil lifted: wait a breath, then mark it. A new stroke resets the wait.
  const pad = usePad(() => {
    if (timer.current) clearTimeout(timer.current);
    if (phaseRef.current !== "writing" && phaseRef.current !== "retry" && phaseRef.current !== "trace") return;
    if (pad.drawing.current) return;
    const wait = phaseRef.current === "trace" ? WAIT_TRACE_MS : item?.type === "math" ? WAIT_NUMBER_MS : WAIT_WORD_MS;
    timer.current = setTimeout(() => { void check(); }, wait);
  });

  useEffect(() => {
    let alive = true;
    startWorkbook(childId).then((r) => {
      if (!alive) return;
      if (r.error || !r.items?.length) { setPhase("error"); return; }
      setQueue(r.items); setTotal(r.items.length); setLevel(r.level ?? 1); setPhase("writing");
      say(r.items[0]);
    });
    return () => { alive = false; if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, [childId]);

  function record(it: WorkItem, firstTry: boolean, n: number) {
    if (!results.current.has(it.id)) results.current.set(it.id, { id: it.id, label: labelOf(it), firstTry, tries: n });
  }

  function advance(missed: boolean) {
    if (!item) return;
    let q = queue;
    // Corrections: a missed page comes back once, at the end.
    if (missed && !corrected.current.has(item.id)) { corrected.current.add(item.id); q = [...queue, item]; setQueue(q); }
    const next = pos + 1;
    if (next >= q.length) { void finish(); return; }
    setPos(next); setTries(0); setNote(null); setHint(false); pad.clear(); setPhase("writing");
    say(q[next]);
  }

  async function check(asked = false) {
    if (!item || !pad.hasInk.current) return;
    if (phaseRef.current === "trace") { advance(true); return; }
    const image = pad.snapshot();
    if (!image) return;
    const before = phaseRef.current;
    const inkAt = pad.strokes.current;
    setPhase("checking");
    let read: string | null = null;
    try {
      const res = await fetch("/api/children/workbook/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId, image, kind: item.type === "math" ? "number" : "word" }) });
      if (res.ok) read = String((await res.json()).read ?? "");
    } catch { /* fall through to self-check */ }

    // The reader is down: show the answer and let the child mark it, the way a
    // paper workbook's answer page does.
    if (read === null) { setPhase("selfcheck"); return; }

    // More was written while the page was looking: that mark is for an old
    // picture. Say nothing and wait for the pencil to stop again.
    if (pad.strokes.current !== inkAt) { setPhase(before); return; }

    // Half an answer is not a wrong answer. "1" on the way to "15", or "ca" on
    // the way to "cake", was read too soon: leave the ink and keep waiting.
    // (Tapping Done says "this is my answer", so then it is marked as written.)
    const want = answerOf(item);
    if (!asked && read !== "" && read !== want && want.startsWith(read)) { setPhase(before); return; }

    if (read === "") {
      setNote("I couldn't read that. Write it a little bigger!");
      speak("I couldn't read that. Try a little bigger.", 1);
      setPhase(before);
      setTimeout(() => pad.clear(), SHOW_MISS_MS);
      return;
    }

    const n = tries + 1;
    if (matches(item, read)) {
      record(item, n === 1 && !corrected.current.has(item.id), n);
      chime(true); setPhase("right");
      setTimeout(() => advance(false), 900);
      return;
    }

    // A miss. The ladder is the same every time, so it is never a surprise:
    // try again → a hint → the answer to trace. The answer comes last.
    chime(false);
    setTries(n);
    if (n === 1) {
      setNote("Not yet. Try one more time!");
      setPhase("retry");
      if (item.type !== "math") speak(`Not yet. Listen again: ${item.word}.`, 0.85);
      setTimeout(() => pad.clear(), SHOW_MISS_MS);
    } else if (n === 2) {
      setHint(true);
      setNote(item.type === "math" ? "Here's a hint. Count the dots!" : "Here's a hint. Listen to each sound.");
      setPhase("retry");
      speak(item.type === "math" ? "Here's a hint. Count the dots." : `Here's a hint. It starts with ${item.word[0]}. ${item.word}.`, 0.85);
      setTimeout(() => pad.clear(), SHOW_MISS_MS);
    } else {
      record(item, false, n);
      setNote("Here it is. Trace over it!");
      speak(item.type === "math" ? `It's ${item.answer}. Trace it.` : `Here is ${item.word}. Trace it.`, 0.9);
      setTimeout(() => { pad.clear(); setPhase("trace"); }, SHOW_MISS_MS);
    }
  }

  function selfMark(right: boolean) {
    if (!item) return;
    record(item, right && tries === 0 && !corrected.current.has(item.id), tries + 1);
    chime(right);
    advance(!right);
  }

  async function finish() {
    setPhase("done");
    const all = [...results.current.values()];
    const firstTry = all.filter((r) => r.firstTry).length;
    const math = all.filter((r) => /\d/.test(r.label));
    const r = await recordWorkbook(childId, { level, results: all, mathFirstTry: math.filter((m) => m.firstTry).length, mathTotal: math.length });
    onFinish(r.stars ?? 1, firstTry, all.length);
  }

  if (phase === "loading") return <div style={{ fontSize: 24, fontWeight: 800, textAlign: "center", marginTop: 80 }}>Getting your pages…</div>;
  if (phase === "error") return (
    <div style={{ textAlign: "center", marginTop: 60 }}>
      <div style={{ fontSize: 24, fontWeight: 800 }}>The pages didn&rsquo;t open.</div>
      <button type="button" onClick={onBack} style={{ marginTop: 18, fontSize: 20, fontWeight: 800, padding: "14px 22px", borderRadius: 16, border: "none", background: "var(--ios-fill)", color: "var(--ios-label)" }}>← Back</button>
    </div>
  );
  if (phase === "done" || !item) return <div style={{ fontSize: 26, fontWeight: 800, textAlign: "center", marginTop: 80 }}>All done, {first}! ⭐</div>;

  const done = Math.min(pos, total);
  const isCorrection = pos >= total;
  const showAnswer = phase === "trace" || phase === "selfcheck";
  const border = phase === "right" ? "#2ACF5F" : phase === "retry" || phase === "trace" ? "#FF9F0A" : "var(--ios-separator)";

  return (
    <div style={{ userSelect: "none", WebkitUserSelect: "none" }}>
      {/* Where you are: dots, not numbers to read. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={onBack} aria-label="Stop" style={{ background: "var(--ios-fill)", border: "none", borderRadius: 999, width: 44, height: 44, fontSize: 20, fontWeight: 800, color: "var(--ios-label)", flexShrink: 0 }}>✕</button>
        <div style={{ display: "flex", gap: 5, flex: 1, flexWrap: "wrap" }}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} style={{ flex: 1, minWidth: 10, height: 10, borderRadius: 5, background: i < done ? "#2ACF5F" : i === done && !isCorrection ? "var(--ios-tint)" : "var(--ios-fill)" }} />
          ))}
        </div>
      </div>
      {isCorrection && <div style={{ fontSize: 16, fontWeight: 700, color: "#FF9F0A", marginTop: 8 }}>One more look at this one</div>}

      {/* The question */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, margin: "22px 0 14px", minHeight: 84 }}>
        {item.type === "math" && <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "0.02em", fontVariantNumeric: "tabular-nums" }}>{item.a} {item.op === "-" ? "−" : "+"} {item.b} =</div>}
        {item.type === "copy" && <div style={{ fontSize: 60, fontWeight: 700, letterSpacing: "0.08em" }}>{item.word}</div>}
        {item.type === "spell" && <div style={{ fontSize: 26, fontWeight: 800, color: "var(--ios-label-2)" }}>Write the word you hear</div>}
        <button type="button" onClick={() => say(item)} aria-label="Hear it again" style={{ background: "var(--ios-tint)", color: "#fff", border: "none", borderRadius: 999, width: 60, height: 60, fontSize: 26, flexShrink: 0, boxShadow: "0 4px 0 rgba(0,0,0,0.18)" }}>🔊</button>
      </div>

      {/* The hint, after two misses: something to work it out with, not the answer. */}
      {hint && phase !== "trace" && phase !== "right" && (
        item.type === "math" ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, marginBottom: 12, flexWrap: "wrap" }}>
            {item.op === "+" ? (
              <>
                <Dots n={item.a} colour="#3B82F6" />
                <span style={{ fontSize: 30, fontWeight: 800 }}>+</span>
                <Dots n={item.b} colour="#F59E0B" />
              </>
            ) : <Dots n={item.a} colour="#3B82F6" crossed={item.b} />}
          </div>
        ) : (
          <div style={{ textAlign: "center", fontSize: 44, fontWeight: 800, letterSpacing: "0.3em", marginBottom: 12, color: "var(--ios-label-2)" }}>
            {item.word[0]}{"_".repeat(item.word.length - 1)}
          </div>
        )
      )}

      {/* The writing box */}
      <div style={{ position: "relative", height: item.type === "math" ? 230 : 250, borderRadius: 22, background: "#fff", border: `4px solid ${border}`, overflow: "hidden", transition: "border-color 0.15s" }}>
        {/* A writing line, like ruled paper */}
        <div style={{ position: "absolute", left: 18, right: 18, bottom: 58, borderBottom: "2px dashed #c9d3e6", pointerEvents: "none" }} />
        {showAnswer && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: item.type === "math" ? 150 : Math.min(130, 620 / Math.max(3, answerOf(item).length)), fontWeight: 700, color: "#d5dbe8", letterSpacing: "0.06em", pointerEvents: "none" }}>
            {answerOf(item)}
          </div>
        )}
        <canvas
          ref={pad.ref}
          onPointerDown={pad.down} onPointerMove={pad.move} onPointerUp={pad.up} onPointerCancel={pad.up}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: "crosshair" }}
        />
        {phase === "right" && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 120, pointerEvents: "none" }}>⭐</div>}
        {phase === "checking" && <div style={{ position: "absolute", right: 14, top: 10, fontSize: 30, pointerEvents: "none" }}>👀</div>}
      </div>

      {note && phase !== "right" && <div style={{ fontSize: 20, fontWeight: 700, color: "#C9700A", marginTop: 10, textAlign: "center" }}>{note}</div>}

      {phase === "selfcheck" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <button type="button" onClick={() => selfMark(true)} style={{ padding: 18, borderRadius: 18, border: "none", background: "#2ACF5F", color: "#fff", fontSize: 22, fontWeight: 800 }}>👍 I got it</button>
          <button type="button" onClick={() => selfMark(false)} style={{ padding: 18, borderRadius: 18, border: "none", background: "#FF9F0A", color: "#fff", fontSize: 22, fontWeight: 800 }}>Not yet</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, marginTop: 14 }}>
          <button type="button" onClick={() => { if (timer.current) clearTimeout(timer.current); pad.clear(); }} disabled={phase === "checking" || phase === "right"} style={{ padding: "16px 22px", borderRadius: 18, border: "none", background: "var(--ios-fill)", color: "var(--ios-label)", fontSize: 22, fontWeight: 800 }}>🧽 Erase</button>
          <button type="button" onClick={() => { if (timer.current) clearTimeout(timer.current); void check(true); }} disabled={phase === "checking" || phase === "right"} style={{ padding: 16, borderRadius: 18, border: "none", background: "#2ACF5F", color: "#fff", fontSize: 22, fontWeight: 800, boxShadow: "0 5px 0 rgba(0,0,0,0.18)" }}>
            {phase === "checking" ? "Looking…" : "✓ Done"}
          </button>
        </div>
      )}
      <div style={{ fontSize: 13, color: "var(--ios-label-3)", textAlign: "center", marginTop: 12 }}>Math: {MATH_LEVELS[level - 1]}</div>
    </div>
  );
}

/** Counters for a hint: rows of five, like a ten-frame; the last `crossed` are struck out for taking away. */
function Dots({ n, colour, crossed = 0 }: { n: number; colour: string; crossed?: number }) {
  if (n > 30) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 22px)", gap: 6 }}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} style={{ width: 22, height: 22, borderRadius: 11, background: i >= n - crossed ? "transparent" : colour, border: `3px solid ${colour}`, opacity: i >= n - crossed ? 0.45 : 1, position: "relative" }}>
          {i >= n - crossed && <span style={{ position: "absolute", left: -3, right: -3, top: 7, borderTop: `3px solid ${colour}`, transform: "rotate(-45deg)" }} />}
        </span>
      ))}
    </div>
  );
}
