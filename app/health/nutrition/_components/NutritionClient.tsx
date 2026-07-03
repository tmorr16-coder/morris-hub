"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import type { FoodResult } from "@/app/api/health/food-search/route";
import { addMeal, deleteMeal, toggleFavorite, logFavoriteMeal } from "../actions";
import type { MealType } from "../actions";
import ChatWidget from "../../_components/ChatWidget";
import { Segmented, Chip, Cell, Icons } from "@/components/ios";

export interface Meal {
  id: string;
  meal_type: MealType;
  name: string;
  calories_est: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
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

const cellInput: React.CSSProperties = {
  width: "100%", border: "none", background: "transparent",
  color: "var(--ios-label)", fontSize: 17, outline: "none", padding: 0,
  fontFamily: "inherit",
};
const searchField: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 10, border: "none",
  background: "var(--ios-fill)", color: "var(--ios-label)", fontSize: 17,
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};

const StarGlyph = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
  </svg>
);
const DeleteGlyph = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={21} height={21} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 12h7" /></svg>
);

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
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Food database search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleFoodSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); setShowResults(false); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/health/food-search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSearchResults(data.results ?? []);
        setShowResults(true);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, []);

  function selectFood(food: FoodResult) {
    const label = food.brand ? `${food.name} (${food.brand})` : food.name;
    setName(label);
    if (food.calories_per_serving != null) setCalories(String(food.calories_per_serving));
    if (food.protein_g != null) setProtein(String(food.protein_g));
    if (food.carbs_g != null) setCarbs(String(food.carbs_g));
    if (food.fat_g != null) setFat(String(food.fat_g));
    setSearchQuery("");
    setShowResults(false);
  }

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
        protein_g: protein ? parseFloat(protein) : null,
        carbs_g: carbs ? parseFloat(carbs) : null,
        fat_g: fat ? parseFloat(fat) : null,
        notes: notes.trim() || null,
      });
      if (!result.error && result.id) {
        onAdded({
          id: result.id,
          meal_type: mealType,
          name: name.trim(),
          calories_est: calories ? parseInt(calories) : null,
          protein_g: protein ? parseFloat(protein) : null,
          carbs_g: carbs ? parseFloat(carbs) : null,
          fat_g: fat ? parseFloat(fat) : null,
          notes: notes.trim() || null,
          is_favorite: false,
        });
      }
      setSaving(false);
    });
  }

  return (
    <>
      <div className="ios-sheet-backdrop" onClick={onClose} />
      <div className="ios-sheet">
        <div className="ios-grabber" />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div className="ios-headline">Add meal</div>
          <button onClick={onClose} className="ios-btn ios-btn--plain">Cancel</button>
        </div>

        {/* Meal type */}
        <Segmented
          options={MEAL_SECTIONS.map((s) => ({ value: s.type, label: s.label }))}
          value={mealType}
          onChange={setMealType}
          style={{ margin: "0 0 14px" }}
        />

        {/* Food database search */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <input
            value={searchQuery}
            onChange={(e) => handleFoodSearch(e.target.value)}
            placeholder="Search 3M+ foods — e.g. Greek yogurt…"
            autoFocus
            style={searchField}
          />
          {searching && (
            <span className="ios-footnote" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ios-label-3)" }}>…</span>
          )}
          {showResults && searchResults.length > 0 && (
            <div className="ios-list" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, marginTop: 4, maxHeight: 280, overflowY: "auto", boxShadow: "0 8px 28px rgba(0,0,0,0.18)" }}>
              {searchResults.map((food) => (
                <Cell
                  key={food.id}
                  chevron={false}
                  onClick={() => selectFood(food)}
                  title={food.brand ? `${food.name} · ${food.brand}` : food.name}
                  subtitle={[
                    `${food.serving_size_g}g serving`,
                    food.calories_per_serving != null ? `${food.calories_per_serving} cal` : null,
                    food.protein_g != null ? `${food.protein_g}g protein` : null,
                  ].filter(Boolean).join(" · ")}
                />
              ))}
              <Cell chevron={false} onClick={() => setShowResults(false)} title={<span style={{ color: "var(--ios-label-2)" }}>Close</span>} />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="ios-list" style={{ margin: 0 }}>
          <div className="ios-cell">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name — e.g. Chicken + rice bowl" style={cellInput} />
          </div>
          <div className="ios-cell">
            <span className="ios-cell-body"><span className="ios-cell-title" style={{ fontSize: 15, color: "var(--ios-label-2)" }}>Calories</span></span>
            <input value={calories} onChange={(e) => setCalories(e.target.value)} type="number" min="0" inputMode="numeric" placeholder="—" style={{ ...cellInput, width: 90, textAlign: "right" }} />
          </div>
          <div className="ios-cell">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, width: "100%" }}>
              {[
                { label: "Protein", val: protein, set: setProtein, color: "var(--ios-green)" },
                { label: "Carbs",   val: carbs,   set: setCarbs,   color: "var(--ios-orange)" },
                { label: "Fat",     val: fat,     set: setFat,     color: "var(--ios-red)" },
              ].map(({ label, val, set, color }) => (
                <div key={label}>
                  <div className="ios-caption" style={{ color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
                  <input value={val} onChange={(e) => set(e.target.value)} type="number" min="0" step="0.1" placeholder="—" inputMode="decimal" style={{ ...cellInput, textAlign: "center", background: "var(--ios-fill)", borderRadius: 8, padding: "8px 4px" }} />
                </div>
              ))}
            </div>
          </div>
          <div className="ios-cell">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes — portion size, restaurant… (optional)" style={cellInput} />
          </div>
        </div>

        <button
          disabled={!valid || saving}
          onClick={handleSave}
          className="ios-btn ios-btn--primary"
          style={{ marginTop: 16, opacity: valid && !saving ? 1 : 0.5 }}
        >
          {saving ? "Saving…" : "Add meal"}
        </button>
      </div>
    </>
  );
}

// TODO: Family nutrition view — household meal logging
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
          { id: crypto.randomUUID(), meal_type: mealType, name: fav.name, calories_est: fav.calories_est, protein_g: null, carbs_g: null, fat_g: null, notes: null, is_favorite: false },
        ]);
        setShowFavorites(false);
      }
    });
  }

  const nutritionSystemContext = `You are a nutrition coach. Give practical, evidence-based advice about meals, macros, calorie estimates, and healthy eating. Keep replies concise — 2-4 sentences. Be specific and helpful. Don't be preachy. If the user asks to estimate calories for a food, give a reasonable estimate with a brief explanation.`;

  const pct = calorieGoal ? Math.round((totalCalories / calorieGoal) * 100) : 0;
  const over = calorieGoal != null && totalCalories > calorieGoal;

  return (
    <div>

      {/* Calorie summary */}
      {(totalCalories > 0 || calorieGoal) && (
        <div className="ios-list" style={{ margin: "8px 16px 0", padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div className="ios-caption" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Today&apos;s calories</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span className="ios-num" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>{totalCalories.toLocaleString()}</span>
                {calorieGoal && <span className="ios-num" style={{ fontSize: 17, color: "var(--ios-label-2)" }}>/ {calorieGoal.toLocaleString()}</span>}
              </div>
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 3 }}>
                kcal · {meals.length} item{meals.length !== 1 ? "s" : ""}
              </div>
            </div>
            {calorieGoal && (
              <div style={{ textAlign: "right" }}>
                <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginBottom: 4 }}>{pct}% of goal</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: over ? "var(--ios-red)" : "var(--ios-green)" }}>
                  {over ? `+${(totalCalories - calorieGoal).toLocaleString()} over` : `${(calorieGoal - totalCalories).toLocaleString()} left`}
                </div>
              </div>
            )}
          </div>
          {calorieGoal && (
            <div style={{ height: 6, background: "var(--ios-fill)", borderRadius: 3, overflow: "hidden", marginTop: 14 }}>
              <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: over ? "var(--ios-red)" : "var(--ios-green)", borderRadius: 3, transition: "width 0.5s ease" }} />
            </div>
          )}
        </div>
      )}

      {/* Favorites strip */}
      {favorites.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 16px 7px" }}>
            <span className="ios-group-header" style={{ padding: 0 }}>Favorites</span>
            <button onClick={() => setShowFavorites(!showFavorites)} style={{ color: "var(--ios-tint)", fontSize: 15 }}>
              {showFavorites ? "Hide" : "Show all"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", padding: "0 16px" }}>
            {(showFavorites ? favorites : favorites.slice(0, 6)).map((fav) => (
              <Chip key={fav.id} onClick={() => handleLogFavorite(fav, "snack")}>
                {fav.name}{fav.calories_est ? ` · ${fav.calories_est}` : ""}
              </Chip>
            ))}
          </div>
        </>
      )}

      {/* Meal sections */}
      {MEAL_SECTIONS.map((section) => {
        const sectionMeals = meals.filter((m) => m.meal_type === section.type);
        const sectionCalories = sectionMeals.reduce((sum, m) => sum + (m.calories_est ?? 0), 0);

        return (
          <div key={section.type}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 16px 7px" }}>
              <span className="ios-group-header" style={{ padding: 0 }}>{section.icon} {section.label}</span>
              {sectionCalories > 0 && <span className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)" }}>{sectionCalories} kcal</span>}
            </div>
            <div className="ios-list" style={{ margin: "0 16px" }}>
              {sectionMeals.map((meal) => (
                <div key={meal.id} className="ios-cell" style={{ opacity: deletingId === meal.id ? 0.4 : 1, transition: "opacity 150ms" }}>
                  <span className="ios-cell-body">
                    <span className="ios-cell-title" style={{ fontSize: 16 }}>{meal.name}</span>
                    {meal.notes && <span className="ios-cell-sub">{meal.notes}</span>}
                  </span>
                  <span className="ios-cell-trail" style={{ gap: 10 }}>
                    {meal.calories_est != null && <span className="ios-num" style={{ fontSize: 15 }}>{meal.calories_est} kcal</span>}
                    <button onClick={() => handleToggleFavorite(meal)} aria-label={meal.is_favorite ? "Remove from favorites" : "Add to favorites"} style={{ color: meal.is_favorite ? "var(--ios-yellow)" : "var(--ios-label-3)", display: "flex" }}>
                      <StarGlyph filled={meal.is_favorite} />
                    </button>
                    <button onClick={() => handleDelete(meal.id)} disabled={deletingId === meal.id} aria-label="Delete meal" style={{ color: "var(--ios-red)", display: "flex" }}>
                      <DeleteGlyph />
                    </button>
                  </span>
                </div>
              ))}
              <Cell
                chevron={false}
                onClick={() => setAddingFor(section.type)}
                lead={<Icons.PlusIcon style={{ width: 20, height: 20, color: "var(--ios-tint)" }} />}
                title={<span style={{ color: "var(--ios-tint)" }}>Add {section.label.toLowerCase()}</span>}
              />
            </div>
          </div>
        );
      })}

      {/* Nutrition coach */}
      <div style={{ marginTop: 22 }}>
        <span className="ios-group-header">Nutrition coach</span>
        <div className="ios-list" style={{ margin: "0 16px", padding: "14px 16px" }}>
          <ChatWidget
            systemContext={nutritionSystemContext}
            placeholder="Ask about calories, macros, meal ideas…"
            welcomeMessage="Hi! Ask me to estimate calories, suggest meals, or discuss your nutrition goals."
            addProfileContext
          />
        </div>
      </div>

      <div style={{ height: 24 }} />

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
