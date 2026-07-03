"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Meal {
  id: string;
  date: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

const MEAL_TYPE_LABEL: Record<Meal["meal_type"], string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack",
};

export default function MealPlan({
  initialMeals, userId,
}: {
  initialMeals: Meal[];
  userId: string;
}) {
  const [meals, setMeals] = useState(initialMeals);
  const [name, setName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mealType, setMealType] = useState<Meal["meal_type"]>("dinner");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any;

  async function addMeal(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await db.schema("hub").from("meal_plan")
      .insert({ date, meal_type: mealType, name: name.trim(), circle_owner_id: userId, created_by: userId })
      .select("id, date, meal_type, name, notes, created_by, created_at")
      .single();
    setSaving(false);
    if (!error && data) {
      setMeals((prev) => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
      setName("");
      setFormOpen(false);
    }
  }

  async function remove(id: string) {
    setMeals((prev) => prev.filter((m) => m.id !== id));
    await db.schema("hub").from("meal_plan").delete().eq("id", id);
  }

  const byDay = new Map<string, Meal[]>();
  for (const m of meals) {
    if (!byDay.has(m.date)) byDay.set(m.date, []);
    byDay.get(m.date)!.push(m);
  }

  return (
    <section className="ios-group">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--ios-gutter) 7px" }}>
        <h2 className="ios-group-header" style={{ padding: 0 }}>Meal plan</h2>
        <button onClick={() => setFormOpen((o) => !o)} className="ios-subhead" style={{ color: "var(--ios-tint)", fontWeight: 500 }}>
          {formOpen ? "Cancel" : "Plan a meal"}
        </button>
      </div>
      {formOpen && (
        <form onSubmit={addMeal} style={{ display: "flex", gap: 8, margin: "0 var(--ios-gutter) 10px", flexWrap: "wrap" }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={{ padding: "10px 12px", border: "var(--ios-hair) solid var(--ios-separator)", borderRadius: 10, background: "var(--ios-cell)", color: "var(--ios-label)", fontSize: 15 }} />
          <select value={mealType} onChange={(e) => setMealType(e.target.value as Meal["meal_type"])}
            style={{ padding: "10px 12px", border: "var(--ios-hair) solid var(--ios-separator)", borderRadius: 10, background: "var(--ios-cell)", color: "var(--ios-label)", fontSize: 15 }}>
            {Object.entries(MEAL_TYPE_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tacos"
            style={{ flex: 1, minWidth: 140, padding: "10px 14px", border: "var(--ios-hair) solid var(--ios-separator)", borderRadius: 10, background: "var(--ios-cell)", color: "var(--ios-label)", fontSize: 16 }} />
          <button type="submit" disabled={saving || !name.trim()} className="ios-btn ios-btn--primary" style={{ width: "auto", minHeight: 0, padding: "10px 18px", fontSize: 15, opacity: saving || !name.trim() ? 0.5 : 1 }}>
            Save
          </button>
        </form>
      )}
      {meals.length === 0 ? (
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "0 var(--ios-gutter)" }}>Nothing planned yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {[...byDay.entries()].map(([d, dayMeals]) => (
            <div key={d}>
              <h3 className="ios-group-header">
                {new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </h3>
              <div className="ios-list">
                {dayMeals.map((m) => (
                  <div key={m.id} className="ios-cell">
                    <span className="ios-caption" style={{ color: "var(--ios-label-2)", width: 62, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 600 }}>
                      {MEAL_TYPE_LABEL[m.meal_type]}
                    </span>
                    <span className="ios-cell-body">
                      <span className="ios-cell-title ios-subhead">{m.name}</span>
                    </span>
                    <button onClick={() => remove(m.id)} aria-label="Remove" className="ios-cell-trail" style={{ color: "var(--ios-label-3)" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
