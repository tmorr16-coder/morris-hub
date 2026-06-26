"use client";

import { useState, useTransition, useEffect } from "react";
import { addMeal, deleteMeal, toggleFavorite, logFavoriteMeal } from "../actions";
import type { MealType } from "../actions";
import ChatWidget from "../../_components/ChatWidget";

export interface Meal {
  id: string;
  meal_type: MealType;
  name: string;
  calories_est: number | null;
  notes: string | null;
  is_favorite: boolean;
}

interface Props {
  date: string;
  meals: Meal[];
  favorites: Meal[];
}

const MEAL_SECTIONS: { type: MealType; label: string; icon: string }[] = [
  { type: "breakfast", label: "Breakfast", icon: "🍳" },
  { type: "lunch",     label: "Lunch",     icon: "🥗" },
  { type: "dinner",    label: "Dinner",    icon: "🍽️" },
  { type: "snack",     label: "Snack",     icon: "🍎" },
];

const eyebrow: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--color-ink-3)",
  marginBottom: 6,
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--color-line)",
  background: "var(--color-bg-sunk)",
  color: "var(--color-ink)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

function AddMealSheet({
  date,
  defaultType,
  onClose,
  onAdded,
}: {
  date: string;
  defaultType: MealType;
  onClose: () => void;
  onAdded: (meal: Meal) => void;
}) {
  const [, startTransition] = useTransition();
  const [mealType, setMealType] = useState<MealType>(defaultType);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const valid = name.trim().length > 0;

  function handleSave() {
    if (!valid) return;
    setSaving(true);
    startTransition(async () => {
      const result = await addMeal({
        date,
        meal_type: mealType,
        name: name.trim(),
        calories_est: calories ? parseInt(calories) : null,
        notes: notes.trim() || null,
      });
      if (!result.error && result.id) {
        onAdded({
          id: result.id,
          meal_type: mealType,
          name: name.trim(),
          calories_est: calories ? parseInt(calories) : null,
          notes: notes.trim() || null,
          is_favorite: false,
        });
      }
      setSaving(false);
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "relative",
          background: "var(--color-bg)",
          borderRadius: "18px 18px 0 0",
          padding: "20px 20px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink)" }}>Add meal</div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 20, color: "var(--color-ink-3)", cursor: "pointer", padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* Meal type tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {MEAL_SECTIONS.map((s) => (
            <button
              key={s.type}
              onClick={() => setMealType(s.type)}
              style={{
                flex: 1,
                padding: "7px 4px",
                borderRadius: 8,
                border: `1px solid ${mealType === s.type ? "var(--color-accent)" : "var(--color-line)"}`,
                background: mealType === s.type ? "var(--color-accent-soft)" : "var(--color-bg-raised)",
                color: mealType === s.type ? "var(--color-accent)" : "var(--color-ink-3)",
                fontSize: 11,
                fontWeight: mealType === s.type ? 600 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Food name */}
        <div>
          <div style={eyebrow}>What did you eat?</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chicken + rice bowl"
            autoFocus
            style={fieldInput}
          />
        </div>

        {/* Calories */}
        <div>
          <div style={eyebrow}>Calories (optional)</div>
          <input
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            type="number"
            min="0"
            placeholder="e.g. 450"
            inputMode="numeric"
            style={fieldInput}
          />
        </div>

        {/* Notes */}
        <div>
          <div style={eyebrow}>Notes (optional)</div>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Portion size, restaurant, etc."
            style={fieldInput}
          />
        </div>

        <button
          disabled={!valid || saving}
          onClick={handleSave}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: valid && !saving ? "var(--color-ink)" : "var(--color-bg-sunk)",
            color: valid && !saving ? "var(--color-bg)" : "var(--color-ink-3)",
            fontSize: 15,
            fontWeight: 600,
            cursor: valid && !saving ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}
        >
          {saving ? "Saving…" : "Add meal"}
        </button>
      </div>
    </div>
  );
}

export default function NutritionClient({ date, meals: initialMeals, favorites: initialFavorites }: Props) {
  const [meals, setMeals] = useState<Meal[]>(initialMeals);
  const [favorites, setFavorites] = useState<Meal[]>(initialFavorites);
  const [, startTransition] = useTransition();
  const [addingFor, setAddingFor] = useState<MealType | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);

  const totalCalories = meals.reduce((sum, m) => sum + (m.calories_est ?? 0), 0);
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("health-dashboard-profile");
      if (raw) {
        const p = JSON.parse(raw);
        const goal = parseInt(p.calorieGoal);
        if (goal > 0) setCalorieGoal(goal);
      }
    } catch { /* ignore */ }
  }, []);

  function handleAdded(meal: Meal) {
    setMeals((prev) => [...prev, meal]);
    setAddingFor(null);
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      await deleteMeal(id);
      setMeals((prev) => prev.filter((m) => m.id !== id));
      setDeletingId(null);
    });
  }

  function handleToggleFavorite(meal: Meal) {
    const newVal = !meal.is_favorite;
    setMeals((prev) => prev.map((m) => m.id === meal.id ? { ...m, is_favorite: newVal } : m));
    if (newVal) {
      setFavorites((prev) => [...prev, { ...meal, is_favorite: true }]);
    } else {
      setFavorites((prev) => prev.filter((f) => f.name !== meal.name));
    }
    startTransition(async () => {
      await toggleFavorite(meal.id, newVal);
    });
  }

  function handleLogFavorite(fav: Meal, mealType: MealType) {
    startTransition(async () => {
      const result = await logFavoriteMeal({
        date,
        meal_type: mealType,
        name: fav.name,
        calories_est: fav.calories_est,
      });
      if (!result.error) {
        // Reload by revalidation — or optimistically add
        setMeals((prev) => [
          ...prev,
          { id: crypto.randomUUID(), meal_type: mealType, name: fav.name, calories_est: fav.calories_est, notes: null, is_favorite: false },
        ]);
        setShowFavorites(false);
      }
    });
  }

  const nutritionSystemContext = `You are a nutrition coach. Give practical, evidence-based advice about meals, macros, calorie estimates, and healthy eating. Keep replies concise — 2-4 sentences. Be specific and helpful. Don't be preachy. If the user asks to estimate calories for a food, give a reasonable estimate with a brief explanation.`;

  return (
    <div style={{ padding: "20px 20px 0" }}>

      {/* Header */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
          marginBottom: 6,
        }}
      >
        Nutrition
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 36,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          color: "var(--color-ink)",
          marginBottom: 20,
        }}
      >
        Today&apos;s
        <br />
        <span style={{ color: "var(--color-accent)" }}>meals.</span>
      </div>

      {/* Calorie summary */}
      {(totalCalories > 0 || calorieGoal) && (
        <div
          style={{
            background: "var(--color-ink)",
            borderRadius: 14,
            padding: "16px 18px",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ ...eyebrow, color: "rgba(244,241,236,0.5)", marginBottom: 4 }}>Today&apos;s calories</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 32,
                    fontWeight: 400,
                    letterSpacing: "-0.02em",
                    color: "var(--color-bg)",
                    lineHeight: 1,
                  }}
                >
                  {totalCalories.toLocaleString()}
                </div>
                {calorieGoal && (
                  <div style={{ fontSize: 14, color: "rgba(244,241,236,0.45)", lineHeight: 1 }}>
                    / {calorieGoal.toLocaleString()}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: "rgba(244,241,236,0.4)", marginTop: 3 }}>
                kcal · {meals.length} item{meals.length !== 1 ? "s" : ""}
              </div>
            </div>
            {calorieGoal && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "rgba(244,241,236,0.45)", marginBottom: 4 }}>
                  {Math.round((totalCalories / calorieGoal) * 100)}% of goal
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: totalCalories > calorieGoal ? "var(--color-accent)" : "var(--color-moss)" }}>
                  {totalCalories > calorieGoal
                    ? `+${(totalCalories - calorieGoal).toLocaleString()} over`
                    : `${(calorieGoal - totalCalories).toLocaleString()} left`}
                </div>
              </div>
            )}
          </div>
          {/* Progress bar */}
          {calorieGoal && (
            <div style={{ height: 6, background: "rgba(244,241,236,0.15)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min((totalCalories / calorieGoal) * 100, 100)}%`,
                  height: "100%",
                  background: totalCalories > calorieGoal ? "var(--color-accent)" : "var(--color-moss)",
                  borderRadius: 3,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Favorites strip */}
      {favorites.length > 0 && (
        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px solid var(--color-line)",
            borderRadius: 14,
            padding: "12px 16px",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={eyebrow}>⭐ Favorites</div>
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              style={{ background: "none", border: "none", fontSize: 11, color: "var(--color-ink-4)", cursor: "pointer", fontFamily: "inherit" }}
            >
              {showFavorites ? "Hide" : "Show all"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {(showFavorites ? favorites : favorites.slice(0, 4)).map((fav) => (
              <button
                key={fav.id}
                onClick={() => handleLogFavorite(fav, "snack")}
                title={`Log as snack: ${fav.name}`}
                style={{
                  flexShrink: 0,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--color-line)",
                  background: "var(--color-bg-sunk)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-ink)", whiteSpace: "nowrap" }}>
                  {fav.name}
                </div>
                {fav.calories_est && (
                  <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 1 }}>
                    {fav.calories_est} kcal
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Meal sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        {MEAL_SECTIONS.map((section) => {
          const sectionMeals = meals.filter((m) => m.meal_type === section.type);
          const sectionCalories = sectionMeals.reduce((sum, m) => sum + (m.calories_est ?? 0), 0);

          return (
            <div
              key={section.type}
              style={{
                background: "var(--color-bg-raised)",
                border: "1px solid var(--color-line)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {/* Section header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom: sectionMeals.length > 0 ? "1px solid var(--color-line)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{section.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>
                      {section.label}
                    </div>
                    {sectionCalories > 0 && (
                      <div style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
                        {sectionCalories} kcal
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setAddingFor(section.type)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-line)",
                    background: "var(--color-bg-sunk)",
                    color: "var(--color-ink-3)",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  + Add
                </button>
              </div>

              {/* Meal items */}
              {sectionMeals.length > 0 && (
                <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                  {sectionMeals.map((meal) => (
                    <div
                      key={meal.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 4px",
                        opacity: deletingId === meal.id ? 0.4 : 1,
                        transition: "opacity 150ms",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink)" }}>
                          {meal.name}
                        </div>
                        {meal.notes && (
                          <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 1 }}>
                            {meal.notes}
                          </div>
                        )}
                      </div>
                      {meal.calories_est && (
                        <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-ink-3)", flexShrink: 0 }}>
                          {meal.calories_est} kcal
                        </div>
                      )}
                      {/* Favorite star */}
                      <button
                        onClick={() => handleToggleFavorite(meal)}
                        title={meal.is_favorite ? "Remove from favorites" : "Add to favorites"}
                        style={{
                          background: "none",
                          border: "none",
                          fontSize: 14,
                          cursor: "pointer",
                          color: meal.is_favorite ? "#f5a623" : "var(--color-ink-4)",
                          padding: 4,
                          flexShrink: 0,
                        }}
                      >
                        {meal.is_favorite ? "⭐" : "☆"}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(meal.id)}
                        disabled={deletingId === meal.id}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid var(--color-line)",
                          background: "var(--color-bg-sunk)",
                          color: "var(--color-ink-4)",
                          fontSize: 13,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontFamily: "inherit",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Nutrition coach */}
      <div
        style={{
          background: "var(--color-bg-raised)",
          border: "1px solid var(--color-line)",
          borderRadius: 14,
          padding: "16px",
          marginBottom: 8,
        }}
      >
        <div style={{ ...eyebrow, marginBottom: 12 }}>Nutrition coach</div>
        <ChatWidget
          systemContext={nutritionSystemContext}
          placeholder="Ask about calories, macros, meal ideas…"
          welcomeMessage="Hi! Ask me to estimate calories, suggest meals, or discuss your nutrition goals."
          addProfileContext
        />
      </div>

      {/* Add meal sheet */}
      {addingFor && (
        <AddMealSheet
          date={date}
          defaultType={addingFor}
          onClose={() => setAddingFor(null)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}
