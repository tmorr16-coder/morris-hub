'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Body, { MUSCLE_LABELS, type MuscleGroup } from '../../../_components/Body';
import {
  buildPlan, applyLevel, estimateDuration, LEVELS,
  type PlannedExercise, type Difficulty,
} from '../../_lib/build-plan';
import { scheduleWorkout } from '../../actions';

// ── Shared CSS-variable helpers ───────────────────────────────────────────────

const S = {
  eyebrow: {
    fontSize: 10, fontWeight: 500, letterSpacing: '0.14em',
    textTransform: 'uppercase' as const, color: 'var(--color-ink-3)',
  },
  tile: {
    background: 'var(--color-bg-raised)', border: '1px solid var(--color-line)',
    borderRadius: 14, padding: 16,
  } as React.CSSProperties,
  tileBare: {
    border: '1px solid var(--color-line)', borderRadius: 14, padding: 16,
  } as React.CSSProperties,
  meta: { fontSize: 12, color: 'var(--color-ink-3)' } as React.CSSProperties,
  num: {
    fontFamily: 'var(--font-mono)', fontWeight: 500,
    fontFeatureSettings: '"tnum"',
  } as React.CSSProperties,
};

// ── Small reusable pieces ─────────────────────────────────────────────────────

function SegBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      style={{
        flex: 1, border: 'none', borderRadius: 7, padding: '7px 6px',
        fontSize: 12, fontWeight: active ? 500 : 400, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 140ms',
        background: active ? 'var(--color-bg-raised)' : 'transparent',
        color: active ? 'var(--color-ink)' : 'var(--color-ink-3)',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

function AccentPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px',
      borderRadius: 999, fontSize: 11, fontWeight: 500,
      background: 'var(--color-accent-soft)', color: 'var(--color-accent)',
    }}>
      {children}
    </span>
  );
}

function Stepper({
  label, value, onDecrement, onIncrement,
}: { label: string; value: number; onDecrement: () => void; onIncrement: () => void }) {
  const btn: React.CSSProperties = {
    width: 24, height: 24, border: 'none', background: 'var(--color-bg-sunk)',
    borderRadius: 6, cursor: 'pointer', color: 'var(--color-ink)',
    fontFamily: 'inherit', fontSize: 13,
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', background: 'var(--color-bg-raised)',
      borderRadius: 8, padding: 3,
    }}>
      <span style={{
        fontSize: 9.5, color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)',
        width: 28, paddingLeft: 6, textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {label}
      </span>
      <button onClick={onDecrement} style={btn}>−</button>
      <div style={{
        flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono)',
        fontWeight: 500, fontSize: 13,
      }}>
        {value}
      </div>
      <button onClick={onIncrement} style={btn}>+</button>
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

const CARDIO_TYPES = ['Running', 'Walking', 'Cycling', 'Other'] as const;
type CardioType = typeof CARDIO_TYPES[number];

export default function BuilderClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep]           = useState<'select' | 'review'>('select');
  const [view, setView]           = useState<'front' | 'back'>('front');
  const [selected, setSelected]   = useState<MuscleGroup[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [editedPlan, setEditedPlan] = useState<PlannedExercise[] | null>(null);

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
  const [cardioDuration, setCardioDuration] = useState('');
  const [cardioDistance, setCardioDistance] = useState('');

  const toggle = (g: MuscleGroup) =>
    setSelected((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );

  const basePlan = useMemo(
    () => applyLevel(buildPlan(selected), difficulty),
    [selected, difficulty]
  );
  const plan     = editedPlan ?? basePlan;
  const duration = estimateDuration(plan);

  const enterReview = () => {
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

  const buildEncoded = () => {
    const exercises = plan.map((ex) => ({
      name: ex.name, sets: ex.sets, reps: ex.reps, primary: ex.primary,
    }));
    const payload: Record<string, unknown> = { exercises };
    if (stretchBefore) payload.warmup   = true;
    if (stretchAfter)  payload.cooldown = true;
    if (addCardio && cardioDuration) {
      const cardio: Record<string, unknown> = { type: cardioType, durationMin: parseInt(cardioDuration, 10) };
      if (cardioDistance && cardioType !== 'Other') cardio.distanceMiles = parseFloat(cardioDistance);
      payload.cardio = cardio;
    }
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

  const page: React.CSSProperties = {
    minHeight: '100dvh', background: 'var(--color-bg)',
    color: 'var(--color-ink)', fontFamily: 'var(--font-sans)',
  };
  const scroll: React.CSSProperties = {
    maxWidth: 480, margin: '0 auto', padding: '8px 18px 100px',
  };

  // ── REVIEW STEP ─────────────────────────────────────────────────────────────
  if (step === 'review') {
    return (
      <div style={page}>
        <div style={scroll} className="fade-in">

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 4 }}>
            <button
              onClick={() => setStep('select')}
              style={{ background: 'none', border: 'none', color: 'var(--color-ink-3)', fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            >
              ← Edit
            </button>
            <div style={S.eyebrow}>Your plan</div>
            <div style={{ width: 40 }} />
          </div>

          {/* Title + meta */}
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1, margin: '0 0 4px', color: 'var(--color-ink)' }}>
            Custom session.
          </h1>
          <p style={{ ...S.meta, marginBottom: 20, marginTop: 0 }}>
            <span style={S.num}>{plan.length}</span> exercises
            {' · '}~<span style={S.num}>{duration}</span> min
            {' · '}{selected.length} muscle groups
          </p>

          {/* Body summary */}
          <div style={{ ...S.tile, padding: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
            <Body primary={selected} size={110} view={view} />
            <div style={{ flex: 1 }}>
              <div style={{ ...S.eyebrow, marginBottom: 6 }}>Targeting</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                {selected.map((g) => <AccentPill key={g}>{MUSCLE_LABELS[g]}</AccentPill>)}
              </div>
              <div style={{ display: 'flex', background: 'var(--color-bg-sunk)', borderRadius: 10, padding: 3, gap: 2, width: 130 }}>
                <SegBtn active={view === 'front'} onClick={() => setView('front')}>Front</SegBtn>
                <SegBtn active={view === 'back'}  onClick={() => setView('back')}>Back</SegBtn>
              </div>
            </div>
          </div>

          {/* Editable exercise list */}
          <div style={{ ...S.tileBare, marginBottom: 14 }}>
            <div style={{ ...S.eyebrow, marginBottom: 8 }}>Exercises · tap −/+ to adjust</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {plan.map((ex, i) => (
                <div key={i} style={{ padding: 10, background: 'var(--color-bg-sunk)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 14, color: 'var(--color-ink-4)', fontSize: 11, ...S.num }}>{i + 1}</span>
                    <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{ex.name}</div>
                    <button
                      onClick={() => removeExercise(i)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-ink-4)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Stepper label="Sets" value={ex.sets}
                      onDecrement={() => adjustField(i, 'sets', -1)}
                      onIncrement={() => adjustField(i, 'sets',  1)} />
                    <Stepper label="Reps" value={ex.reps}
                      onDecrement={() => adjustField(i, 'reps', -1)}
                      onIncrement={() => adjustField(i, 'reps',  1)} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stretching + cardio summary */}
          {(stretchBefore || stretchAfter || (addCardio && cardioDuration)) && (
            <div style={{ ...S.tileBare, marginBottom: 14 }}>
              <div style={{ ...S.eyebrow, marginBottom: 8 }}>Extras</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stretchBefore && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--color-bg-sunk)', borderRadius: 8 }}>
                    <span style={{ fontSize: 13 }}>🧘</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Warm-up stretching (before)</span>
                  </div>
                )}
                {addCardio && cardioDuration && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--color-bg-sunk)', borderRadius: 8 }}>
                    <span style={{ fontSize: 13 }}>🏃</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{cardioType} · {cardioDuration} min{cardioDistance && cardioType !== 'Other' ? ` · ${cardioDistance} mi` : ''}</span>
                  </div>
                )}
                {stretchAfter && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--color-bg-sunk)', borderRadius: 8 }}>
                    <span style={{ fontSize: 13 }}>🧘</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Cool-down stretching (after)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CTAs */}
          <button
            onClick={handleStart}
            disabled={isPending || plan.length === 0}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 10, border: 'none',
              background: 'var(--color-ink)', color: 'var(--color-bg)',
              fontSize: 15, fontWeight: 500, cursor: plan.length ? 'pointer' : 'default',
              fontFamily: 'inherit', opacity: isPending ? 0.6 : 1, marginBottom: 8,
              transition: 'opacity 160ms',
            }}
          >
            {isPending ? 'Starting…' : 'Start workout'}
          </button>
          <button
            onClick={() => setStep('select')}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 10,
              background: 'transparent', color: 'var(--color-ink)',
              border: '1px solid var(--color-line-2)', fontSize: 15,
              fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Adjust selection
          </button>

          {/* Schedule for later */}
          {schedSaved ? (
            <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: 'var(--color-moss)', fontWeight: 500 }}>
              ✓ Workout scheduled — see it in the Train tab
            </div>
          ) : !showSchedule ? (
            <button
              onClick={() => setShowSchedule(true)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: 'transparent', color: 'var(--color-ink-3)', border: '1px dashed var(--color-line-2)', fontSize: 14, fontWeight: 400, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}
            >
              Schedule for later
            </button>
          ) : (
            <div style={{ ...S.tile, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ ...S.eyebrow, marginBottom: 0 }}>Schedule workout</div>
              <div>
                <div style={{ ...S.eyebrow, marginBottom: 4 }}>Label (optional)</div>
                <input value={schedLabel} onChange={(e) => setSchedLabel(e.target.value)} placeholder={selected.map((g) => MUSCLE_LABELS[g]).join(' + ') || 'Workout'} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--color-line)', background: 'var(--color-bg-sunk)', color: 'var(--color-ink)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ ...S.eyebrow, marginBottom: 4 }}>Date</div>
                  <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} min={new Date().toLocaleDateString('sv')} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--color-line)', background: 'var(--color-bg-sunk)', color: 'var(--color-ink)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
                </div>
                <div>
                  <div style={{ ...S.eyebrow, marginBottom: 4 }}>Time</div>
                  <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--color-line)', background: 'var(--color-bg-sunk)', color: 'var(--color-ink)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
                </div>
              </div>
              <div>
                <div style={{ ...S.eyebrow, marginBottom: 4 }}>Remind me</div>
                <select value={schedReminder} onChange={(e) => setSchedReminder(Number(e.target.value))} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--color-line)', background: 'var(--color-bg-sunk)', color: 'var(--color-ink)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const }}>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                  <option value={0}>At start time (no early reminder)</option>
                </select>
              </div>
              {schedError && <div style={{ fontSize: 12, color: 'var(--color-accent)' }}>{schedError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSchedule} disabled={!schedDate || schedSaving} style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: schedDate && !schedSaving ? 'var(--color-ink)' : 'var(--color-bg-sunk)', color: schedDate && !schedSaving ? 'var(--color-bg)' : 'var(--color-ink-4)', fontSize: 13, fontWeight: 600, cursor: schedDate && !schedSaving ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                  {schedSaving ? 'Saving…' : 'Save schedule'}
                </button>
                <button onClick={() => setShowSchedule(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--color-line)', background: 'transparent', color: 'var(--color-ink-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── SELECT STEP ─────────────────────────────────────────────────────────────
  const n = selected.length;

  return (
    <div style={page}>
      <div style={scroll} className="fade-in">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 4 }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', color: 'var(--color-ink-3)', fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
          >
            ← Back
          </button>
          <div style={S.eyebrow}>Build workout</div>
          <button
            onClick={() => setSelected([])}
            disabled={!n}
            style={{
              background: 'none', border: 'none', fontSize: 13, padding: 0,
              fontFamily: 'inherit', cursor: n ? 'pointer' : 'default',
              color: n ? 'var(--color-accent)' : 'var(--color-ink-4)',
            }}
          >
            Clear
          </button>
        </div>

        {/* Title */}
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, lineHeight: 1.05, letterSpacing: '-0.02em', margin: '0 0 4px', color: 'var(--color-ink)' }}>
          Tap what<br />you want to train.
        </h1>
        <p style={{ ...S.meta, marginBottom: 14, marginTop: 0 }}>
          Tap muscle groups on the body. We'll build the plan.
        </p>

        {/* Experience level */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...S.eyebrow, marginBottom: 6 }}>Experience level</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, padding: 3, background: 'var(--color-bg-sunk)', borderRadius: 10 }}>
            {(Object.entries(LEVELS) as [Difficulty, (typeof LEVELS)[Difficulty]][]).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setDifficulty(k)}
                style={{
                  padding: '8px 4px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                  background: difficulty === k ? 'var(--color-bg-raised)' : 'transparent',
                  color:      difficulty === k ? 'var(--color-ink)'        : 'var(--color-ink-3)',
                  border: 'none', borderRadius: 7, fontWeight: difficulty === k ? 500 : 400,
                  boxShadow: difficulty === k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 140ms',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div style={{ ...S.meta, fontSize: 11, marginTop: 6 }}>{LEVELS[difficulty].hint}</div>
        </div>

        {/* Body diagram */}
        <div style={{ ...S.tile, padding: '14px 14px 10px', marginBottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          <div style={{ display: 'flex', background: 'var(--color-bg-sunk)', borderRadius: 10, padding: 3, gap: 2, position: 'absolute', top: 14, right: 14 }}>
            <SegBtn active={view === 'front'} onClick={() => setView('front')}>Front</SegBtn>
            <SegBtn active={view === 'back'}  onClick={() => setView('back')}>Back</SegBtn>
          </div>
          <Body primary={selected} view={view} size={240} onMuscleClick={toggle} />
          {!n && (
            <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', fontSize: 11.5, color: 'var(--color-ink-4)', fontStyle: 'italic' }}>
              Tap chest, quads, lats… any muscle group.
            </div>
          )}
        </div>

        {/* Selected pills */}
        {n > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ ...S.eyebrow, marginBottom: 6 }}>Selected · {n}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selected.map((g) => (
                <button
                  key={g}
                  onClick={() => toggle(g)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    height: 22, padding: '0 8px', borderRadius: 999,
                    fontSize: 11, fontWeight: 500, background: 'var(--color-accent-soft)',
                    color: 'var(--color-accent)', border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {MUSCLE_LABELS[g]}
                  <span style={{ opacity: 0.7, fontSize: 12 }}>×</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preset chips */}
        <div style={{ ...S.eyebrow, marginBottom: 8 }}>Or pick a split</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -18px', padding: '0 18px', marginBottom: 18 }}>
          {PRESETS.map((p) => {
            const active = p.groups.length === n && p.groups.every((g) => selected.includes(g));
            return (
              <button
                key={p.label}
                aria-pressed={active}
                onClick={() => setSelected(p.groups)}
                style={{
                  flexShrink: 0, padding: '8px 14px', borderRadius: 999,
                  background: active ? 'var(--color-ink)' : 'var(--color-bg-raised)',
                  border: `1px solid ${active ? 'var(--color-ink)' : 'var(--color-line)'}`,
                  color: active ? 'var(--color-bg)' : 'var(--color-ink-2)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all 160ms',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Live plan preview */}
        {n > 0 && (
          <div style={{ ...S.tileBare, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={S.eyebrow}>Plan preview</div>
              <span style={{ ...S.meta, fontSize: 11 }}>
                ~<span style={S.num}>{duration}</span> min
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {plan.map((ex, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--color-bg-sunk)', borderRadius: 8 }}>
                  <span style={{ width: 14, color: 'var(--color-ink-4)', fontSize: 11, ...S.num }}>{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{ex.name}</span>
                  <span style={{ ...S.num, fontSize: 11, color: 'var(--color-ink-3)' }}>{ex.sets}×{ex.reps}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stretching */}
        <div style={{ ...S.tile, padding: '14px', marginBottom: 14 }}>
          <div style={{ ...S.eyebrow, marginBottom: 8 }}>Stretching (optional)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              ['🧘 Before', stretchBefore, () => setStretchBefore((v) => !v)],
              ['🧘 After',  stretchAfter,  () => setStretchAfter((v)  => !v)],
            ] as [string, boolean, () => void][]).map(([label, active, toggle]) => (
              <button key={label} onClick={toggle} style={{
                flex: 1, padding: '9px 0', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${active ? 'var(--color-moss)' : 'var(--color-line)'}`,
                background: active ? 'var(--color-moss-soft)' : 'var(--color-bg-sunk)',
                color: active ? 'var(--color-moss)' : 'var(--color-ink-3)',
                fontSize: 12, fontWeight: active ? 600 : 400, fontFamily: 'inherit',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Cardio */}
        <div style={{ ...S.tile, padding: '14px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: addCardio ? 10 : 0 }}>
            <div style={S.eyebrow}>Cardio (optional)</div>
            <button onClick={() => setAddCardio((v) => !v)} style={{
              padding: '4px 10px', borderRadius: 20, border: `1px solid ${addCardio ? 'var(--color-accent)' : 'var(--color-line)'}`,
              background: addCardio ? 'var(--color-accent-soft)' : 'var(--color-bg-sunk)',
              color: addCardio ? 'var(--color-accent)' : 'var(--color-ink-3)',
              fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}>{addCardio ? 'Remove' : '+ Add'}</button>
          </div>
          {addCardio && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {CARDIO_TYPES.map((t) => (
                  <button key={t} onClick={() => setCardioType(t)} style={{
                    padding: '7px 4px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${cardioType === t ? 'var(--color-accent)' : 'var(--color-line)'}`,
                    background: cardioType === t ? 'var(--color-accent-soft)' : 'var(--color-bg-sunk)',
                    color: cardioType === t ? 'var(--color-accent)' : 'var(--color-ink-3)',
                    fontSize: 11, fontWeight: cardioType === t ? 600 : 400, fontFamily: 'inherit',
                  }}>{t === 'Running' ? 'Run' : t === 'Walking' ? 'Walk' : t === 'Cycling' ? 'Bike' : 'Other'}</button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: cardioType !== 'Other' ? '1fr 1fr' : '1fr', gap: 8 }}>
                <div>
                  <div style={{ ...S.eyebrow, marginBottom: 4 }}>Duration (min)</div>
                  <input
                    value={cardioDuration} onChange={(e) => setCardioDuration(e.target.value)}
                    type="number" min="1" placeholder="e.g. 20"
                    style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--color-line)', background: 'var(--color-bg-sunk)', color: 'var(--color-ink)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const }}
                  />
                </div>
                {cardioType !== 'Other' && (
                  <div>
                    <div style={{ ...S.eyebrow, marginBottom: 4 }}>Distance (mi, opt.)</div>
                    <input
                      value={cardioDistance} onChange={(e) => setCardioDistance(e.target.value)}
                      type="number" min="0" step="0.1" placeholder="e.g. 2.5"
                      style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--color-line)', background: 'var(--color-bg-sunk)', color: 'var(--color-ink)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={enterReview}
          disabled={!n}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 10, border: 'none',
            background: 'var(--color-ink)', color: 'var(--color-bg)',
            fontSize: 15, fontWeight: 500, cursor: n ? 'pointer' : 'default',
            fontFamily: 'inherit', opacity: n ? 1 : 0.4, transition: 'opacity 160ms',
          }}
        >
          Review plan{n > 0 ? ` · ${plan.length} exercises` : ''}
        </button>
      </div>
    </div>
  );
}
