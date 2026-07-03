"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Chip, Icons } from "@/components/ios";
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
      <div className="ios-footnote" style={{ fontWeight: 600, color: "var(--ios-label)" }}>
        {label}
      </div>
      <div className="ios-caption ios-num" style={{ color: "var(--ios-label-2)", background: "var(--ios-fill)", borderRadius: 20, padding: "2px 9px", minWidth: 22, textAlign: "center" }}>
        {count}
      </div>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="ios-footnote" style={{ padding: "14px 0", color: "var(--ios-label-3)", textAlign: "center" }}>
      {label}
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <div style={{ padding: "12px 0", borderTop: "1px solid var(--ios-separator)" }}>
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
    <div style={{ padding: "12px 0", borderTop: "1px solid var(--ios-separator)", display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)", marginBottom: 2 }}>
          {w.type.charAt(0).toUpperCase() + w.type.slice(1)}
          {w.effort && <span className="ios-footnote" style={{ fontWeight: 400, color: "var(--ios-label-2)", marginLeft: 8 }}>{EFFORT_LABEL[w.effort] ?? w.effort}</span>}
        </div>
        <div className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)" }}>
          {w.duration_min ? `${w.duration_min} min` : ""}
          {w.distance_miles ? ` · ${w.distance_miles} mi` : ""}
          {w.notes ? ` · ${w.notes}` : ""}
        </div>
      </div>
      <button onClick={() => setEditing(true)} style={iconBtn} title="Edit" aria-label="Edit"><EditIcon /></button>
      {confirmDelete ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={handleDelete} disabled={pending} style={{ ...btnSmall, background: "var(--ios-red)", color: "#fff", border: "none" }}>
            {pending ? "…" : "Delete"}
          </button>
          <button onClick={() => setConfirmDelete(false)} style={btnSmall}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} style={iconBtn} title="Delete" aria-label="Delete"><TrashIcon /></button>
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
      <div style={{ padding: "12px 0", borderTop: "1px solid var(--ios-separator)" }}>
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
    <div style={{ padding: "12px 0", borderTop: "1px solid var(--ios-separator)", display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)", marginBottom: 2 }}>
          {m.name}
          {m.calories_est ? <span className="ios-footnote ios-num" style={{ fontWeight: 400, color: "var(--ios-label-2)", marginLeft: 8 }}>{m.calories_est} cal</span> : null}
        </div>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
          {MEAL_LABEL[m.meal_type] ?? m.meal_type}
          {m.notes ? ` · ${m.notes}` : ""}
        </div>
      </div>
      <button onClick={() => setEditing(true)} style={iconBtn} title="Edit" aria-label="Edit"><EditIcon /></button>
      {confirmDelete ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={handleDelete} disabled={pending} style={{ ...btnSmall, background: "var(--ios-red)", color: "#fff", border: "none" }}>
            {pending ? "…" : "Delete"}
          </button>
          <button onClick={() => setConfirmDelete(false)} style={btnSmall}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} style={iconBtn} title="Delete" aria-label="Delete"><TrashIcon /></button>
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
      <div style={{ padding: "12px 0", borderTop: "1px solid var(--ios-separator)" }}>
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>Dose (mg)</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {DOSE_OPTIONS.map((d) => (
              <Chip key={d} small selected={doseMg === d} onClick={() => setDoseMg(d)}>
                {d}mg
              </Chip>
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
    <div style={{ padding: "12px 0", borderTop: "1px solid var(--ios-separator)", display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div className="ios-subhead ios-num" style={{ fontWeight: 600, color: "var(--ios-label)", marginBottom: 2 }}>
          Zepbound {dose.dose_mg}mg
        </div>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
          {dose.injection_site ?? "Site not recorded"}
          {dose.notes ? ` · ${dose.notes}` : ""}
        </div>
      </div>
      <button onClick={() => setEditing(true)} style={iconBtn} title="Edit" aria-label="Edit"><EditIcon /></button>
      {confirmDelete ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={handleDelete} disabled={pending} style={{ ...btnSmall, background: "var(--ios-red)", color: "#fff", border: "none" }}>
            {pending ? "…" : "Delete"}
          </button>
          <button onClick={() => setConfirmDelete(false)} style={btnSmall}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} style={iconBtn} title="Delete" aria-label="Delete"><TrashIcon /></button>
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
    <div style={{ padding: "4px 16px 100px" }}>

      {/* Date navigation */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => navigate(addDays(data.date, -1))}
            style={{ ...navBtn }}
            aria-label="Previous day"
          >
            <Icons.ChevronLeft style={{ width: 18, height: 18 }} />
          </button>

          <input
            type="date"
            value={data.date}
            max={data.today}
            onChange={(e) => e.target.value && navigate(e.target.value)}
            style={{
              flex: 1,
              padding: "11px 12px",
              border: "1px solid var(--ios-separator)",
              borderRadius: 10,
              background: "var(--ios-cell)",
              color: "var(--ios-label)",
              fontSize: 16,
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
            <Icons.ChevronRight style={{ width: 18, height: 18 }} />
          </button>

          {!isToday && (
            <button onClick={() => navigate(data.today)} style={btnGhost}>
              Today
            </button>
          )}
        </div>
      </div>

      {isFuture ? (
        <div className="ios-body" style={{ textAlign: "center", padding: "60px 0", color: "var(--ios-label-3)" }}>
          No data yet for future dates.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

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
                    borderTop: "1px solid var(--ios-separator)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)" }}>{med.name}</div>
                    <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
                      {med.dose ?? ""}
                      {med.schedule ? ` · ${med.schedule}` : ""}
                    </div>
                  </div>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--ios-label-3)",
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
  background: "var(--ios-cell)",
  borderRadius: "var(--ios-radius-card)",
  padding: "16px 16px 4px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ios-label-2)",
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  border: "1px solid var(--ios-separator)",
  borderRadius: 8,
  background: "var(--ios-bg)",
  color: "var(--ios-label)",
  fontSize: 16,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "none",
  background: "var(--ios-tint)",
  color: "var(--ios-on-tint)",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnGhost: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid var(--ios-separator)",
  background: "transparent",
  color: "var(--ios-tint)",
  fontSize: 15,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnSmall: React.CSSProperties = {
  padding: "6px 11px",
  borderRadius: 8,
  border: "1px solid var(--ios-separator)",
  background: "transparent",
  color: "var(--ios-label-2)",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--ios-label-2)",
  padding: "2px 4px",
  borderRadius: 6,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
};

const navBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: "1px solid var(--ios-separator)",
  background: "var(--ios-cell)",
  color: "var(--ios-label-2)",
  cursor: "pointer",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
