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
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", margin: 0, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          🍽️ Meal plan
        </h2>
        <button onClick={() => setFormOpen((o) => !o)}
          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", cursor: "pointer" }}>
          {formOpen ? "Cancel" : "+ Plan a meal"}
        </button>
      </div>
      {formOpen && (
        <form onSubmit={addMeal} style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid var(--color-rule)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
          <select value={mealType} onChange={(e) => setMealType(e.target.value as Meal["meal_type"])}
            style={{ padding: "8px 10px", border: "1px solid var(--color-rule)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}>
            {Object.entries(MEAL_TYPE_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tacos"
            style={{ flex: 1, minWidth: 140, padding: "8px 12px", border: "1px solid var(--color-rule)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
          <button type="submit" disabled={saving || !name.trim()}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Save
          </button>
        </form>
      )}
      {meals.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>Nothing planned yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...byDay.entries()].map(([d, dayMeals]) => (
            <div key={d}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-ink-4)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {dayMeals.map((m) => (
                  <div key={m.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "7px 14px",
                    background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 8,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-ink-4)", width: 62, flexShrink: 0, textTransform: "uppercase" }}>
                      {MEAL_TYPE_LABEL[m.meal_type]}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--color-ink-2)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{m.name}</span>
                    <button onClick={() => remove(m.id)} aria-label="Remove"
                      style={{ background: "none", border: "none", color: "var(--color-ink-4)", cursor: "pointer", fontSize: 13, flexShrink: 0 }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
