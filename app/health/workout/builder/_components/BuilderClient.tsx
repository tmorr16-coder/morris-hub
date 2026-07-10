'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Body, { MUSCLE_LABELS, type MuscleGroup } from '../../../_components/Body';
import {
  buildPlan, applyLevel, estimateDuration, LEVELS,
  type PlannedExercise, type Difficulty,
} from '../../_lib/build-plan';
import { scheduleWorkout } from '../../actions';
import {
  EXERCISE_TEMPLATES, templateToExercise, type ExerciseTemplate,
  CARDIO_ACTIVITIES, getCardioActivity,
  STRETCH_MOVEMENTS, STRETCH_KIND_LABELS, stretchDurationMin,
  type StretchKind, type StretchMovement,
} from '../../exercise-library';
import type { LastWorkout } from '../../_lib/last-workout';
import { Segmented, Chip, Cell, IconBadge, Icons } from '@/components/ios';

type WorkoutMode = 'strength' | 'cardio' | 'mixed';

// ── iOS style helpers ─────────────────────────────────────────────────────────

const GUT = 16;

const cellInput: React.CSSProperties = {
  width: '100%', border: 'none', background: 'transparent',
  color: 'var(--ios-label)', fontSize: 17, outline: 'none', padding: 0,
  fontFamily: 'inherit',
};
const searchField: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none',
  background: 'var(--ios-fill)', color: 'var(--ios-label)', fontSize: 17,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const selectStyle: React.CSSProperties = {
  border: 'none', background: 'transparent', color: 'var(--ios-tint)',
  fontSize: 17, fontFamily: 'inherit', textAlign: 'right',
};
const cellLabel: React.CSSProperties = { fontSize: 15, color: 'var(--ios-label-2)' };
const primaryBtn: React.CSSProperties = { margin: `0 ${GUT}px`, width: `calc(100% - ${GUT * 2}px)` };
const secondaryBtn: React.CSSProperties = {
  margin: `0 ${GUT}px`, width: `calc(100% - ${GUT * 2}px)`, minHeight: 50,
  borderRadius: 12, background: 'var(--ios-fill)', color: 'var(--ios-tint)',
  fontSize: 17, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="ios-group-header" style={{ marginTop: 22 }}>{children}</div>;
}

const RepeatGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8M20 4v4h-4" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16M4 20v-4h4" />
  </svg>
);
const ChevUp = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}><path d="M6 15l6-6 6 6" /></svg>
);
const ChevDown = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}><path d="M6 9l6 6 6-6" /></svg>
);
const RemoveGlyph = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 12h7" /></svg>
);
const CheckGlyph = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}><path d="M5 12.5l4.5 4.5L19 7" /></svg>
);

function Stepper({
  label, value, onDecrement, onIncrement,
}: { label: string; value: number; onDecrement: () => void; onIncrement: () => void }) {
  const btn: React.CSSProperties = {
    width: 40, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, color: 'var(--ios-tint)', lineHeight: 1,
  };
  return (
    <div className="ios-cell" style={{ minHeight: 40, paddingTop: 6, paddingBottom: 6 }}>
      <span className="ios-cell-body"><span className="ios-cell-title" style={{ fontSize: 15, color: 'var(--ios-label-2)' }}>{label}</span></span>
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--ios-fill)', borderRadius: 8 }}>
        <button onClick={onDecrement} style={btn} aria-label={`Decrease ${label}`}>−</button>
        <span className="ios-num" style={{ minWidth: 32, textAlign: 'center', fontSize: 17, fontWeight: 600 }}>{value}</span>
        <button onClick={onIncrement} style={btn} aria-label={`Increase ${label}`}>+</button>
      </div>
    </div>
  );
}

// ── Preset splits ─────────────────────────────────────────────────────────────

const PRESETS: { label: string; groups: MuscleGroup[] }[] = [
  { label: 'Push',  groups: ['chest', 'shoulders', 'triceps'] },
  { label: 'Pull',  groups: ['lats', 'back', 'biceps'] },
  { label: 'Legs',  groups: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { label: 'Upper', groups: ['chest', 'lats', 'shoulders', 'biceps', 'triceps'] },
  { label: 'Core',  groups: ['abs', 'obliques'] },
];

// ── Main component ────────────────────────────────────────────────────────────

type CardioType = string;
const INTENSITIES = ['Easy', 'Moderate', 'Hard'] as const;
type Intensity = typeof INTENSITIES[number];

// A cardio / stretching block, shape-compatible with CardioBlock in actions.ts
interface PlanBlock { type: string; durationMin: number; distanceMiles?: number }

// A user-selected mobility / stretching movement
interface SelectedStretch {
  name: string;
  kind: StretchKind;
  area: string;
  holdSec: number;
  rounds: number;
}

interface DecodedPlan {
  exercises: { name: string; sets: number; reps: number }[];
  cardio?: { type: string; durationMin: number };
  blocks?: PlanBlock[];
}

function decodePlan(planEncoded: string): DecodedPlan | null {
  try {
    return JSON.parse(atob(planEncoded));
  } catch {
    return null;
  }
}

export default function BuilderClient({ lastWorkout }: { lastWorkout?: LastWorkout | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [repeatPending, startRepeatTransition] = useTransition();

  const lastWorkoutPlan = useMemo(
    () => (lastWorkout ? decodePlan(lastWorkout.planEncoded) : null),
    [lastWorkout]
  );

  const handleRepeatLast = () => {
    if (!lastWorkout) return;
    startRepeatTransition(() => {
      router.push(`/health/workout?plan=${lastWorkout.planEncoded}`);
    });
  };

  const [step, setStep]           = useState<'select' | 'review'>('select');
  const [view, setView]           = useState<'front' | 'back'>('front');
  const [selected, setSelected]   = useState<MuscleGroup[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [editedPlan, setEditedPlan] = useState<PlannedExercise[] | null>(null);
  const [mode, setMode] = useState<WorkoutMode>('strength');

  // Exercise search (review step)
  const [exSearch, setExSearch] = useState('');
  const exResults = useMemo(() => {
    if (exSearch.trim().length < 2) return [];
    const q = exSearch.toLowerCase();
    return EXERCISE_TEMPLATES.filter(
      (t) => t.name.toLowerCase().includes(q) || t.muscles.some((m) => m.toLowerCase().includes(q)) || t.category.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [exSearch]);

  // Scheduling
  const [showSchedule, setShowSchedule]     = useState(false);
  const [schedLabel,   setSchedLabel]       = useState('');
  const [schedDate,    setSchedDate]        = useState('');
  const [schedTime,    setSchedTime]        = useState('09:00');
  const [schedReminder, setSchedReminder]   = useState(30);
  const [schedSaving,  setSchedSaving]      = useState(false);
  const [schedSaved,   setSchedSaved]       = useState(false);
  const [schedError,   setSchedError]       = useState<string | null>(null);

  // Cardio + stretching
  const [stretchBefore, setStretchBefore] = useState(false);
  const [stretchAfter,  setStretchAfter]  = useState(false);
  const [addCardio,     setAddCardio]     = useState(false);
  const [cardioType,    setCardioType]    = useState<CardioType>('Running');
  const [cardioIntensity, setCardioIntensity] = useState<Intensity>('Moderate');
  const [cardioDuration, setCardioDuration] = useState('');
  const [cardioDistance, setCardioDistance] = useState('');
  // Interval (HIIT / jump rope) fields
  const [cardioRounds, setCardioRounds] = useState('8');
  const [cardioWork,   setCardioWork]   = useState('30');
  const [cardioRest,   setCardioRest]   = useState('30');

  // Mobility / stretching movements picked from the library
  const [mobility, setMobility] = useState<SelectedStretch[]>([]);
  const [mobilityKind, setMobilityKind] = useState<StretchKind>('dynamic');

  const cardioActivity = getCardioActivity(cardioType);

  const addMobility = (m: StretchMovement) =>
    setMobility((prev) =>
      prev.some((s) => s.name === m.name)
        ? prev.filter((s) => s.name !== m.name)
        : [...prev, { name: m.name, kind: m.kind, area: m.area, holdSec: m.defaultHoldSec, rounds: m.defaultRounds }]
    );
  const adjustMobility = (name: string, key: 'holdSec' | 'rounds', delta: number) =>
    setMobility((prev) => prev.map((s) =>
      s.name === name ? { ...s, [key]: Math.max(key === 'holdSec' ? 0 : 1, s[key] + delta) } : s
    ));

  // Build the primary cardio block from the current inputs (null if incomplete)
  const buildCardioBlock = (): PlanBlock | null => {
    const a = getCardioActivity(cardioType);
    if (a.modality === 'interval') {
      const rounds = parseInt(cardioRounds, 10);
      const work   = parseInt(cardioWork, 10);
      const rest   = parseInt(cardioRest, 10) || 0;
      if (!rounds || !work) return null;
      const durationMin = Math.max(1, Math.round((rounds * (work + rest)) / 60));
      return { type: `${cardioType} · ${rounds}×(${work}s/${rest}s) · ${cardioIntensity}`, durationMin };
    }
    const dur = parseInt(cardioDuration, 10);
    if (!dur) return null;
    let type = `${cardioType} · ${cardioIntensity}`;
    const block: PlanBlock = { type, durationMin: dur };
    if (a.tracksDistance && cardioDistance) {
      const d = parseFloat(cardioDistance);
      if (d > 0) {
        if (a.distanceUnit === 'mi') block.distanceMiles = d;
        else type = `${cardioType} · ${d}${a.distanceUnit} · ${cardioIntensity}`;
      }
    }
    block.type = type;
    return block;
  };

  // Mobility movements as saveable blocks
  const mobilityBlocks = (): PlanBlock[] =>
    mobility.map((s) => ({ type: s.name, durationMin: stretchDurationMin(s.holdSec, s.rounds) }));

  const cardioReady =
    cardioActivity.modality === 'interval'
      ? Boolean(parseInt(cardioRounds, 10) && parseInt(cardioWork, 10))
      : Boolean(parseInt(cardioDuration, 10));

  const toggle = (g: MuscleGroup) =>
    setSelected((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );

  // Exercises picked by hand from the library during selection (distinct from
  // the auto-generated plan) — merged into basePlan so they carry through to review.
  const [manualAdditions, setManualAdditions] = useState<PlannedExercise[]>([]);
  const [libSearch, setLibSearch] = useState('');

  const selectedMuscleLabels = useMemo(
    () => new Set(selected.map((g) => MUSCLE_LABELS[g])),
    [selected]
  );

  const libResults = useMemo(() => {
    const q = libSearch.trim().toLowerCase();
    if (q.length >= 2) {
      return EXERCISE_TEMPLATES.filter(
        (t) => t.name.toLowerCase().includes(q) || t.muscles.some((m) => m.toLowerCase().includes(q))
      ).slice(0, 10);
    }
    if (selectedMuscleLabels.size === 0) return [];
    return EXERCISE_TEMPLATES.filter((t) => t.muscles.some((m) => selectedMuscleLabels.has(m))).slice(0, 10);
  }, [libSearch, selectedMuscleLabels]);

  const addManualExercise = (t: ExerciseTemplate) => {
    const ex = templateToExercise(t);
    setManualAdditions((prev) =>
      prev.some((e) => e.name === ex.name)
        ? prev
        : [...prev, { name: ex.name, sets: ex.target.sets, reps: ex.target.reps, primary: [], secondary: [], _score: 0 }]
    );
  };

  const removeManualExercise = (name: string) =>
    setManualAdditions((prev) => prev.filter((e) => e.name !== name));

  const basePlan = useMemo(
    () => [...applyLevel(buildPlan(selected), difficulty), ...manualAdditions],
    [selected, difficulty, manualAdditions]
  );
  const plan     = editedPlan ?? basePlan;
  const duration = estimateDuration(plan);

  const enterReview = () => {
    if (mode === 'cardio') {
      // For cardio-only mode, skip review and go straight to workout
      handleStart();
      return;
    }
    setEditedPlan(basePlan.map((ex) => ({ ...ex })));
    setStep('review');
  };

  const adjustField = (i: number, key: 'sets' | 'reps', delta: number) =>
    setEditedPlan((prev) =>
      prev!.map((ex, idx) =>
        idx === i ? { ...ex, [key]: Math.max(1, ex[key] + delta) } : ex
      )
    );

  const removeExercise = (i: number) =>
    setEditedPlan((prev) => prev!.filter((_, idx) => idx !== i));

  const moveExercise = (i: number, dir: -1 | 1) =>
    setEditedPlan((prev) => {
      const list = prev!;
      const swap = i + dir;
      if (swap < 0 || swap >= list.length) return prev;
      const next = [...list];
      [next[i], next[swap]] = [next[swap], next[i]];
      return next;
    });

  const buildEncoded = () => {
    const exercises = plan.map((ex) => ({
      name: ex.name, sets: ex.sets, reps: ex.reps, primary: ex.primary,
    }));
    const payload: Record<string, unknown> = { exercises };
    if (stretchBefore) payload.warmup   = true;
    if (stretchAfter)  payload.cooldown = true;
    const wantCardio = mode === 'cardio' || (addCardio && cardioReady);
    if (wantCardio) {
      const cardio = buildCardioBlock();
      if (cardio) payload.cardio = cardio;
    }
    const blocks = mobilityBlocks();
    if (blocks.length) payload.blocks = blocks;
    return btoa(JSON.stringify(payload));
  };

  const handleStart = () => {
    startTransition(() => {
      router.push(`/health/workout?plan=${buildEncoded()}`);
    });
  };

  const handleSchedule = async () => {
    if (!schedDate) return;
    setSchedSaving(true);
    setSchedError(null);
    const result = await scheduleWorkout({
      label:        schedLabel.trim() || selected.map((g) => MUSCLE_LABELS[g]).join(' + ') || 'Workout',
      scheduledDate: schedDate,
      scheduledTime: schedTime,
      planEncoded:  buildEncoded(),
      reminderMin:  schedReminder,
    });
    setSchedSaving(false);
    if (result.error) { setSchedError(result.error); return; }
    setSchedSaved(true);
    setShowSchedule(false);
  };

  const strengthMode = mode === 'strength' || mode === 'mixed';

  // ── Reusable cardio form (activity · intensity · duration/distance or intervals) ──
  const cardioFormEl = (
    <div className="ios-list" style={{ margin: '0 16px' }}>
      <div className="ios-cell">
        <span className="ios-cell-body"><span className="ios-cell-title" style={cellLabel}>Activity</span></span>
        <select value={cardioType} onChange={(e) => setCardioType(e.target.value)} style={selectStyle}>
          {CARDIO_ACTIVITIES.map((a) => <option key={a.name}>{a.name}</option>)}
        </select>
      </div>
      <div className="ios-cell">
        <span className="ios-cell-body"><span className="ios-cell-title" style={cellLabel}>Intensity</span></span>
        <select value={cardioIntensity} onChange={(e) => setCardioIntensity(e.target.value as Intensity)} style={selectStyle}>
          {INTENSITIES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      {cardioActivity.modality === 'interval' ? (
        <>
          <div className="ios-cell">
            <span className="ios-cell-body"><span className="ios-cell-title" style={cellLabel}>Rounds</span></span>
            <input value={cardioRounds} onChange={(e) => setCardioRounds(e.target.value)} type="number" min="1" inputMode="numeric" style={{ ...cellInput, width: 80, textAlign: 'right' }} />
          </div>
          <div className="ios-cell">
            <span className="ios-cell-body"><span className="ios-cell-title" style={cellLabel}>Work (sec)</span></span>
            <input value={cardioWork} onChange={(e) => setCardioWork(e.target.value)} type="number" min="1" inputMode="numeric" style={{ ...cellInput, width: 80, textAlign: 'right' }} />
          </div>
          <div className="ios-cell">
            <span className="ios-cell-body"><span className="ios-cell-title" style={cellLabel}>Rest (sec)</span></span>
            <input value={cardioRest} onChange={(e) => setCardioRest(e.target.value)} type="number" min="0" inputMode="numeric" style={{ ...cellInput, width: 80, textAlign: 'right' }} />
          </div>
        </>
      ) : (
        <>
          <div className="ios-cell">
            <input value={cardioDuration} onChange={(e) => setCardioDuration(e.target.value)} type="number" min="1" inputMode="numeric" placeholder="Duration (min)" style={cellInput} />
          </div>
          {cardioActivity.tracksDistance && (
            <div className="ios-cell">
              <input value={cardioDistance} onChange={(e) => setCardioDistance(e.target.value)} type="number" min="0" step="0.1" inputMode="decimal" placeholder={`Distance (${cardioActivity.distanceUnit}) — optional`} style={cellInput} />
            </div>
          )}
        </>
      )}
    </div>
  );

  // ── Reusable mobility / stretching picker ─────────────────────────────────────
  const mobilityList = STRETCH_MOVEMENTS.filter((m) => m.kind === mobilityKind);
  const mobilitySectionEl = (
    <>
      <SectionLabel>Mobility &amp; stretching · optional</SectionLabel>
      <Segmented
        options={(Object.keys(STRETCH_KIND_LABELS) as StretchKind[]).map((k) => ({ value: k, label: STRETCH_KIND_LABELS[k].split(' ')[0] }))}
        value={mobilityKind}
        onChange={setMobilityKind}
        style={{ marginTop: 0 }}
      />
      <div className="ios-list" style={{ margin: '10px 16px 0', maxHeight: 240, overflowY: 'auto' }}>
        {mobilityList.map((m) => {
          const added = mobility.some((s) => s.name === m.name);
          return (
            <Cell
              key={m.name}
              chevron={false}
              onClick={() => addMobility(m)}
              title={<span style={{ color: added ? 'var(--ios-tint)' : 'var(--ios-label)' }}>{m.name}</span>}
              subtitle={`${m.area} · ${m.defaultHoldSec > 0 ? `${m.defaultHoldSec}s hold` : `${m.defaultRounds} reps`}`}
              trailing={added
                ? <CheckGlyph style={{ color: 'var(--ios-tint)' }} />
                : <Icons.PlusIcon style={{ width: 18, height: 18, color: 'var(--ios-label-3)' }} />}
            />
          );
        })}
      </div>
      {mobility.length > 0 && (
        <>
          <SectionLabel>Selected mobility · {mobility.length}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mobility.map((s) => (
              <div key={s.name} className="ios-list" style={{ margin: '0 16px' }}>
                <div className="ios-cell">
                  <span className="ios-cell-body">
                    <span className="ios-cell-title" style={{ fontSize: 16 }}>{s.name}</span>
                    <span className="ios-cell-sub">{STRETCH_KIND_LABELS[s.kind]} · {s.area}</span>
                  </span>
                  <button onClick={() => setMobility((prev) => prev.filter((x) => x.name !== s.name))} aria-label="Remove" style={{ color: 'var(--ios-red)', display: 'flex' }}><RemoveGlyph /></button>
                </div>
                <Stepper label="Hold (sec)" value={s.holdSec} onDecrement={() => adjustMobility(s.name, 'holdSec', -5)} onIncrement={() => adjustMobility(s.name, 'holdSec', 5)} />
                <Stepper label="Rounds / sides" value={s.rounds} onDecrement={() => adjustMobility(s.name, 'rounds', -1)} onIncrement={() => adjustMobility(s.name, 'rounds', 1)} />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );

  // ── REVIEW STEP ─────────────────────────────────────────────────────────────
  if (step === 'review') {
    const reviewCardio = addCardio && cardioReady ? buildCardioBlock() : null;
    return (
      <div style={{ paddingTop: 4 }}>

        <button onClick={() => setStep('select')} className="ios-back" style={{ padding: `2px ${GUT}px` }}>
          <Icons.ChevronLeft aria-hidden style={{ width: 20, height: 20 }} /> Edit
        </button>

        <p className="ios-footnote" style={{ color: 'var(--ios-label-2)', padding: `6px ${GUT}px 0` }}>
          <span className="ios-num">{plan.length}</span> exercises · ~<span className="ios-num">{duration}</span> min · {selected.length} muscle groups
        </p>

        {/* Body summary */}
        <div className="ios-list" style={{ margin: '14px 16px 0', padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Body primary={selected} size={104} view={view} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {selected.map((g) => <Chip key={g} small selected>{MUSCLE_LABELS[g]}</Chip>)}
            </div>
            <Segmented
              options={[{ value: 'front', label: 'Front' }, { value: 'back', label: 'Back' }]}
              value={view}
              onChange={setView}
              style={{ margin: 0, maxWidth: 170 }}
            />
          </div>
        </div>

        {/* Editable exercise list */}
        <SectionLabel>Exercises · tap −/+ to adjust</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plan.map((ex, i) => (
            <div key={i} className="ios-list" style={{ margin: '0 16px' }}>
              <div className="ios-cell">
                <span className="ios-num" style={{ width: 16, color: 'var(--ios-label-3)', fontSize: 13 }}>{i + 1}</span>
                <span className="ios-cell-body"><span className="ios-cell-title" style={{ fontSize: 16 }}>{ex.name}</span></span>
                <span className="ios-cell-trail" style={{ gap: 2 }}>
                  <button onClick={() => moveExercise(i, -1)} disabled={i === 0} aria-label="Move up" style={{ color: i === 0 ? 'var(--ios-label-3)' : 'var(--ios-tint)', display: 'flex' }}><ChevUp /></button>
                  <button onClick={() => moveExercise(i, 1)} disabled={i === plan.length - 1} aria-label="Move down" style={{ color: i === plan.length - 1 ? 'var(--ios-label-3)' : 'var(--ios-tint)', display: 'flex' }}><ChevDown /></button>
                  <button onClick={() => removeExercise(i)} aria-label="Remove" style={{ color: 'var(--ios-red)', display: 'flex', marginLeft: 4 }}><RemoveGlyph /></button>
                </span>
              </div>
              <Stepper label="Sets" value={ex.sets} onDecrement={() => adjustField(i, 'sets', -1)} onIncrement={() => adjustField(i, 'sets', 1)} />
              <Stepper label="Reps" value={ex.reps} onDecrement={() => adjustField(i, 'reps', -1)} onIncrement={() => adjustField(i, 'reps', 1)} />
            </div>
          ))}
        </div>

        {/* Add exercise from library */}
        <SectionLabel>Add from library · 120+ exercises</SectionLabel>
        <div style={{ position: 'relative', margin: '0 16px' }}>
          <input
            value={exSearch}
            onChange={(e) => setExSearch(e.target.value)}
            placeholder="Search by name or muscle…"
            style={searchField}
          />
          {exResults.length > 0 && (
            <div className="ios-list" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }}>
              {exResults.map((t) => (
                <Cell
                  key={t.name}
                  chevron={false}
                  onClick={() => {
                    const ex = templateToExercise(t);
                    const newEx: PlannedExercise = { name: ex.name, sets: ex.target.sets, reps: ex.target.reps, primary: [], secondary: [], _score: 0 };
                    setEditedPlan((prev) => [...(prev ?? plan), newEx]);
                    setExSearch('');
                  }}
                  title={t.name}
                  subtitle={`${t.muscles.join(', ')} · ${t.equipment} · ${t.defaultSets}×${t.defaultReps}`}
                  trailing={<Icons.PlusIcon style={{ width: 18, height: 18, color: 'var(--ios-tint)' }} />}
                />
              ))}
            </div>
          )}
        </div>

        {/* Extras */}
        {(stretchBefore || stretchAfter || reviewCardio || mobility.length > 0) && (
          <>
            <SectionLabel>Extras</SectionLabel>
            <div className="ios-list" style={{ margin: '0 16px' }}>
              {stretchBefore && <Cell chevron={false} title="🧘 Warm-up stretching" subtitle="Before" />}
              {reviewCardio && (
                <Cell
                  chevron={false}
                  title={`🏃 ${reviewCardio.type}`}
                  subtitle={`${reviewCardio.durationMin} min${reviewCardio.distanceMiles ? ` · ${reviewCardio.distanceMiles} mi` : ''}`}
                />
              )}
              {mobility.map((s) => (
                <Cell
                  key={s.name}
                  chevron={false}
                  title={`🧘 ${s.name}`}
                  subtitle={`${STRETCH_KIND_LABELS[s.kind]} · ${s.holdSec > 0 ? `${s.holdSec}s × ${s.rounds}` : `${s.rounds} reps`}`}
                />
              ))}
              {stretchAfter && <Cell chevron={false} title="🧘 Cool-down stretching" subtitle="After" />}
            </div>
          </>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
          <button onClick={handleStart} disabled={isPending || plan.length === 0} className="ios-btn ios-btn--primary" style={{ ...primaryBtn, opacity: plan.length && !isPending ? 1 : 0.5 }}>
            {isPending ? 'Starting…' : 'Start workout'}
          </button>
          <button onClick={() => setStep('select')} style={secondaryBtn}>Adjust selection</button>

          {schedSaved ? (
            <p className="ios-footnote" style={{ textAlign: 'center', color: 'var(--ios-green)', padding: '4px 16px 0' }}>
              Workout scheduled — see it in the Train tab
            </p>
          ) : !showSchedule ? (
            <button onClick={() => setShowSchedule(true)} className="ios-btn ios-btn--plain" style={{ alignSelf: 'center' }}>
              Schedule for later
            </button>
          ) : (
            <>
              <SectionLabel>Schedule workout</SectionLabel>
              <div className="ios-list" style={{ margin: '0 16px' }}>
                <div className="ios-cell">
                  <input value={schedLabel} onChange={(e) => setSchedLabel(e.target.value)} placeholder={selected.map((g) => MUSCLE_LABELS[g]).join(' + ') || 'Label (optional)'} style={cellInput} />
                </div>
                <div className="ios-cell">
                  <span className="ios-cell-body"><span className="ios-cell-title" style={{ fontSize: 15, color: 'var(--ios-label-2)' }}>Date</span></span>
                  <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} min={new Date().toLocaleDateString('sv')} style={{ ...cellInput, width: 'auto', textAlign: 'right' }} />
                </div>
                <div className="ios-cell">
                  <span className="ios-cell-body"><span className="ios-cell-title" style={{ fontSize: 15, color: 'var(--ios-label-2)' }}>Time</span></span>
                  <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} style={{ ...cellInput, width: 'auto', textAlign: 'right' }} />
                </div>
                <div className="ios-cell">
                  <span className="ios-cell-body"><span className="ios-cell-title" style={{ fontSize: 15, color: 'var(--ios-label-2)' }}>Remind me</span></span>
                  <select value={schedReminder} onChange={(e) => setSchedReminder(Number(e.target.value))} style={{ border: 'none', background: 'transparent', color: 'var(--ios-tint)', fontSize: 17, fontFamily: 'inherit', textAlign: 'right' }}>
                    <option value={15}>15 min before</option>
                    <option value={30}>30 min before</option>
                    <option value={60}>1 hour before</option>
                    <option value={0}>At start time</option>
                  </select>
                </div>
              </div>
              {schedError && <p className="ios-footnote" style={{ color: 'var(--ios-red)', padding: '2px 16px 0' }}>{schedError}</p>}
              <button onClick={handleSchedule} disabled={!schedDate || schedSaving} className="ios-btn ios-btn--primary" style={{ ...primaryBtn, opacity: schedDate && !schedSaving ? 1 : 0.5 }}>
                {schedSaving ? 'Saving…' : 'Save schedule'}
              </button>
              <button onClick={() => setShowSchedule(false)} style={secondaryBtn}>Cancel</button>
            </>
          )}
        </div>

        <div style={{ height: 24 }} />
      </div>
    );
  }

  // ── SELECT STEP ─────────────────────────────────────────────────────────────
  const n = selected.length;

  return (
    <div style={{ paddingTop: 4 }}>

      {/* Repeat last workout */}
      {lastWorkout && lastWorkoutPlan && (
        <div className="ios-list" style={{ margin: '8px 16px 0', opacity: repeatPending ? 0.6 : 1 }}>
          <Cell
            onClick={handleRepeatLast}
            lead={<IconBadge color="var(--ios-tint)"><RepeatGlyph /></IconBadge>}
            title="Repeat last workout"
            subtitle={[
              lastWorkout.label,
              lastWorkoutPlan.exercises.length > 0 ? `${lastWorkoutPlan.exercises.length} exercises` : null,
              lastWorkoutPlan.cardio ? `${lastWorkoutPlan.cardio.type} ${lastWorkoutPlan.cardio.durationMin} min` : null,
            ].filter(Boolean).join(' · ')}
          />
        </div>
      )}

      {/* Workout type */}
      <SectionLabel>Workout type</SectionLabel>
      <Segmented
        options={[{ value: 'strength', label: 'Strength' }, { value: 'cardio', label: 'Cardio' }, { value: 'mixed', label: 'Mixed' }]}
        value={mode}
        onChange={setMode}
        style={{ marginTop: 0 }}
      />

      {/* Experience level */}
      {strengthMode && (
        <>
          <SectionLabel>Experience level</SectionLabel>
          <Segmented
            options={(Object.entries(LEVELS) as [Difficulty, (typeof LEVELS)[Difficulty]][]).map(([k, v]) => ({ value: k, label: v.label }))}
            value={difficulty}
            onChange={setDifficulty}
            style={{ marginTop: 0 }}
          />
          <p className="ios-footnote" style={{ color: 'var(--ios-label-2)', padding: '7px 16px 0' }}>{LEVELS[difficulty].hint}</p>
        </>
      )}

      {/* Body diagram */}
      {strengthMode && (
        <>
          <SectionLabel>Tap muscles to train</SectionLabel>
          <div id="body-picker" className="ios-list" style={{ margin: '0 16px', padding: '16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', scrollMarginTop: 16 }}>
            <Segmented
              options={[{ value: 'front', label: 'Front' }, { value: 'back', label: 'Back' }]}
              value={view}
              onChange={setView}
              style={{ margin: 0, position: 'absolute', top: 14, right: 14, width: 150 }}
            />
            <Body primary={selected} view={view} size={240} onMuscleClick={toggle} />
            {!n && (
              <p className="ios-footnote" style={{ color: 'var(--ios-label-3)', marginTop: 8 }}>Tap chest, quads, lats… any muscle group.</p>
            )}
          </div>
        </>
      )}

      {/* Selected pills */}
      {strengthMode && n > 0 && (
        <>
          <SectionLabel>Selected · {n}</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px' }}>
            {selected.map((g) => (
              <Chip key={g} small selected onClick={() => toggle(g)}>{MUSCLE_LABELS[g]} ✕</Chip>
            ))}
          </div>
        </>
      )}

      {/* Preset splits */}
      {strengthMode && (
        <>
          <SectionLabel>Or pick a split</SectionLabel>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 16px' }}>
            {PRESETS.map((p) => {
              const active = p.groups.length === n && p.groups.every((g) => selected.includes(g));
              return (
                <Chip key={p.label} selected={active} onClick={() => setSelected(p.groups)}>{p.label}</Chip>
              );
            })}
          </div>
        </>
      )}

      {/* Cardio activity (cardio-only mode — mixed uses the add-on toggle below) */}
      {mode === 'cardio' && (
        <>
          <SectionLabel>Cardio activity</SectionLabel>
          {cardioFormEl}
        </>
      )}

      {/* Live plan preview */}
      {strengthMode && (n > 0 || manualAdditions.length > 0) && (
        <>
          <SectionLabel>Plan preview · ~{duration} min</SectionLabel>
          <div className="ios-list" style={{ margin: '0 16px' }}>
            {plan.map((ex, i) => (
              <div key={i} className="ios-cell">
                <span className="ios-num" style={{ width: 16, color: 'var(--ios-label-3)', fontSize: 13 }}>{i + 1}</span>
                <span className="ios-cell-body"><span className="ios-cell-title" style={{ fontSize: 16 }}>{ex.name}</span></span>
                <span className="ios-cell-trail"><span className="ios-num" style={{ fontSize: 15 }}>{ex.sets}×{ex.reps}</span></span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Exercise library */}
      {strengthMode && (
        <>
          <SectionLabel>Exercise library · 120+{n > 0 && !libSearch ? ' · for your selection' : ''}</SectionLabel>
          <div style={{ margin: '0 16px' }}>
            <input
              value={libSearch}
              onChange={(e) => setLibSearch(e.target.value)}
              placeholder={n > 0 ? 'Search or browse for your muscles…' : 'Search by name or muscle…'}
              style={searchField}
            />
            {libResults.length > 0 ? (
              <div className="ios-list" style={{ margin: '8px 0 0', maxHeight: 260, overflowY: 'auto' }}>
                {libResults.map((t) => {
                  const added = manualAdditions.some((e) => e.name === t.name);
                  return (
                    <Cell
                      key={t.name}
                      chevron={false}
                      onClick={() => (added ? removeManualExercise(t.name) : addManualExercise(t))}
                      title={<span style={{ color: added ? 'var(--ios-tint)' : 'var(--ios-label)' }}>{t.name}</span>}
                      subtitle={`${t.muscles.join(', ')} · ${t.equipment} · ${t.defaultSets}×${t.defaultReps}`}
                      trailing={added
                        ? <CheckGlyph style={{ color: 'var(--ios-tint)' }} />
                        : <Icons.PlusIcon style={{ width: 18, height: 18, color: 'var(--ios-label-3)' }} />}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="ios-footnote" style={{ color: 'var(--ios-label-2)', padding: '8px 0 0' }}>
                {n > 0 ? 'No matches — try a search above.' : 'Tap a muscle group above, or search for an exercise by name.'}
              </p>
            )}
          </div>
        </>
      )}

      {/* Stretching — quick warm-up / cool-down toggles */}
      <SectionLabel>Stretching · optional</SectionLabel>
      <div style={{ display: 'flex', gap: 10, padding: '0 16px' }}>
        <Chip selected={stretchBefore} onClick={() => setStretchBefore((v) => !v)}>🧘 Before</Chip>
        <Chip selected={stretchAfter} onClick={() => setStretchAfter((v) => !v)}>🧘 After</Chip>
      </div>

      {/* Mobility / stretching movement picker */}
      {mobilitySectionEl}

      {/* Cardio add-on (strength/mixed only) */}
      {strengthMode && (
        <>
          <SectionLabel>Cardio · optional</SectionLabel>
          <div style={{ padding: '0 16px' }}>
            <Chip selected={addCardio} onClick={() => setAddCardio((v) => !v)}>{addCardio ? 'Remove cardio' : '+ Add cardio'}</Chip>
          </div>
          {addCardio && <div style={{ marginTop: 10 }}>{cardioFormEl}</div>}
        </>
      )}

      {/* CTA */}
      <div style={{ marginTop: 24 }}>
        <button
          onClick={enterReview}
          disabled={mode === 'cardio' ? !cardioReady : !n && manualAdditions.length === 0}
          className="ios-btn ios-btn--primary"
          style={{ ...primaryBtn, opacity: (mode === 'cardio' ? cardioReady : n || manualAdditions.length > 0) ? 1 : 0.4 }}
        >
          {mode === 'cardio' ? 'Start cardio' : `Review plan${n > 0 ? ` · ${plan.length} exercises` : ''}`}
        </button>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}
