"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EXERCISE_LIBRARY, suggestNext, type SetLog } from "../exercise-library";
import { updateSet } from "../actions";
import { createWorkoutSession, saveSet, finishSession, saveCardioBlocks, deleteSession, type CardioBlock } from "../actions";
import PostWorkoutSummary from "./PostWorkoutSummary";

// ── style tokens ──────────────────────────────────────────────────────────────

const eyebrow: React.CSSProperties = {
  fontSize: 9, fontWeight: 500, letterSpacing: "0.14em",
  textTransform: "uppercase", color: "var(--color-ink-4)",
};

function formatTime(sec: number) {
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
}

// ── component ─────────────────────────────────────────────────────────────────

interface Session { id: string; exerciseIds: string[] }

interface WorkoutTrackerProps {
  initialExercises?: typeof EXERCISE_LIBRARY;
  initialWarmup?:   boolean;
  initialCooldown?: boolean;
  initialCardio?:   CardioBlock;
}

export default function WorkoutTracker({ initialExercises, initialWarmup, initialCooldown, initialCardio }: WorkoutTrackerProps = {}) {
  const exercises = initialExercises ?? EXERCISE_LIBRARY;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const createdRef = useRef(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const [session, setSession]         = useState<Session | null>(null);
  const [creating, setCreating]       = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);

  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [setLogs, setSetLogs] = useState<(SetLog | null)[][]>(
    exercises.map((ex) => Array<SetLog | null>(ex.target.sets).fill(null))
  );
  const [activeSetIdx, setActiveSetIdx] = useState(0);
  const [inputReps,    setInputReps]    = useState("");
  const [inputWeight,  setInputWeight]  = useState("");
  const [inputRpe,     setInputRpe]     = useState(7);

  const [restRemaining, setRestRemaining] = useState(0);
  const [restTotal,     setRestTotal]     = useState(0);
  const restRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sessionStart]   = useState(() => Date.now());
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [showSummary,    setShowSummary]    = useState(false);
  const [finalElapsed,   setFinalElapsed]   = useState(0);

  // Collapsible sections
  const [showCues,     setShowCues]     = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);

  // Session controls
  const [paused,         setPaused]         = useState(false);
  const [showMenu,       setShowMenu]       = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);

  // Inline set editing
  const [editingSet,     setEditingSet]     = useState<{ exIdx: number; setIdx: number } | null>(null);
  const [editReps,       setEditReps]       = useState("");
  const [editWeight,     setEditWeight]     = useState("");

  // Stretching + cardio extras
  const [warmup,         setWarmup]         = useState(initialWarmup   ?? false);
  const [cooldown,       setCooldown]       = useState(initialCooldown ?? false);
  const [cardioBlocks,   setCardioBlocks]   = useState<CardioBlock[]>(initialCardio ? [initialCardio] : []);
  const [showCardioForm, setShowCardioForm] = useState(false);
  const [cardioType,     setCardioType]     = useState("Running");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  const [cardioPace,     setCardioPace]     = useState("");  // "9:30" format
  const [cardioHr,       setCardioHr]       = useState("");  // avg BPM

  // ── effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;
    createWorkoutSession(
      initialExercises ? exercises.map((ex) => ({ name: ex.name, muscles: ex.muscles })) : undefined
    ).then((result) => {
      if (result.error) setCreateError(result.error);
      else setSession({ id: result.sessionId, exerciseIds: result.exerciseIds });
      setCreating(false);
    });
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setSessionElapsed(Math.floor((Date.now() - sessionStart) / 1000)), 1000);
    return () => clearInterval(id);
  }, [sessionStart, paused]);

  useEffect(() => {
    if (restRemaining <= 0) return;
    restRef.current = setTimeout(() => setRestRemaining((r) => r - 1), 1000);
    return () => { if (restRef.current) clearTimeout(restRef.current); };
  }, [restRemaining]);

  const currentEx = exercises[currentExIdx];
  const suggested = suggestNext(currentEx.lastSession, currentEx.target);

  useEffect(() => {
    setInputWeight(suggested.weight.toString());
    setInputReps(suggested.reps.toString());
    setInputRpe(7);
    setShowCues(false);
    setShowPrevious(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExIdx, activeSetIdx]);

  // Scroll active exercise tab into view
  useEffect(() => {
    if (!tabsRef.current) return;
    const tab = tabsRef.current.children[currentExIdx] as HTMLElement | undefined;
    tab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [currentExIdx]);

  // ── derived ───────────────────────────────────────────────────────────────

  const totalSets     = exercises.reduce((s, ex) => s + ex.target.sets, 0);
  const completedSets = setLogs.flat().filter(Boolean).length;
  const progressPct   = (completedSets / totalSets) * 100;
  const totalVolume   = setLogs.flat().filter(Boolean).reduce((s, log) => s + log!.reps * log!.weight, 0);
  const allSetsDone   = completedSets === totalSets;

  // ── handlers ─────────────────────────────────────────────────────────────

  const handleLogSet = () => {
    const reps   = parseInt(inputReps)    || 0;
    const weight = parseFloat(inputWeight) || 0;
    if (reps === 0 || weight === 0) return;

    const setNumber = activeSetIdx + 1;
    const newLogs = setLogs.map((row) => [...row]);
    newLogs[currentExIdx][activeSetIdx] = { reps, weight, rpe: inputRpe };
    setSetLogs(newLogs);

    setRestRemaining(currentEx.restSec);
    setRestTotal(currentEx.restSec);

    if (activeSetIdx < currentEx.target.sets - 1) {
      setActiveSetIdx(activeSetIdx + 1);
    } else if (currentExIdx < exercises.length - 1) {
      setCurrentExIdx(currentExIdx + 1);
      setActiveSetIdx(0);
    }

    if (session?.exerciseIds[currentExIdx]) {
      startTransition(async () => {
        await saveSet({ exerciseId: session.exerciseIds[currentExIdx], setNumber, reps, weight, rpe: inputRpe });
      });
    }
  };

  const handleFinish = () => {
    setFinalElapsed(sessionElapsed);
    setShowSummary(true);
  };

  const handleSaveAndReturn = () => {
    startTransition(async () => {
      if (session) await finishSession(session.id, Math.round(sessionElapsed / 60));
      const extras: CardioBlock[] = [
        ...(warmup   ? [{ type: "Stretching (warm-up)",  durationMin: 5 }] : []),
        ...cardioBlocks,
        ...(cooldown ? [{ type: "Stretching (cool-down)", durationMin: 5 }] : []),
      ];
      if (extras.length) await saveCardioBlocks(extras);
      router.push("/health");
    });
  };

  const handleEditSet = (exIdx: number, setIdx: number) => {
    const log = setLogs[exIdx][setIdx];
    if (!log) return;
    setEditingSet({ exIdx, setIdx });
    setEditReps(String(log.reps));
    setEditWeight(String(log.weight));
  };

  const handleSaveEdit = () => {
    if (!editingSet) return;
    const { exIdx, setIdx } = editingSet;
    const reps = parseInt(editReps) || 0;
    const weight = parseFloat(editWeight) || 0;
    if (reps === 0 || weight === 0) { setEditingSet(null); return; }
    const existing = setLogs[exIdx][setIdx];
    const newLogs = setLogs.map((row) => [...row]);
    newLogs[exIdx][setIdx] = { reps, weight, rpe: existing?.rpe ?? 7 };
    setSetLogs(newLogs);
    setEditingSet(null);
    if (session?.exerciseIds[exIdx]) {
      startTransition(async () => {
        await updateSet({ exerciseId: session!.exerciseIds[exIdx], setNumber: setIdx + 1, reps, weight, rpe: existing?.rpe ?? 7 });
      });
    }
  };

  const handleAddCardio = () => {
    const dur = parseFloat(cardioDuration);
    if (!dur || dur <= 0) return;
    const dist = parseFloat(cardioDistance);
    // Parse pace "9:30" → 9.5 min/mile
    const paceRaw = cardioPace.trim();
    let paceVal: number | undefined;
    if (paceRaw) {
      const [pMin, pSec] = paceRaw.split(":").map(Number);
      if (!isNaN(pMin)) paceVal = pMin + (pSec ?? 0) / 60;
    }
    const hr = parseInt(cardioHr);
    setCardioBlocks((prev) => [...prev, {
      type: cardioType,
      durationMin: dur,
      ...(dist > 0 ? { distanceMiles: dist } : {}),
      ...(paceVal != null ? { paceMinPerMile: paceVal } : {}),
      ...(hr > 0 ? { hrAvg: hr } : {}),
    }]);
    setCardioDuration(""); setCardioDistance(""); setCardioPace(""); setCardioHr("");
    setShowCardioForm(false);
  };

  const handleDelete = () => {
    startTransition(async () => {
      if (session) await deleteSession(session.id);
      router.push("/health");
    });
  };

  const jumpToExercise = (i: number) => {
    setCurrentExIdx(i);
    const next = setLogs[i].findIndex((s) => s === null);
    setActiveSetIdx(next === -1 ? exercises[i].target.sets - 1 : next);
  };

  // ── early returns ─────────────────────────────────────────────────────────

  if (showSummary) {
    return (
      <PostWorkoutSummary
        exercises={exercises}
        setLogs={setLogs}
        sessionElapsed={finalElapsed}
        onDone={handleSaveAndReturn}
      />
    );
  }

  if (creating) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", color: "var(--color-ink-3)", gap: 12 }}>
        Starting session…
      </div>
    );
  }

  if (createError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh", gap: 16, padding: "0 24px" }}>
        <div style={{ color: "var(--color-accent)", textAlign: "center" }}>Failed to start session: {createError}</div>
        <button
          onClick={() => router.push("/health")}
          style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid var(--color-line)", background: "var(--color-bg-raised)", color: "var(--color-ink-2)", cursor: "pointer", fontFamily: "inherit" }}
        >
          ← Back
        </button>
      </div>
    );
  }

  const currentExSets = setLogs[currentExIdx];
  const activeSetDone = currentExSets[activeSetIdx] !== null;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--color-ink)", maxWidth: 540, margin: "0 auto" }}>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: "var(--color-bg)",
          borderBottom: "1px solid var(--color-line)",
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px" }}>
          {/* Session label + volume */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {paused ? "⏸ Paused" : "Active session"}
            </div>
            {totalVolume > 0 && (
              <div style={{ fontSize: 11, color: "var(--color-moss)", marginTop: 2 }}>
                {totalVolume.toLocaleString()} lbs · {completedSets}/{totalSets} sets
              </div>
            )}
          </div>

          {/* Timer */}
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: paused ? "var(--color-ink-3)" : "var(--color-moss)", flexShrink: 0 }}>
            {formatTime(sessionElapsed)}
          </div>

          {/* Finish (when all sets done) */}
          {allSetsDone && (
            <button
              onClick={handleFinish}
              style={{
                padding: "7px 12px", borderRadius: 8, border: "none",
                background: "var(--color-moss)", color: "#fff",
                fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                cursor: "pointer", flexShrink: 0,
              }}
            >
              ✓ Done
            </button>
          )}

          {/* Session menu button */}
          <button
            onClick={() => { setShowMenu((v) => !v); setConfirmDelete(false); }}
            style={{
              width: 34, height: 34, borderRadius: 8, border: "1px solid var(--color-line)",
              background: showMenu ? "var(--color-bg-sunk)" : "var(--color-bg-raised)",
              color: "var(--color-ink-3)", fontSize: 18, cursor: "pointer",
              fontFamily: "inherit", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ⋯
          </button>
        </div>

        {/* Session control menu */}
        {showMenu && (
          <div style={{ borderTop: "1px solid var(--color-line)", background: "var(--color-bg-raised)", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Pause / Resume — only once workout is active */}
            {completedSets > 0 && (
              <button
                onClick={() => { setPaused((v) => !v); setShowMenu(false); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--color-line)", background: "var(--color-bg-sunk)", color: "var(--color-ink)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
              >
                <span style={{ fontSize: 16 }}>{paused ? "▶" : "⏸"}</span>
                {paused ? "Resume session" : "Pause session"}
              </button>
            )}

            {/* Stop early — only once workout is active */}
            {completedSets > 0 && (
              <button
                onClick={() => { setShowMenu(false); handleFinish(); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--color-line)", background: "var(--color-bg-sunk)", color: "var(--color-ink)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
              >
                <span style={{ fontSize: 16 }}>■</span>
                Stop &amp; save session
              </button>
            )}

            {/* Delete — always available so you can bail before logging anything */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--color-line)", background: "var(--color-bg-sunk)", color: "var(--color-accent)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
              >
                <span style={{ fontSize: 16 }}>🗑</span>
                Delete session
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleDelete}
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "none", background: "var(--color-accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--color-line)", background: "var(--color-bg-sunk)", color: "var(--color-ink-3)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        <div style={{ height: 3, background: "var(--color-bg-sunk)", overflow: "hidden" }}>
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              background: "var(--color-moss)",
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>

      {/* ── Exercise tabs ─────────────────────────────────────────────────── */}
      <div
        ref={tabsRef}
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 16px",
          overflowX: "auto",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          borderBottom: "1px solid var(--color-line)",
        }}
      >
        {exercises.map((ex, i) => {
          const done    = setLogs[i].filter(Boolean).length;
          const isDone  = done === ex.target.sets;
          const isActive = i === currentExIdx;
          return (
            <button
              key={i}
              onClick={() => jumpToExercise(i)}
              style={{
                flexShrink: 0,
                padding: "7px 12px",
                borderRadius: 20,
                border: `1px solid ${isActive ? "var(--color-accent)" : isDone ? "var(--color-moss)" : "var(--color-line)"}`,
                background: isActive ? "var(--color-accent-soft)" : isDone ? "var(--color-bg-sunk)" : "var(--color-bg-raised)",
                color: isActive ? "var(--color-accent)" : isDone ? "var(--color-moss)" : "var(--color-ink-3)",
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {isDone ? "✓ " : ""}{ex.name.split(" ").slice(0, 2).join(" ")}
              {!isDone && <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>{done}/{ex.target.sets}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 16px 100px" }}>

        {/* Exercise heading */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...eyebrow, marginBottom: 4 }}>
            Exercise {currentExIdx + 1} of {exercises.length}
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 26,
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "var(--color-ink)",
              lineHeight: 1.1,
              marginBottom: 4,
            }}
          >
            {currentEx.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
            {currentEx.target.sets} × {currentEx.target.reps} @ {currentEx.target.weight} lbs
            <span style={{ marginLeft: 8, color: "var(--color-ink-4)" }}>Rest {currentEx.restSec}s</span>
          </div>
        </div>

        {/* Smart coach hint */}
        {suggested.hint && (
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: "10px 12px",
              background: "var(--color-bg-raised)",
              border: "1px solid var(--color-line)",
              borderRadius: 10,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: "var(--color-accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: 14,
              }}
            >
              💡
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...eyebrow, marginBottom: 2 }}>Coach</div>
              <div style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.4 }}>
                {suggested.hint}
              </div>
            </div>
          </div>
        )}

        {/* Set history */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...eyebrow, marginBottom: 6 }}>Sets</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {Array.from({ length: currentEx.target.sets }).map((_, i) => {
              const log      = currentExSets[i];
              const lastSet  = currentEx.lastSession.sets[i];
              const isActive = i === activeSetIdx && !log;
              const isDone   = !!log;
              const isPR     = isDone && lastSet && log!.weight * log!.reps > lastSet.weight * lastSet.reps;

              return (
                <div
                  key={i}
                  onClick={() => !isDone && setActiveSetIdx(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 11px",
                    borderRadius: 9,
                    background: isActive ? "var(--color-accent-soft)" : "var(--color-bg-raised)",
                    border: `1px solid ${isActive ? "var(--color-accent)" : "var(--color-line)"}`,
                    cursor: !isDone ? "pointer" : "default",
                  }}
                >
                  {/* Set indicator */}
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      background: isDone ? "var(--color-moss)" : isActive ? "var(--color-accent-soft)" : "var(--color-bg-sunk)",
                      border: isActive && !isDone ? "1.5px solid var(--color-accent)" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      color: isDone ? "#fff" : isActive ? "var(--color-accent)" : "var(--color-ink-4)",
                      flexShrink: 0,
                    }}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>

                  {/* Log or placeholder */}
                  {isDone ? (
                    editingSet?.exIdx === currentExIdx && editingSet?.setIdx === i ? (
                      /* Inline edit mode */
                      <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          type="number"
                          value={editReps}
                          onChange={(e) => setEditReps(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingSet(null); }}
                          placeholder="reps"
                          style={{ width: 54, padding: "4px 6px", borderRadius: 6, border: "1.5px solid var(--color-accent)", fontSize: 13, fontFamily: "var(--font-mono)", textAlign: "center", outline: "none" }}
                          autoFocus
                        />
                        <span style={{ fontSize: 11, color: "var(--color-ink-4)" }}>×</span>
                        <input
                          type="number"
                          value={editWeight}
                          onChange={(e) => setEditWeight(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingSet(null); }}
                          placeholder="lbs"
                          style={{ width: 60, padding: "4px 6px", borderRadius: 6, border: "1.5px solid var(--color-accent)", fontSize: 13, fontFamily: "var(--font-mono)", textAlign: "center", outline: "none" }}
                        />
                        <button onClick={handleSaveEdit} style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: "var(--color-accent)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✓</button>
                        <button onClick={() => setEditingSet(null)} style={{ padding: "4px 6px", borderRadius: 6, border: "1px solid var(--color-line)", background: "transparent", color: "var(--color-ink-3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                      </div>
                    ) : (
                      <div
                        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, overflow: "hidden", cursor: "pointer" }}
                        onClick={() => handleEditSet(currentExIdx, i)}
                        title="Tap to edit"
                      >
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--color-ink)", flexShrink: 0 }}>
                          {log!.reps} × {log!.weight}lb
                        </span>
                        <span style={{ fontSize: 11, color: "var(--color-ink-4)", flexShrink: 0 }}>@ {log!.rpe}</span>
                        {isPR && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-moss)", flexShrink: 0 }}>↑ PR</span>
                        )}
                        <span style={{ fontSize: 9, color: "var(--color-ink-4)", marginLeft: "auto", flexShrink: 0 }}>edit</span>
                      </div>
                    )
                  ) : (
                    <div style={{ flex: 1 }}>
                      {isActive ? (
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-accent)" }}>Logging now</span>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--color-ink-4)" }}>
                          {lastSet ? `Last: ${lastSet.reps} × ${lastSet.weight}lb` : "—"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Active set input */}
        {!activeSetDone && (
          <div
            style={{
              background: "var(--color-bg-raised)",
              border: "1px solid var(--color-line)",
              borderRadius: 14,
              padding: "12px 14px",
              marginBottom: 12,
            }}
          >
            <div style={{ ...eyebrow, color: "var(--color-accent)", marginBottom: 10 }}>
              Log set {activeSetIdx + 1} of {currentEx.target.sets}
            </div>

            {/* Reps + Weight steppers */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {[
                {
                  label: "Reps",
                  value: inputReps,
                  onChange: setInputReps,
                  step: 1,
                  onMinus: () => setInputReps((r) => String(Math.max(0, parseInt(r || "0") - 1))),
                  onPlus:  () => setInputReps((r) => String(parseInt(r || "0") + 1)),
                },
                {
                  label: "Weight (lb)",
                  value: inputWeight,
                  onChange: setInputWeight,
                  step: 5,
                  onMinus: () => setInputWeight((w) => String(Math.max(0, parseFloat(w || "0") - 5))),
                  onPlus:  () => setInputWeight((w) => String(parseFloat(w || "0") + 5)),
                },
              ].map(({ label, value, onChange, onMinus, onPlus }) => (
                <div key={label}>
                  <div style={{ ...eyebrow, marginBottom: 8 }}>{label}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      onClick={onMinus}
                      style={{
                        width: 40, height: 46, borderRadius: 10,
                        border: "1px solid var(--color-line)",
                        background: "var(--color-bg-sunk)",
                        color: "var(--color-ink)", fontSize: 20, cursor: "pointer",
                        fontFamily: "inherit", flexShrink: 0,
                      }}
                    >
                      −
                    </button>
                    <input
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      type="number"
                      inputMode="decimal"
                      style={{
                        flex: 1, height: 46,
                        background: "var(--color-bg-sunk)",
                        border: "1px solid var(--color-line)",
                        borderRadius: 10,
                        color: "var(--color-ink)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 20,
                        fontWeight: 700,
                        textAlign: "center",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={onPlus}
                      style={{
                        width: 40, height: 46, borderRadius: 10,
                        border: "1px solid var(--color-line)",
                        background: "var(--color-bg-sunk)",
                        color: "var(--color-ink)", fontSize: 20, cursor: "pointer",
                        fontFamily: "inherit", flexShrink: 0,
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* RPE */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={eyebrow}>RPE</span>
                <span style={{ fontSize: 11, color: "var(--color-ink-3)" }}>
                  {inputRpe <= 6 ? "Easy" : inputRpe === 7 ? "3 reps left" : inputRpe === 8 ? "2 reps left" : inputRpe === 9 ? "1 rep left" : "Max effort"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setInputRpe(n)}
                    style={{
                      flex: 1,
                      padding: "12px 0",
                      borderRadius: 10,
                      border: `1.5px solid ${inputRpe === n ? (n >= 9 ? "var(--color-accent)" : "var(--color-slate)") : "var(--color-line)"}`,
                      background: inputRpe === n ? (n >= 9 ? "var(--color-accent-soft)" : "var(--color-bg-raised)") : "var(--color-bg-raised)",
                      color: inputRpe === n ? (n >= 9 ? "var(--color-accent)" : "var(--color-slate)") : "var(--color-ink-3)",
                      fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Log button */}
            <button
              onClick={handleLogSet}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                border: "none",
                background: "var(--color-ink)",
                color: "var(--color-bg)",
                fontFamily: "inherit",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.02em" }}>
                Log Set {activeSetIdx + 1}
              </span>
              <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>
                then start {currentEx.restSec}s rest
              </span>
            </button>
          </div>
        )}

        {/* Exercise complete */}
        {currentExSets.every(Boolean) && (
          <div
            style={{
              background: "var(--color-bg-raised)",
              border: "1px solid var(--color-moss)",
              borderRadius: 14,
              padding: "20px 16px",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>✓</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--color-moss)" }}>
              Exercise complete
            </div>
            {currentExIdx < exercises.length - 1 && (
              <button
                onClick={() => jumpToExercise(currentExIdx + 1)}
                style={{
                  marginTop: 12,
                  padding: "11px 22px",
                  borderRadius: 10,
                  border: "none",
                  background: "var(--color-ink)",
                  color: "var(--color-bg)",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Next: {exercises[currentExIdx + 1].name} →
              </button>
            )}
          </div>
        )}

        {/* Previous session (collapsible) */}
        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-line)",
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          <button
            onClick={() => setShowPrevious((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 14px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <span style={{ ...eyebrow, marginBottom: 0 }}>Last session · {currentEx.lastSession.date}</span>
            <span style={{ fontSize: 14, color: "var(--color-ink-4)", transition: "transform 120ms", display: "inline-block", transform: showPrevious ? "rotate(180deg)" : "none" }}>
              ▾
            </span>
          </button>
          {showPrevious && (
            <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
              {currentEx.lastSession.sets.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    background: "var(--color-bg-sunk)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "var(--color-ink-4)", fontWeight: 600 }}>Set {i + 1}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-2)" }}>
                    {s.reps} × {s.weight}lb
                    <span style={{ color: s.rpe >= 9 ? "var(--color-accent)" : "var(--color-ink-4)", marginLeft: 8 }}>@ {s.rpe}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form cues (collapsible) */}
        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-line)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setShowCues((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 14px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <span style={{ ...eyebrow, marginBottom: 0 }}>Form cues</span>
            <span style={{ fontSize: 14, color: "var(--color-ink-4)", display: "inline-block", transform: showCues ? "rotate(180deg)" : "none" }}>
              ▾
            </span>
          </button>
          {showCues && (
            <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              {currentEx.cues.map((cue, i) => (
                <div
                  key={i}
                  style={{
                    padding: "8px 10px",
                    background: "var(--color-bg-sunk)",
                    borderLeft: "2px solid var(--color-accent)",
                    borderRadius: "0 6px 6px 0",
                    fontSize: 12,
                    color: "var(--color-ink-2)",
                    lineHeight: 1.5,
                  }}
                >
                  {cue}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Extras: stretching + cardio ──────────────────────────────────────── */}
      <div style={{ padding: "0 16px 16px" }}>
        <div style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px" }}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Cardio</div>

            {cardioBlocks.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", background: "var(--color-bg-sunk)", borderRadius: 8, marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-ink)" }}>{b.type}</span>
                  <span style={{ fontSize: 11, color: "var(--color-ink-4)", marginLeft: 8 }}>
                    {b.durationMin} min
                    {b.distanceMiles ? ` · ${b.distanceMiles} mi` : ""}
                    {b.paceMinPerMile ? ` · ${Math.floor(b.paceMinPerMile)}:${String(Math.round((b.paceMinPerMile % 1) * 60)).padStart(2, "0")}/mi` : ""}
                    {b.hrAvg ? ` · ${b.hrAvg} bpm` : ""}
                  </span>
                  {b.hrAvg && (
                    <span style={{ display: "inline-block", marginLeft: 8, fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 6, background: ["", "#e8f4e8", "#b8e0b8", "#f4e8a8", "#f4c08a", "#f4a0a0"][Math.min(5, Math.max(1, Math.round(b.hrAvg / 220 < 0.6 ? 1 : b.hrAvg / 220 < 0.7 ? 2 : b.hrAvg / 220 < 0.8 ? 3 : b.hrAvg / 220 < 0.9 ? 4 : 5)))], color: "#2f3a47" }}>
                      Z{b.hrAvg / 220 < 0.6 ? 1 : b.hrAvg / 220 < 0.7 ? 2 : b.hrAvg / 220 < 0.8 ? 3 : b.hrAvg / 220 < 0.9 ? 4 : 5}
                    </span>
                  )}
                </div>
                <button onClick={() => setCardioBlocks((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "var(--color-ink-4)", fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>×</button>
              </div>
            ))}

            {showCardioForm ? (
              <div style={{ background: "var(--color-bg-sunk)", borderRadius: 10, padding: "12px" }}>
                <select value={cardioType} onChange={(e) => setCardioType(e.target.value)} style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--color-line)", background: "var(--color-bg-raised)", color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit", marginBottom: 8 }}>
                  {["Running", "Walking", "Cycling", "Other", "Jumping Jacks", "Jump Rope"].map((t) => <option key={t}>{t}</option>)}
                </select>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <input value={cardioDuration} onChange={(e) => setCardioDuration(e.target.value)} placeholder="Duration (min)" type="number" min="1" style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid var(--color-line)", background: "var(--color-bg-raised)", color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" }} />
                  {["Running", "Cycling", "Walking"].includes(cardioType) && (
                    <input value={cardioDistance} onChange={(e) => setCardioDistance(e.target.value)} placeholder="Distance (mi)" type="number" min="0" step="0.1" style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid var(--color-line)", background: "var(--color-bg-raised)", color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" }} />
                  )}
                  {["Running", "Walking"].includes(cardioType) && (
                    <input value={cardioPace} onChange={(e) => setCardioPace(e.target.value)} placeholder="Pace (mm:ss/mi)" style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid var(--color-line)", background: "var(--color-bg-raised)", color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" }} />
                  )}
                  <input value={cardioHr} onChange={(e) => setCardioHr(e.target.value)} placeholder="Avg HR (bpm)" type="number" min="40" max="220" style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid var(--color-line)", background: "var(--color-bg-raised)", color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleAddCardio} disabled={!cardioDuration} style={{ flex: 2, padding: "9px 0", borderRadius: 8, border: "none", background: cardioDuration ? "var(--color-ink)" : "var(--color-bg-sunk)", color: cardioDuration ? "var(--color-bg)" : "var(--color-ink-4)", fontSize: 13, fontWeight: 600, cursor: cardioDuration ? "pointer" : "not-allowed", fontFamily: "inherit" }}>Add</button>
                  <button onClick={() => setShowCardioForm(false)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid var(--color-line)", background: "transparent", color: "var(--color-ink-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowCardioForm(true)} style={{ width: "100%", padding: "9px", borderRadius: 8, border: "1.5px dashed var(--color-line-2)", background: "transparent", color: "var(--color-ink-3)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                + Add cardio to this session
              </button>
            )}
          </div>

          <div style={{ padding: "12px 14px 10px", borderTop: "1px solid var(--color-line)" }}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Stretching</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[["🧘 Warm-up", warmup, () => setWarmup((v) => !v)] as const,
                ["🧘 Cool-down", cooldown, () => setCooldown((v) => !v)] as const].map(([label, active, toggle]) => (
                <button key={label} onClick={toggle} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${active ? "var(--color-moss)" : "var(--color-line)"}`, background: active ? "var(--color-moss-soft)" : "var(--color-bg-sunk)", color: active ? "var(--color-moss)" : "var(--color-ink-3)", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating rest timer ──────────────────────────────────────────────── */}
      {restRemaining > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 76,
            left: "50%",
            transform: "translateX(-50%)",
            width: "calc(100% - 32px)",
            maxWidth: 380,
            background: "var(--color-bg-raised)",
            border: `1.5px solid ${restRemaining <= 10 ? "var(--color-accent)" : "var(--color-moss)"}`,
            borderRadius: 18,
            padding: "14px 18px",
            zIndex: 50,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ ...eyebrow }}>Rest timer</div>
            <div style={{ fontSize: 11, color: "var(--color-ink-4)" }}>Set {activeSetIdx + 1} next</div>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 44,
              fontWeight: 700,
              color: restRemaining <= 10 ? "var(--color-accent)" : "var(--color-moss)",
              textAlign: "center",
              lineHeight: 1,
              marginBottom: 8,
            }}
          >
            {formatTime(restRemaining)}
          </div>
          <div style={{ height: 4, background: "var(--color-bg-sunk)", borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
            <div
              style={{
                width: `${(restRemaining / restTotal) * 100}%`,
                height: "100%",
                background: restRemaining <= 10 ? "var(--color-accent)" : "var(--color-moss)",
                transition: "width 1s linear",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setRestRemaining((r) => Math.max(0, r - 15))}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10,
                border: "1px solid var(--color-line)",
                background: "var(--color-bg-sunk)",
                color: "var(--color-ink-3)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              −15s
            </button>
            {[15, 30].map((s) => (
              <button
                key={s}
                onClick={() => setRestRemaining((r) => r + s)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10,
                  border: "1px solid var(--color-line)",
                  background: "var(--color-bg-sunk)",
                  color: "var(--color-ink-2)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                +{s}s
              </button>
            ))}
            <button
              onClick={() => setRestRemaining(0)}
              style={{
                flex: 2, padding: "10px 0", borderRadius: 10,
                border: "none",
                background: "var(--color-ink)",
                color: "var(--color-bg)", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Skip →
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
