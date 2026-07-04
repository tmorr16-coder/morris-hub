"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EXERCISE_LIBRARY, suggestNext, CARDIO_ACTIVITIES, getCardioActivity, type SetLog } from "../exercise-library";
import { updateSet } from "../actions";
import { createWorkoutSession, saveSet, finishSession, saveCardioBlocks, deleteSession, type CardioBlock } from "../actions";
import PostWorkoutSummary from "./PostWorkoutSummary";
import { RESUME_KEY, readSnapshot, clearSnapshot, type WorkoutSnapshot } from "../_lib/resume";

// ── style tokens ──────────────────────────────────────────────────────────────

const eyebrow: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
  textTransform: "uppercase", color: "var(--ios-label-2)",
};

function formatTime(sec: number) {
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
}

function relativeTime(ms: number) {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ── inline glyphs (stroke, currentColor) ───────────────────────────────────────

function CheckGlyph({ size = 14, stroke = "currentColor" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}
function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ transition: "transform 120ms", transform: open ? "rotate(180deg)" : "none" }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function EllipsisGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
function ReorderGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4v16M8 4L5 7M8 4l3 3M16 20V4M16 20l-3-3M16 20l3-3" />
    </svg>
  );
}
function PauseGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}
function PlayGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 5l12 7-12 7Z" />
    </svg>
  );
}
function StopGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
function TrashGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
function LeaveGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
function BulbGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5c-.7.6-1 1-1 2H9c0-1-.3-1.4-1-2A6 6 0 0 1 12 3Z" />
    </svg>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

interface Session { id: string; exerciseIds: string[] }

interface WorkoutTrackerProps {
  initialExercises?: typeof EXERCISE_LIBRARY;
  initialWarmup?:   boolean;
  initialCooldown?: boolean;
  initialCardio?:   CardioBlock;
  initialBlocks?:   CardioBlock[];
  resume?:          boolean;   // load entirely from the localStorage snapshot
}

export default function WorkoutTracker({ initialExercises, initialWarmup, initialCooldown, initialCardio, initialBlocks, resume }: WorkoutTrackerProps = {}) {
  const [exercises, setExercises] = useState(initialExercises ?? EXERCISE_LIBRARY);
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

  // Real wall-clock start. Resettable so a resumed session keeps counting from
  // the ORIGINAL start (survives an app close) rather than resetting to 0.
  const [startedAtMs, setStartedAtMs] = useState(() => Date.now());
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [showSummary,    setShowSummary]    = useState(false);
  const [finalElapsed,   setFinalElapsed]   = useState(0);

  // Resume gate: decide (in an effect, post-mount — hydration-safe) whether to
  // prompt to resume, hydrate from a snapshot, or create a fresh session.
  const [phase,       setPhase]       = useState<"deciding" | "prompt" | "ready">("deciding");
  const [pendingSnap, setPendingSnap] = useState<WorkoutSnapshot | null>(null);
  const hydratedRef = useRef(false);

  // Collapsible sections
  const [showCues,     setShowCues]     = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);

  // Session controls
  const [paused,         setPaused]         = useState(false);
  const [showMenu,       setShowMenu]       = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [showReorder,    setShowReorder]    = useState(false);

  // Inline set editing
  const [editingSet,     setEditingSet]     = useState<{ exIdx: number; setIdx: number } | null>(null);
  const [editReps,       setEditReps]       = useState("");
  const [editWeight,     setEditWeight]     = useState("");

  // Stretching + cardio extras
  const [warmup,         setWarmup]         = useState(initialWarmup   ?? false);
  const [cooldown,       setCooldown]       = useState(initialCooldown ?? false);
  const [cardioBlocks,   setCardioBlocks]   = useState<CardioBlock[]>([
    ...(initialCardio ? [initialCardio] : []),
    ...(initialBlocks ?? []),
  ]);
  const [showCardioForm, setShowCardioForm] = useState(false);
  const [cardioType,     setCardioType]     = useState("Running");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  const [cardioPace,     setCardioPace]     = useState("");  // "9:30" format
  const [cardioHr,       setCardioHr]       = useState("");  // avg BPM

  // ── effects ───────────────────────────────────────────────────────────────

  // Hydrate all tracker state from a saved snapshot (resume flow).
  const hydrateFrom = (snap: WorkoutSnapshot) => {
    createdRef.current  = true;   // never create a new session when resuming
    hydratedRef.current = true;
    setSession({ id: snap.sessionId, exerciseIds: snap.exerciseIds });
    setExercises(snap.exercises);
    setSetLogs(snap.setLogs);
    setCardioBlocks(snap.cardioBlocks ?? []);
    setWarmup(!!snap.warmup);
    setCooldown(!!snap.cooldown);
    setCurrentExIdx(snap.currentExIdx ?? 0);
    setActiveSetIdx(snap.activeSetIdx ?? 0);
    setStartedAtMs(snap.startedAtMs);   // elapsed base — real original start
    setCreating(false);
  };

  // Decide the mount behaviour once (post-mount so localStorage is safe and the
  // server render — always the non-resume UI — matches the first client render).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const snap = readSnapshot();
    if (resume) {
      // Dedicated resume entry (?resume=1, no plan): must load from snapshot.
      if (snap) { hydrateFrom(snap); setPhase("ready"); }
      else router.replace("/health/workout/builder");
      return;
    }
    if (snap) { setPendingSnap(snap); setPhase("prompt"); }
    else setPhase("ready");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Create a fresh DB session once we've decided not to resume.
  useEffect(() => {
    if (phase !== "ready") return;
    if (hydratedRef.current) return;   // resumed — session already set
    if (createdRef.current) return;
    createdRef.current = true;
    createWorkoutSession(
      initialExercises ? exercises.map((ex) => ({ name: ex.name, muscles: ex.muscles })) : undefined
    ).then((result) => {
      if (result.error) setCreateError(result.error);
      else setSession({ id: result.sessionId, exerciseIds: result.exerciseIds });
      setCreating(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Persist a resume snapshot whenever session/progress changes. localStorage is
  // the source of truth for restoring targets, elapsed base, and position.
  useEffect(() => {
    if (!session || showSummary) return;   // nothing to save / session ending
    try {
      const snap: WorkoutSnapshot = {
        sessionId: session.id,
        exerciseIds: session.exerciseIds,
        exercises,
        setLogs,
        cardioBlocks,
        warmup,
        cooldown,
        startedAtMs,
        currentExIdx,
        activeSetIdx,
        savedAtMs: Date.now(),
      };
      localStorage.setItem(RESUME_KEY, JSON.stringify(snap));
    } catch {
      // storage full / unavailable — resume just won't be possible
    }
  }, [session, exercises, setLogs, cardioBlocks, warmup, cooldown, startedAtMs, currentExIdx, activeSetIdx, showSummary]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setSessionElapsed(Math.floor((Date.now() - startedAtMs) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAtMs, paused]);

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
      clearSnapshot();   // session finished — no longer resumable
      router.push("/health");
    });
  };

  // Leave the workout in progress: snapshot stays in localStorage and the DB
  // session stays open (duration_min null). Resume later from the hub.
  const handlePauseAndLeave = () => {
    setShowMenu(false);
    router.push("/health/train");
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
      clearSnapshot();   // session gone — clear the resume snapshot
      router.push("/health");
    });
  };

  const jumpToExercise = (i: number) => {
    setCurrentExIdx(i);
    const next = setLogs[i].findIndex((s) => s === null);
    setActiveSetIdx(next === -1 ? exercises[i].target.sets - 1 : next);
  };

  // Reorder exercises before or during the session — logged sets travel
  // with the exercise they belong to, and the active exercise stays active.
  const moveExercise = (i: number, dir: -1 | 1) => {
    const swap = i + dir;
    if (swap < 0 || swap >= exercises.length) return;

    setExercises((prev) => {
      const next = [...prev];
      [next[i], next[swap]] = [next[swap], next[i]];
      return next;
    });
    setSetLogs((prev) => {
      const next = [...prev];
      [next[i], next[swap]] = [next[swap], next[i]];
      return next;
    });
    setCurrentExIdx((prev) => (prev === i ? swap : prev === swap ? i : prev));
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

  // Still deciding whether to resume (localStorage read happens post-mount)
  if (phase === "deciding") {
    return (
      <div className="ios-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", color: "var(--ios-label-2)", gap: 12 }}>
        Loading…
      </div>
    );
  }

  // Resume prompt — an unfinished workout is saved on this device
  if (phase === "prompt" && pendingSnap) {
    const exCount   = pendingSnap.exercises.length;
    const doneSets  = pendingSnap.setLogs.flat().filter(Boolean).length;
    const startFresh = () => { clearSnapshot(); setPendingSnap(null); setPhase("ready"); };
    const resumeNow  = () => { hydrateFrom(pendingSnap); setPendingSnap(null); setPhase("ready"); };
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh", padding: "0 24px" }}>
        <div style={{ width: "100%", maxWidth: 380, background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: "22px 20px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "var(--ios-tint)" }}>
            <PlayGlyph />
          </div>
          <div className="ios-headline" style={{ color: "var(--ios-label)", marginBottom: 6 }}>
            Resume your in-progress workout?
          </div>
          <div className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)", marginBottom: 18 }}>
            {exCount} exercise{exCount === 1 ? "" : "s"}
            {doneSets > 0 ? ` · ${doneSets} set${doneSets === 1 ? "" : "s"} logged` : ""}
            {` · started ${relativeTime(pendingSnap.startedAtMs)}`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={resumeNow}
              style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: "none", background: "var(--ios-tint)", color: "#fff", fontFamily: "inherit", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
            >
              Resume
            </button>
            <button
              onClick={startFresh}
              style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: "1px solid var(--ios-separator)", background: "var(--ios-bg)", color: "var(--ios-label-2)", fontFamily: "inherit", fontSize: 16, fontWeight: 500, cursor: "pointer" }}
            >
              Start fresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (creating) {
    return (
      <div className="ios-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", color: "var(--ios-label-2)", gap: 12 }}>
        Starting session…
      </div>
    );
  }

  if (createError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh", gap: 16, padding: "0 24px" }}>
        <div className="ios-body" style={{ color: "var(--ios-red)", textAlign: "center" }}>Failed to start session: {createError}</div>
        <button
          onClick={() => router.push("/health")}
          className="ios-btn"
          style={{ background: "var(--ios-cell)", color: "var(--ios-label)", cursor: "pointer" }}
        >
          Back
        </button>
      </div>
    );
  }

  const currentExSets = setLogs[currentExIdx];
  const activeSetDone = currentExSets[activeSetIdx] !== null;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ color: "var(--ios-label)", maxWidth: 540, margin: "0 auto" }}>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: "var(--ios-bg)",
          borderBottom: "1px solid var(--ios-separator)",
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px" }}>
          {/* Session label + volume */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
              {paused && <span style={{ display: "flex", color: "var(--ios-label-2)" }}><PauseGlyph /></span>}
              {paused ? "Paused" : "Active session"}
            </div>
            {totalVolume > 0 && (
              <div className="ios-footnote ios-num" style={{ color: "var(--ios-green)", marginTop: 2 }}>
                {totalVolume.toLocaleString()} lbs · {completedSets}/{totalSets} sets
              </div>
            )}
          </div>

          {/* Timer */}
          <div className="ios-num" style={{ fontSize: 20, fontWeight: 700, color: paused ? "var(--ios-label-2)" : "var(--ios-green)", flexShrink: 0 }}>
            {formatTime(sessionElapsed)}
          </div>

          {/* Finish (when all sets done) */}
          {allSetsDone && (
            <button
              onClick={handleFinish}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "7px 12px", borderRadius: 8, border: "none",
                background: "var(--ios-green)", color: "#fff",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                cursor: "pointer", flexShrink: 0,
              }}
            >
              <CheckGlyph size={13} stroke="#fff" /> Done
            </button>
          )}

          {/* Session menu button */}
          <button
            onClick={() => { setShowMenu((v) => !v); setConfirmDelete(false); }}
            aria-label="Session menu"
            style={{
              width: 34, height: 34, borderRadius: 8, border: "none",
              background: showMenu ? "var(--ios-fill)" : "var(--ios-cell)",
              color: "var(--ios-label-2)", cursor: "pointer",
              flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <EllipsisGlyph />
          </button>
        </div>

        {/* Session control menu */}
        {showMenu && (
          <div style={{ borderTop: "1px solid var(--ios-separator)", background: "var(--ios-cell)", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Reorder exercises — always available, before or during the session */}
            {exercises.length > 1 && (
              <button
                onClick={() => { setShowReorder((v) => !v); setShowMenu(false); }}
                style={menuItem("var(--ios-label)")}
              >
                <span style={{ display: "flex" }}><ReorderGlyph /></span>
                Reorder exercises
              </button>
            )}

            {/* Pause / Resume — only once workout is active */}
            {completedSets > 0 && (
              <button
                onClick={() => { setPaused((v) => !v); setShowMenu(false); }}
                style={menuItem("var(--ios-label)")}
              >
                <span style={{ display: "flex" }}>{paused ? <PlayGlyph /> : <PauseGlyph />}</span>
                {paused ? "Resume session" : "Pause session"}
              </button>
            )}

            {/* Stop early — only once workout is active */}
            {completedSets > 0 && (
              <button
                onClick={() => { setShowMenu(false); handleFinish(); }}
                style={menuItem("var(--ios-label)")}
              >
                <span style={{ display: "flex" }}><StopGlyph /></span>
                Stop &amp; save session
              </button>
            )}

            {/* Pause & leave — stop tracking now, keep the session open, resume later */}
            <button
              onClick={handlePauseAndLeave}
              style={menuItem("var(--ios-label)")}
            >
              <span style={{ display: "flex" }}><LeaveGlyph /></span>
              Pause &amp; leave
            </button>

            {/* Delete — always available so you can bail before logging anything */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                style={menuItem("var(--ios-red)")}
              >
                <span style={{ display: "flex" }}><TrashGlyph /></span>
                Delete session
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleDelete}
                  style={{ flex: 1, padding: "11px 12px", borderRadius: 10, border: "none", background: "var(--ios-red)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{ flex: 1, padding: "11px 12px", borderRadius: 10, border: "1px solid var(--ios-separator)", background: "var(--ios-bg)", color: "var(--ios-label-2)", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Reorder panel */}
        {showReorder && (
          <div style={{ borderTop: "1px solid var(--ios-separator)", background: "var(--ios-cell)", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ ...eyebrow, marginBottom: 2 }}>Reorder exercises</div>
            {exercises.map((ex, i) => {
              const done = setLogs[i].filter(Boolean).length === ex.target.sets;
              return (
                <div key={ex.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, background: "var(--ios-bg)" }}>
                  <span className="ios-subhead" style={{ color: done ? "var(--ios-green)" : "var(--ios-label)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                    {done && <CheckGlyph size={13} stroke="var(--ios-green)" />}{ex.name}
                  </span>
                  <button
                    onClick={() => moveExercise(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    style={{ background: "none", border: "none", color: i === 0 ? "var(--ios-label-3)" : "var(--ios-tint)", cursor: i === 0 ? "default" : "pointer", padding: "2px 4px", display: "flex" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
                  </button>
                  <button
                    onClick={() => moveExercise(i, 1)}
                    disabled={i === exercises.length - 1}
                    aria-label="Move down"
                    style={{ background: "none", border: "none", color: i === exercises.length - 1 ? "var(--ios-label-3)" : "var(--ios-tint)", cursor: i === exercises.length - 1 ? "default" : "pointer", padding: "2px 4px", display: "flex" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => setShowReorder(false)}
              style={{ marginTop: 4, padding: "9px 0", borderRadius: 8, border: "1px solid var(--ios-separator)", background: "transparent", color: "var(--ios-tint)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
            >
              Done
            </button>
          </div>
        )}

        {/* Progress bar */}
        <div style={{ height: 3, background: "var(--ios-fill)", overflow: "hidden" }}>
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              background: "var(--ios-green)",
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
          borderBottom: "1px solid var(--ios-separator)",
        }}
      >
        {exercises.map((ex, i) => {
          const done    = setLogs[i].filter(Boolean).length;
          const isDone  = done === ex.target.sets;
          const isActive = i === currentExIdx;
          const tint = isActive ? "var(--ios-tint)" : isDone ? "var(--ios-green)" : "var(--ios-label-2)";
          return (
            <button
              key={i}
              onClick={() => jumpToExercise(i)}
              style={{
                flexShrink: 0,
                display: "flex", alignItems: "center", gap: 4,
                padding: "7px 13px",
                borderRadius: 20,
                border: "none",
                background: isActive ? "var(--ios-tint)" : "var(--ios-fill)",
                color: isActive ? "#fff" : tint,
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {isDone && <CheckGlyph size={12} stroke={isActive ? "#fff" : "var(--ios-green)"} />}
              {ex.name.split(" ").slice(0, 2).join(" ")}
              {!isDone && <span className="ios-num" style={{ fontSize: 11, opacity: 0.7 }}>{done}/{ex.target.sets}</span>}
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
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ios-label)",
              lineHeight: 1.1,
              marginBottom: 4,
            }}
          >
            {currentEx.name}
          </div>
          <div className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)" }}>
            {currentEx.target.sets} × {currentEx.target.reps} @ {currentEx.target.weight} lbs
            <span style={{ marginLeft: 8, color: "var(--ios-label-3)" }}>Rest {currentEx.restSec}s</span>
          </div>
        </div>

        {/* Smart coach hint */}
        {suggested.hint && (
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: "11px 12px",
              background: "var(--ios-cell)",
              borderRadius: "var(--ios-radius-card)",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: "var(--ios-fill)",
                color: "var(--ios-tint)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <BulbGlyph />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...eyebrow, marginBottom: 2 }}>Coach</div>
              <div className="ios-footnote" style={{ color: "var(--ios-label)", lineHeight: 1.4 }}>
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
                    padding: "9px 11px",
                    borderRadius: 10,
                    background: isActive ? "var(--ios-fill)" : "var(--ios-cell)",
                    border: `1px solid ${isActive ? "var(--ios-tint)" : "transparent"}`,
                    cursor: !isDone ? "pointer" : "default",
                  }}
                >
                  {/* Set indicator */}
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      background: isDone ? "var(--ios-green)" : isActive ? "var(--ios-fill)" : "var(--ios-bg)",
                      border: isActive && !isDone ? "1.5px solid var(--ios-tint)" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      color: isDone ? "#fff" : isActive ? "var(--ios-tint)" : "var(--ios-label-3)",
                      flexShrink: 0,
                    }}
                  >
                    {isDone ? <CheckGlyph size={13} stroke="#fff" /> : i + 1}
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
                          className="ios-num"
                          style={{ width: 54, padding: "5px 6px", borderRadius: 6, border: "1.5px solid var(--ios-tint)", background: "var(--ios-bg)", color: "var(--ios-label)", fontSize: 15, textAlign: "center", outline: "none" }}
                          autoFocus
                        />
                        <span style={{ fontSize: 12, color: "var(--ios-label-3)" }}>×</span>
                        <input
                          type="number"
                          value={editWeight}
                          onChange={(e) => setEditWeight(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingSet(null); }}
                          placeholder="lbs"
                          className="ios-num"
                          style={{ width: 60, padding: "5px 6px", borderRadius: 6, border: "1.5px solid var(--ios-tint)", background: "var(--ios-bg)", color: "var(--ios-label)", fontSize: 15, textAlign: "center", outline: "none" }}
                        />
                        <button onClick={handleSaveEdit} aria-label="Save" style={{ padding: "5px 8px", borderRadius: 6, border: "none", background: "var(--ios-tint)", color: "#fff", display: "flex", alignItems: "center", cursor: "pointer", fontFamily: "inherit" }}><CheckGlyph size={13} stroke="#fff" /></button>
                        <button onClick={() => setEditingSet(null)} aria-label="Cancel" style={{ padding: "5px 7px", borderRadius: 6, border: "1px solid var(--ios-separator)", background: "transparent", color: "var(--ios-label-2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                      </div>
                    ) : (
                      <div
                        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, overflow: "hidden", cursor: "pointer" }}
                        onClick={() => handleEditSet(currentExIdx, i)}
                        title="Tap to edit"
                      >
                        <span className="ios-num" style={{ fontSize: 15, fontWeight: 700, color: "var(--ios-label)", flexShrink: 0 }}>
                          {log!.reps} × {log!.weight}lb
                        </span>
                        <span className="ios-num" style={{ fontSize: 12, color: "var(--ios-label-3)", flexShrink: 0 }}>@ {log!.rpe}</span>
                        {isPR && (
                          <span className="ios-caption" style={{ fontWeight: 700, color: "var(--ios-green)", flexShrink: 0 }}>↑ PR</span>
                        )}
                        <span className="ios-caption" style={{ color: "var(--ios-label-3)", marginLeft: "auto", flexShrink: 0 }}>edit</span>
                      </div>
                    )
                  ) : (
                    <div style={{ flex: 1 }}>
                      {isActive ? (
                        <span className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-tint)" }}>Logging now</span>
                      ) : (
                        <span className="ios-subhead ios-num" style={{ color: "var(--ios-label-3)" }}>
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
              background: "var(--ios-cell)",
              borderRadius: "var(--ios-radius-card)",
              padding: "14px 14px",
              marginBottom: 12,
            }}
          >
            <div style={{ ...eyebrow, color: "var(--ios-tint)", marginBottom: 10 }}>
              Log set {activeSetIdx + 1} of {currentEx.target.sets}
            </div>

            {/* Reps + Weight steppers */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 10, marginBottom: 12 }}>
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
                <div key={label} style={{ minWidth: 0 }}>
                  <div style={{ ...eyebrow, marginBottom: 8 }}>{label}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}>
                    <button
                      onClick={onMinus}
                      aria-label={`Decrease ${label}`}
                      style={stepperBtn}
                    >
                      −
                    </button>
                    <input
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      type="number"
                      inputMode="decimal"
                      className="ios-num"
                      style={{
                        flex: 1, height: 46, minWidth: 0, width: "100%",
                        background: "var(--ios-bg)",
                        border: "1px solid var(--ios-separator)",
                        borderRadius: 10,
                        color: "var(--ios-label)",
                        fontSize: 20,
                        fontWeight: 700,
                        textAlign: "center",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      onClick={onPlus}
                      aria-label={`Increase ${label}`}
                      style={stepperBtn}
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
                <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
                  {inputRpe <= 6 ? "Easy" : inputRpe === 7 ? "3 reps left" : inputRpe === 8 ? "2 reps left" : inputRpe === 9 ? "1 rep left" : "Max effort"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[6, 7, 8, 9, 10].map((n) => {
                  const selected = inputRpe === n;
                  const hot = n >= 9;
                  const selColor = hot ? "var(--ios-red)" : "var(--ios-tint)";
                  return (
                    <button
                      key={n}
                      onClick={() => setInputRpe(n)}
                      className="ios-num"
                      style={{
                        flex: 1,
                        padding: "12px 0",
                        borderRadius: 10,
                        border: `1.5px solid ${selected ? selColor : "var(--ios-separator)"}`,
                        background: selected ? "var(--ios-fill)" : "var(--ios-bg)",
                        color: selected ? selColor : "var(--ios-label-2)",
                        fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
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
                background: "var(--ios-tint)",
                color: "#fff",
                fontFamily: "inherit",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700 }}>
                Log Set {activeSetIdx + 1}
              </span>
              <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 400 }}>
                then start {currentEx.restSec}s rest
              </span>
            </button>
          </div>
        )}

        {/* Exercise complete */}
        {currentExSets.every(Boolean) && (
          <div
            style={{
              background: "var(--ios-cell)",
              border: "1px solid var(--ios-green)",
              borderRadius: "var(--ios-radius-card)",
              padding: "20px 16px",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 6, color: "var(--ios-green)" }}>
              <CheckGlyph size={30} stroke="var(--ios-green)" />
            </div>
            <div className="ios-headline" style={{ color: "var(--ios-green)" }}>
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
                  background: "var(--ios-tint)",
                  color: "#fff",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Next: {exercises[currentExIdx + 1].name} ›
              </button>
            )}
          </div>
        )}

        {/* Previous session (collapsible) */}
        <div
          style={{
            background: "var(--ios-cell)",
            borderRadius: "var(--ios-radius-card)",
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          <button
            onClick={() => setShowPrevious((v) => !v)}
            style={collapseHeader}
          >
            <span style={{ ...eyebrow }}>Last session · {currentEx.lastSession.date}</span>
            <span style={{ color: "var(--ios-label-3)", display: "flex" }}>
              <ChevronGlyph open={showPrevious} />
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
                    padding: "9px 10px",
                    background: "var(--ios-bg)",
                    borderRadius: 8,
                  }}
                >
                  <span className="ios-footnote" style={{ color: "var(--ios-label-3)", fontWeight: 600 }}>Set {i + 1}</span>
                  <span className="ios-footnote ios-num" style={{ color: "var(--ios-label)" }}>
                    {s.reps} × {s.weight}lb
                    <span style={{ color: s.rpe >= 9 ? "var(--ios-red)" : "var(--ios-label-3)", marginLeft: 8 }}>@ {s.rpe}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form cues (collapsible) */}
        <div
          style={{
            background: "var(--ios-cell)",
            borderRadius: "var(--ios-radius-card)",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setShowCues((v) => !v)}
            style={collapseHeader}
          >
            <span style={{ ...eyebrow }}>Form cues</span>
            <span style={{ color: "var(--ios-label-3)", display: "flex" }}>
              <ChevronGlyph open={showCues} />
            </span>
          </button>
          {showCues && (
            <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              {currentEx.cues.map((cue, i) => (
                <div
                  key={i}
                  className="ios-footnote"
                  style={{
                    padding: "9px 10px",
                    background: "var(--ios-bg)",
                    borderLeft: "2px solid var(--ios-tint)",
                    borderRadius: "0 6px 6px 0",
                    color: "var(--ios-label)",
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
        <div style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", overflow: "hidden" }}>
          <div style={{ padding: "12px 14px" }}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Cardio</div>

            {cardioBlocks.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "var(--ios-bg)", borderRadius: 8, marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <span className="ios-footnote" style={{ fontWeight: 600, color: "var(--ios-label)" }}>{(b.type ?? "").replace(/\uFFFD/g, "·")}</span>
                  <span className="ios-caption ios-num" style={{ color: "var(--ios-label-3)", marginLeft: 8 }}>
                    {b.durationMin} min
                    {b.distanceMiles ? ` · ${b.distanceMiles} mi` : ""}
                    {b.paceMinPerMile ? ` · ${Math.floor(b.paceMinPerMile)}:${String(Math.round((b.paceMinPerMile % 1) * 60)).padStart(2, "0")}/mi` : ""}
                    {b.hrAvg ? ` · ${b.hrAvg} bpm` : ""}
                  </span>
                  {b.hrAvg && (
                    <span className="ios-num" style={{ display: "inline-block", marginLeft: 8, fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 6, background: ["", "#e8f4e8", "#b8e0b8", "#f4e8a8", "#f4c08a", "#f4a0a0"][Math.min(5, Math.max(1, Math.round(b.hrAvg / 220 < 0.6 ? 1 : b.hrAvg / 220 < 0.7 ? 2 : b.hrAvg / 220 < 0.8 ? 3 : b.hrAvg / 220 < 0.9 ? 4 : 5)))], color: "#2f3a47" }}>
                      Z{b.hrAvg / 220 < 0.6 ? 1 : b.hrAvg / 220 < 0.7 ? 2 : b.hrAvg / 220 < 0.8 ? 3 : b.hrAvg / 220 < 0.9 ? 4 : 5}
                    </span>
                  )}
                </div>
                <button onClick={() => setCardioBlocks((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove" style={{ background: "none", border: "none", color: "var(--ios-label-3)", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>×</button>
              </div>
            ))}

            {showCardioForm ? (
              <div style={{ background: "var(--ios-bg)", borderRadius: 10, padding: "12px" }}>
                <select value={cardioType} onChange={(e) => setCardioType(e.target.value)} style={{ ...cardioInput, marginBottom: 8 }}>
                  {CARDIO_ACTIVITIES.map((a) => <option key={a.name}>{a.name}</option>)}
                </select>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <input value={cardioDuration} onChange={(e) => setCardioDuration(e.target.value)} placeholder="Duration (min)" type="number" min="1" style={cardioInput} />
                  {getCardioActivity(cardioType).tracksDistance && getCardioActivity(cardioType).distanceUnit === "mi" && (
                    <input value={cardioDistance} onChange={(e) => setCardioDistance(e.target.value)} placeholder="Distance (mi)" type="number" min="0" step="0.1" style={cardioInput} />
                  )}
                  {["Running", "Walking", "Incline Walk"].includes(cardioType) && (
                    <input value={cardioPace} onChange={(e) => setCardioPace(e.target.value)} placeholder="Pace (mm:ss/mi)" style={cardioInput} />
                  )}
                  <input value={cardioHr} onChange={(e) => setCardioHr(e.target.value)} placeholder="Avg HR (bpm)" type="number" min="40" max="220" style={cardioInput} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleAddCardio} disabled={!cardioDuration} style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: cardioDuration ? "var(--ios-tint)" : "var(--ios-fill)", color: cardioDuration ? "#fff" : "var(--ios-label-3)", fontSize: 14, fontWeight: 600, cursor: cardioDuration ? "pointer" : "not-allowed", fontFamily: "inherit" }}>Add</button>
                  <button onClick={() => setShowCardioForm(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid var(--ios-separator)", background: "transparent", color: "var(--ios-label-2)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowCardioForm(true)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1.5px dashed var(--ios-separator)", background: "transparent", color: "var(--ios-tint)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                + Add cardio to this session
              </button>
            )}
          </div>

          <div style={{ padding: "12px 14px 12px", borderTop: "1px solid var(--ios-separator)" }}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Stretching</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[["Warm-up", warmup, () => setWarmup((v) => !v)] as const,
                ["Cool-down", cooldown, () => setCooldown((v) => !v)] as const].map(([label, active, toggle]) => (
                <button key={label} onClick={toggle} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${active ? "var(--ios-green)" : "var(--ios-separator)"}`, background: active ? "var(--ios-fill)" : "var(--ios-bg)", color: active ? "var(--ios-green)" : "var(--ios-label-2)", fontSize: 13, fontWeight: active ? 600 : 500, cursor: "pointer", fontFamily: "inherit" }}>
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
            background: "var(--ios-bg-elevated)",
            border: `1.5px solid ${restRemaining <= 10 ? "var(--ios-red)" : "var(--ios-green)"}`,
            borderRadius: 18,
            padding: "14px 18px",
            zIndex: 50,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ ...eyebrow }}>Rest timer</div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>Set {activeSetIdx + 1} next</div>
          </div>
          <div
            className="ios-num"
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: restRemaining <= 10 ? "var(--ios-red)" : "var(--ios-green)",
              textAlign: "center",
              lineHeight: 1,
              marginBottom: 8,
            }}
          >
            {formatTime(restRemaining)}
          </div>
          <div style={{ height: 4, background: "var(--ios-fill)", borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
            <div
              style={{
                width: `${(restRemaining / restTotal) * 100}%`,
                height: "100%",
                background: restRemaining <= 10 ? "var(--ios-red)" : "var(--ios-green)",
                transition: "width 1s linear",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setRestRemaining((r) => Math.max(0, r - 15))}
              style={restBtn("var(--ios-label-2)")}
            >
              −15s
            </button>
            {[15, 30].map((s) => (
              <button
                key={s}
                onClick={() => setRestRemaining((r) => r + s)}
                style={restBtn("var(--ios-label)")}
              >
                +{s}s
              </button>
            ))}
            <button
              onClick={() => setRestRemaining(0)}
              style={{
                flex: 2, padding: "11px 0", borderRadius: 10,
                border: "none",
                background: "var(--ios-tint)",
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Skip ›
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// ── shared style helpers ────────────────────────────────────────────────────

function menuItem(color: string): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 10,
    border: "none", background: "var(--ios-bg)", color, fontSize: 15, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
  };
}

function restBtn(color: string): React.CSSProperties {
  return {
    flex: 1, padding: "11px 0", borderRadius: 10,
    border: "1px solid var(--ios-separator)",
    background: "var(--ios-fill)",
    color, fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  };
}

const stepperBtn: React.CSSProperties = {
  width: 40, height: 46, borderRadius: 10,
  border: "1px solid var(--ios-separator)",
  background: "var(--ios-bg)",
  color: "var(--ios-label)", fontSize: 20, cursor: "pointer",
  fontFamily: "inherit", flexShrink: 0,
};

const collapseHeader: React.CSSProperties = {
  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "13px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
};

const cardioInput: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "10px 10px", borderRadius: 8,
  border: "1px solid var(--ios-separator)", background: "var(--ios-cell)",
  color: "var(--ios-label)", fontSize: 16, fontFamily: "inherit",
};
