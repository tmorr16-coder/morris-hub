"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  updateWorkoutSession,
  deleteWorkout,
  updateMeal,
  deleteMealEntry,
  updateDose,
  deleteDose,
} from "../actions";

// ── Types ────────────────────────────────────────────────────

export interface Workout {
  id: string;
  date: string;
  type: string;
  duration_min: number | null;
  effort: string | null;
  notes: string | null;
  distance_miles: number | null;
}

export interface Meal {
  id: string;
  meal_type: string;
  name: string;
  calories_est: number | null;
  notes: string | null;
}

export interface Dose {
  id: string;
  date: string;
  dose_mg: number;
  injection_site: string | null;
  notes: string | null;
}

export interface Medication {
  id: string;
  name: string;
  dose: string | null;
  schedule: string | null;
}

export interface DayData {
  date: string;
  today: string;
  workouts: Workout[];
  meals: Meal[];
  dose: Dose | null;
  medications: Medication[];
}

// ── Constants ────────────────────────────────────────────────

const WORKOUT_TYPES = ["resistance", "running", "biking", "swimming", "walking", "yoga", "sauna", "other"];
const EFFORT_LEVELS = ["easy", "moderate", "hard", "allout"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
const DOSE_OPTIONS = [2.5, 5, 7.5, 10, 12.5, 15];
const INJECTION_SITES = ["Left abdomen", "Right abdomen", "Left thigh", "Right thigh", "Left arm", "Right arm"];

const EFFORT_LABEL: Record<string, string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
  allout: "All-out",
};

const MEAL_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

// ── Helpers ──────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv");
}

// ── Section header ────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: "var(--color-ink-4)", background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 20, padding: "1px 8px" }}>
        {count}
      </div>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div style={{ padding: "14px 0", fontSize: 13, color: "var(--color-ink-4)", textAlign: "center" }}>
      {label}
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

// ── Workout card ──────────────────────────────────────────────

function WorkoutRow({ w, onDeleted }: { w: Workout; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const [type, setType] = useState(w.type);
  const [duration, setDuration] = useState(String(w.duration_min ?? ""));
  const [effort, setEffort] = useState(w.effort ?? "");
  const [notes, setNotes] = useState(w.notes ?? "");
  const [distance, setDistance] = useState(String(w.distance_miles ?? ""));
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSave() {
    startTransition(async () => {
      await updateWorkoutSession(w.id, {
        type,
        duration_min: duration ? parseInt(duration) : undefined,
        effort: effort || null,
        notes: notes || null,
        distance_miles: distance ? parseFloat(distance) : null,
      });
      setEditing(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteWorkout(w.id);
      onDeleted();
    });
  }

  const isCardio = ["running", "biking", "swimming", "walking"].includes(type);

  if (editing) {
    return (
      <div style={{ padding: "12px 0", borderTop: "1px solid var(--color-line)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
              {WORKOUT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Duration (min)</label>
            <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} style={inputStyle} min={1} />
          </div>
          {isCardio && (
            <div>
              <label style={labelStyle}>Distance (mi)</label>
              <input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} style={inputStyle} step={0.1} min={0} />
            </div>
          )}
          <div>
            <label style={labelStyle}>Effort</label>
            <select value={effort} onChange={(e) => setEffort(e.target.value)} style={inputStyle}>
              <option value="">—</option>
              {EFFORT_LEVELS.map((e) => <option key={e} value={e}>{EFFORT_LABEL[e]}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} placeholder="Optional" />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSave} disabled={pending} style={btnPrimary}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} style={btnGhost}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 0", borderTop: "1px solid var(--color-line)", display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", marginBottom: 2 }}>
          {w.type.charAt(0).toUpperCase() + w.type.slice(1)}
          {w.effort && <span style={{ fontWeight: 400, color: "var(--color-ink-3)", fontSize: 12, marginLeft: 8 }}>{EFFORT_LABEL[w.effort] ?? w.effort}</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
          {w.duration_min ? `${w.duration_min} min` : ""}
          {w.distance_miles ? ` · ${w.distance_miles} mi` : ""}
          {w.notes ? ` · ${w.notes}` : ""}
        </div>
      </div>
      <button onClick={() => setEditing(true)} style={iconBtn} title="Edit"><EditIcon /></button>
      {confirmDelete ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={handleDelete} disabled={pending} style={{ ...btnSmall, background: "#ef4444", color: "#fff", border: "none" }}>
            {pending ? "…" : "Delete"}
          </button>
          <button onClick={() => setConfirmDelete(false)} style={btnSmall}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} style={iconBtn} title="Delete"><TrashIcon /></button>
      )}
    </div>
  );
}

// ── Meal card ─────────────────────────────────────────────────

function MealRow({ m, onDeleted }: { m: Meal; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const [mealType, setMealType] = useState(m.meal_type);
  const [name, setName] = useState(m.name);
  const [calories, setCalories] = useState(String(m.calories_est ?? ""));
  const [notes, setNotes] = useState(m.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSave() {
    startTransition(async () => {
      await updateMeal(m.id, {
        meal_type: mealType,
        name: name.trim(),
        calories_est: calories ? parseInt(calories) : null,
        notes: notes.trim() || null,
      });
      setEditing(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteMealEntry(m.id);
      onDeleted();
    });
  }

  if (editing) {
    return (
      <div style={{ padding: "12px 0", borderTop: "1px solid var(--color-line)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div>
            <label style={labelStyle}>Meal</label>
            <select value={mealType} onChange={(e) => setMealType(e.target.value)} style={inputStyle}>
              {MEAL_TYPES.map((t) => <option key={t} value={t}>{MEAL_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Calories</label>
            <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} style={inputStyle} min={0} placeholder="Optional" />
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>Food</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} placeholder="Optional" />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSave} disabled={pending || !name.trim()} style={btnPrimary}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} style={btnGhost}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 0", borderTop: "1px solid var(--color-line)", display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", marginBottom: 2 }}>
          {m.name}
          {m.calories_est ? <span style={{ fontWeight: 400, color: "var(--color-ink-3)", fontSize: 12, marginLeft: 8 }}>{m.calories_est} cal</span> : null}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
          {MEAL_LABEL[m.meal_type] ?? m.meal_type}
          {m.notes ? ` · ${m.notes}` : ""}
        </div>
      </div>
      <button onClick={() => setEditing(true)} style={iconBtn} title="Edit"><EditIcon /></button>
      {confirmDelete ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={handleDelete} disabled={pending} style={{ ...btnSmall, background: "#ef4444", color: "#fff", border: "none" }}>
            {pending ? "…" : "Delete"}
          </button>
          <button onClick={() => setConfirmDelete(false)} style={btnSmall}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} style={iconBtn} title="Delete"><TrashIcon /></button>
      )}
    </div>
  );
}

// ── Dose card ─────────────────────────────────────────────────

function DoseRow({ dose, onDeleted }: { dose: Dose; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const [doseMg, setDoseMg] = useState(dose.dose_mg);
  const [site, setSite] = useState(dose.injection_site ?? "");
  const [notes, setNotes] = useState(dose.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSave() {
    startTransition(async () => {
      await updateDose(dose.id, { dose_mg: doseMg, injection_site: site || undefined, notes: notes || null });
      setEditing(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteDose(dose.id);
      onDeleted();
    });
  }

  if (editing) {
    return (
      <div style={{ padding: "12px 0", borderTop: "1px solid var(--color-line)" }}>
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>Dose (mg)</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {DOSE_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDoseMg(d)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: `1px solid ${doseMg === d ? "var(--color-ink)" : "var(--color-line)"}`,
                  background: doseMg === d ? "var(--color-ink)" : "transparent",
                  color: doseMg === d ? "var(--color-bg)" : "var(--color-ink-3)",
                  fontSize: 13,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {d}mg
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>Injection site</label>
          <select value={site} onChange={(e) => setSite(e.target.value)} style={inputStyle}>
            <option value="">—</option>
            {INJECTION_SITES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} placeholder="Optional" />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSave} disabled={pending} style={btnPrimary}>{pending ? "Saving…" : "Save"}</button>
          <button onClick={() => setEditing(false)} style={btnGhost}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 0", borderTop: "1px solid var(--color-line)", display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", marginBottom: 2 }}>
          Zepbound {dose.dose_mg}mg
        </div>
        <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
          {dose.injection_site ?? "Site not recorded"}
          {dose.notes ? ` · ${dose.notes}` : ""}
        </div>
      </div>
      <button onClick={() => setEditing(true)} style={iconBtn} title="Edit"><EditIcon /></button>
      {confirmDelete ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={handleDelete} disabled={pending} style={{ ...btnSmall, background: "#ef4444", color: "#fff", border: "none" }}>
            {pending ? "…" : "Delete"}
          </button>
          <button onClick={() => setConfirmDelete(false)} style={btnSmall}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} style={iconBtn} title="Delete"><TrashIcon /></button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function DayViewClient({ data }: { data: DayData }) {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>(data.workouts);
  const [meals, setMeals] = useState<Meal[]>(data.meals);
  const [dose, setDose] = useState<Dose | null>(data.dose);

  // When data changes (server re-render after navigation), sync state
  const dateKey = data.date;

  function navigate(newDate: string) {
    router.push(`/health/day?date=${newDate}`);
  }

  const isPast = data.date < data.today;
  const isToday = data.date === data.today;
  const isFuture = data.date > data.today;

  const totalCalories = meals.reduce((s, m) => s + (m.calories_est ?? 0), 0);

  return (
    <div style={{ padding: "20px 20px 100px" }}>

      {/* Date navigation */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => navigate(addDays(data.date, -1))}
            style={{ ...navBtn }}
            aria-label="Previous day"
          >
            ←
          </button>

          <input
            type="date"
            value={data.date}
            max={data.today}
            onChange={(e) => e.target.value && navigate(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "1px solid var(--color-line)",
              borderRadius: 10,
              background: "var(--color-bg-raised)",
              color: "var(--color-ink)",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
            }}
          />

          <button
            onClick={() => navigate(addDays(data.date, 1))}
            disabled={isToday}
            style={{ ...navBtn, opacity: isToday ? 0.3 : 1, cursor: isToday ? "default" : "pointer" }}
            aria-label="Next day"
          >
            →
          </button>

          {!isToday && (
            <button onClick={() => navigate(data.today)} style={btnGhost}>
              Today
            </button>
          )}
        </div>
      </div>

      {isFuture ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-ink-4)", fontSize: 14 }}>
          No data yet for future dates.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Training */}
          <div style={card}>
            <SectionHeader label="Training" count={workouts.length} />
            {workouts.length === 0 ? (
              <EmptyRow label="No workouts logged" />
            ) : (
              workouts.map((w) => (
                <WorkoutRow
                  key={w.id}
                  w={w}
                  onDeleted={() => setWorkouts((prev) => prev.filter((x) => x.id !== w.id))}
                />
              ))
            )}
          </div>

          {/* Meals */}
          <div style={card}>
            <SectionHeader
              label={`Meals${totalCalories > 0 ? ` · ${totalCalories.toLocaleString()} cal` : ""}`}
              count={meals.length}
            />
            {meals.length === 0 ? (
              <EmptyRow label="No meals logged" />
            ) : (
              meals.map((m) => (
                <MealRow
                  key={m.id}
                  m={m}
                  onDeleted={() => setMeals((prev) => prev.filter((x) => x.id !== m.id))}
                />
              ))
            )}
          </div>

          {/* Medications */}
          <div style={card}>
            <SectionHeader label="Medications" count={data.medications.length + (dose ? 1 : 0)} />

            {dose && (
              <DoseRow
                dose={dose}
                onDeleted={() => setDose(null)}
              />
            )}

            {data.medications.length === 0 && !dose ? (
              <EmptyRow label="No medications on record" />
            ) : (
              data.medications.map((med, i) => (
                <div
                  key={med.id}
                  style={{
                    padding: "12px 0",
                    borderTop: "1px solid var(--color-line)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>{med.name}</div>
                    <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
                      {med.dose ?? ""}
                      {med.schedule ? ` · ${med.schedule}` : ""}
                    </div>
                  </div>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--color-ink-4)",
                    flexShrink: 0,
                  }} />
                </div>
              ))
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "var(--color-bg-raised)",
  border: "1px solid var(--color-line)",
  borderRadius: 16,
  padding: "16px 16px 4px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-ink-3)",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--color-line)",
  borderRadius: 8,
  background: "var(--color-bg)",
  color: "var(--color-ink)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: 10,
  border: "none",
  background: "var(--color-ink)",
  color: "var(--color-bg)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnGhost: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 10,
  border: "1px solid var(--color-line)",
  background: "transparent",
  color: "var(--color-ink-3)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnSmall: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 7,
  border: "1px solid var(--color-line)",
  background: "transparent",
  color: "var(--color-ink-3)",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 14,
  padding: "2px 4px",
  borderRadius: 6,
  flexShrink: 0,
};

const navBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: "1px solid var(--color-line)",
  background: "var(--color-bg-raised)",
  color: "var(--color-ink-3)",
  fontSize: 16,
  cursor: "pointer",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
