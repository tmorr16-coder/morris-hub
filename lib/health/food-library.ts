// Curated US food library — a fast, always-available fallback for the meal-log
// search. Macros are per the listed serving and drawn from typical US nutrition
// labels / USDA reference values. Used when the USDA FoodData Central API key is
// absent, and merged ahead of remote results for instant common-food matches.

import type { FoodResult } from "@/app/api/health/food-search/route";

export interface LocalFood {
  name: string;
  brand?: string;
  serving: string;          // human-readable serving description
  serving_size_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  keywords?: string[];      // extra search terms
}

// ~90 common US foods across proteins, dairy, grains, produce, nuts, snacks,
// beverages, and popular restaurant/fast-food staples.
export const US_FOOD_LIBRARY: LocalFood[] = [
  // ── Proteins ────────────────────────────────────────────────────────────────
  { name: "Chicken breast, grilled", serving: "4 oz (113 g)", serving_size_g: 113, calories: 187, protein_g: 35, carbs_g: 0, fat_g: 4, keywords: ["poultry"] },
  { name: "Chicken thigh, roasted", serving: "4 oz (113 g)", serving_size_g: 113, calories: 240, protein_g: 30, carbs_g: 0, fat_g: 13, keywords: ["poultry"] },
  { name: "Ground beef, 90/10, cooked", serving: "4 oz (113 g)", serving_size_g: 113, calories: 199, protein_g: 26, carbs_g: 0, fat_g: 10 },
  { name: "Ground turkey, 93/7, cooked", serving: "4 oz (113 g)", serving_size_g: 113, calories: 176, protein_g: 22, carbs_g: 0, fat_g: 9 },
  { name: "Sirloin steak, grilled", serving: "6 oz (170 g)", serving_size_g: 170, calories: 340, protein_g: 50, carbs_g: 0, fat_g: 14 },
  { name: "Pork chop, grilled", serving: "4 oz (113 g)", serving_size_g: 113, calories: 210, protein_g: 28, carbs_g: 0, fat_g: 10 },
  { name: "Bacon", serving: "2 slices (16 g)", serving_size_g: 16, calories: 86, protein_g: 6, carbs_g: 0, fat_g: 7 },
  { name: "Salmon, baked", serving: "4 oz (113 g)", serving_size_g: 113, calories: 233, protein_g: 25, carbs_g: 0, fat_g: 14, keywords: ["fish"] },
  { name: "Tuna, canned in water", serving: "1 can (142 g)", serving_size_g: 142, calories: 128, protein_g: 30, carbs_g: 0, fat_g: 1, keywords: ["fish"] },
  { name: "Shrimp, cooked", serving: "4 oz (113 g)", serving_size_g: 113, calories: 112, protein_g: 24, carbs_g: 1, fat_g: 1, keywords: ["seafood"] },
  { name: "Tilapia, baked", serving: "4 oz (113 g)", serving_size_g: 113, calories: 145, protein_g: 30, carbs_g: 0, fat_g: 3, keywords: ["fish"] },
  { name: "Eggs, large", serving: "2 eggs (100 g)", serving_size_g: 100, calories: 143, protein_g: 13, carbs_g: 1, fat_g: 10 },
  { name: "Egg whites", serving: "1/2 cup (120 g)", serving_size_g: 120, calories: 63, protein_g: 13, carbs_g: 1, fat_g: 0 },
  { name: "Tofu, firm", serving: "1/2 cup (126 g)", serving_size_g: 126, calories: 181, protein_g: 22, carbs_g: 4, fat_g: 11 },
  { name: "Black beans, cooked", serving: "1 cup (172 g)", serving_size_g: 172, calories: 227, protein_g: 15, carbs_g: 41, fat_g: 1, keywords: ["legume"] },
  { name: "Chickpeas, cooked", serving: "1 cup (164 g)", serving_size_g: 164, calories: 269, protein_g: 15, carbs_g: 45, fat_g: 4, keywords: ["garbanzo", "legume"] },
  { name: "Lentils, cooked", serving: "1 cup (198 g)", serving_size_g: 198, calories: 230, protein_g: 18, carbs_g: 40, fat_g: 1, keywords: ["legume"] },

  // ── Dairy ───────────────────────────────────────────────────────────────────
  { name: "Greek yogurt, plain nonfat", serving: "1 cup (227 g)", serving_size_g: 227, calories: 130, protein_g: 22, carbs_g: 9, fat_g: 0 },
  { name: "Greek yogurt, vanilla", serving: "5.3 oz (150 g)", serving_size_g: 150, calories: 130, protein_g: 12, carbs_g: 17, fat_g: 2 },
  { name: "Cottage cheese, 2%", serving: "1/2 cup (113 g)", serving_size_g: 113, calories: 90, protein_g: 12, carbs_g: 5, fat_g: 2 },
  { name: "Milk, 2%", serving: "1 cup (244 g)", serving_size_g: 244, calories: 122, protein_g: 8, carbs_g: 12, fat_g: 5 },
  { name: "Whole milk", serving: "1 cup (244 g)", serving_size_g: 244, calories: 149, protein_g: 8, carbs_g: 12, fat_g: 8 },
  { name: "Almond milk, unsweetened", serving: "1 cup (240 g)", serving_size_g: 240, calories: 30, protein_g: 1, carbs_g: 1, fat_g: 3 },
  { name: "Cheddar cheese", serving: "1 oz (28 g)", serving_size_g: 28, calories: 115, protein_g: 7, carbs_g: 1, fat_g: 9 },
  { name: "Mozzarella, part-skim", serving: "1 oz (28 g)", serving_size_g: 28, calories: 72, protein_g: 7, carbs_g: 1, fat_g: 5 },
  { name: "String cheese", serving: "1 stick (28 g)", serving_size_g: 28, calories: 80, protein_g: 6, carbs_g: 1, fat_g: 6 },
  { name: "Butter", serving: "1 tbsp (14 g)", serving_size_g: 14, calories: 102, protein_g: 0, carbs_g: 0, fat_g: 12 },

  // ── Grains & starches ────────────────────────────────────────────────────────
  { name: "White rice, cooked", serving: "1 cup (158 g)", serving_size_g: 158, calories: 205, protein_g: 4, carbs_g: 45, fat_g: 0 },
  { name: "Brown rice, cooked", serving: "1 cup (195 g)", serving_size_g: 195, calories: 218, protein_g: 5, carbs_g: 46, fat_g: 2 },
  { name: "Quinoa, cooked", serving: "1 cup (185 g)", serving_size_g: 185, calories: 222, protein_g: 8, carbs_g: 39, fat_g: 4 },
  { name: "Oatmeal, cooked", serving: "1 cup (234 g)", serving_size_g: 234, calories: 166, protein_g: 6, carbs_g: 28, fat_g: 4, keywords: ["oats"] },
  { name: "Pasta, cooked", serving: "1 cup (140 g)", serving_size_g: 140, calories: 220, protein_g: 8, carbs_g: 43, fat_g: 1, keywords: ["spaghetti", "noodles"] },
  { name: "Whole wheat bread", serving: "1 slice (28 g)", serving_size_g: 28, calories: 69, protein_g: 4, carbs_g: 12, fat_g: 1 },
  { name: "White bread", serving: "1 slice (25 g)", serving_size_g: 25, calories: 66, protein_g: 2, carbs_g: 13, fat_g: 1 },
  { name: "Bagel, plain", serving: "1 medium (98 g)", serving_size_g: 98, calories: 257, protein_g: 10, carbs_g: 50, fat_g: 2 },
  { name: "Flour tortilla", serving: "1 medium (49 g)", serving_size_g: 49, calories: 147, protein_g: 4, carbs_g: 24, fat_g: 4 },
  { name: "Sweet potato, baked", serving: "1 medium (114 g)", serving_size_g: 114, calories: 103, protein_g: 2, carbs_g: 24, fat_g: 0 },
  { name: "Potato, baked", serving: "1 medium (173 g)", serving_size_g: 173, calories: 161, protein_g: 4, carbs_g: 37, fat_g: 0 },
  { name: "Pancakes", serving: "2 pancakes (77 g)", serving_size_g: 77, calories: 175, protein_g: 5, carbs_g: 22, fat_g: 7 },
  { name: "Cereal, corn flakes", serving: "1 cup (28 g)", serving_size_g: 28, calories: 100, protein_g: 2, carbs_g: 24, fat_g: 0 },

  // ── Fruits ───────────────────────────────────────────────────────────────────
  { name: "Banana", serving: "1 medium (118 g)", serving_size_g: 118, calories: 105, protein_g: 1, carbs_g: 27, fat_g: 0 },
  { name: "Apple", serving: "1 medium (182 g)", serving_size_g: 182, calories: 95, protein_g: 0, carbs_g: 25, fat_g: 0 },
  { name: "Orange", serving: "1 medium (131 g)", serving_size_g: 131, calories: 62, protein_g: 1, carbs_g: 15, fat_g: 0 },
  { name: "Strawberries", serving: "1 cup (152 g)", serving_size_g: 152, calories: 49, protein_g: 1, carbs_g: 12, fat_g: 0, keywords: ["berries"] },
  { name: "Blueberries", serving: "1 cup (148 g)", serving_size_g: 148, calories: 84, protein_g: 1, carbs_g: 21, fat_g: 0, keywords: ["berries"] },
  { name: "Grapes", serving: "1 cup (151 g)", serving_size_g: 151, calories: 104, protein_g: 1, carbs_g: 27, fat_g: 0 },
  { name: "Avocado", serving: "1/2 fruit (100 g)", serving_size_g: 100, calories: 160, protein_g: 2, carbs_g: 9, fat_g: 15 },
  { name: "Watermelon", serving: "1 cup (152 g)", serving_size_g: 152, calories: 46, protein_g: 1, carbs_g: 12, fat_g: 0 },

  // ── Vegetables ───────────────────────────────────────────────────────────────
  { name: "Broccoli, cooked", serving: "1 cup (156 g)", serving_size_g: 156, calories: 55, protein_g: 4, carbs_g: 11, fat_g: 1 },
  { name: "Spinach, raw", serving: "2 cups (60 g)", serving_size_g: 60, calories: 14, protein_g: 2, carbs_g: 2, fat_g: 0 },
  { name: "Mixed green salad", serving: "2 cups (100 g)", serving_size_g: 100, calories: 20, protein_g: 2, carbs_g: 4, fat_g: 0 },
  { name: "Carrots", serving: "1 cup (128 g)", serving_size_g: 128, calories: 52, protein_g: 1, carbs_g: 12, fat_g: 0 },
  { name: "Green beans, cooked", serving: "1 cup (125 g)", serving_size_g: 125, calories: 44, protein_g: 2, carbs_g: 10, fat_g: 0 },
  { name: "Bell pepper", serving: "1 medium (119 g)", serving_size_g: 119, calories: 31, protein_g: 1, carbs_g: 7, fat_g: 0 },
  { name: "Corn", serving: "1 cup (145 g)", serving_size_g: 145, calories: 125, protein_g: 5, carbs_g: 27, fat_g: 2 },

  // ── Nuts, seeds & fats ───────────────────────────────────────────────────────
  { name: "Almonds", serving: "1 oz (28 g)", serving_size_g: 28, calories: 164, protein_g: 6, carbs_g: 6, fat_g: 14, keywords: ["nuts"] },
  { name: "Peanut butter", serving: "2 tbsp (32 g)", serving_size_g: 32, calories: 188, protein_g: 8, carbs_g: 6, fat_g: 16 },
  { name: "Walnuts", serving: "1 oz (28 g)", serving_size_g: 28, calories: 185, protein_g: 4, carbs_g: 4, fat_g: 18, keywords: ["nuts"] },
  { name: "Cashews", serving: "1 oz (28 g)", serving_size_g: 28, calories: 157, protein_g: 5, carbs_g: 9, fat_g: 12, keywords: ["nuts"] },
  { name: "Chia seeds", serving: "1 oz (28 g)", serving_size_g: 28, calories: 138, protein_g: 5, carbs_g: 12, fat_g: 9 },
  { name: "Olive oil", serving: "1 tbsp (14 g)", serving_size_g: 14, calories: 119, protein_g: 0, carbs_g: 0, fat_g: 14 },

  // ── Snacks & sweets ──────────────────────────────────────────────────────────
  { name: "Protein bar", serving: "1 bar (60 g)", serving_size_g: 60, calories: 220, protein_g: 20, carbs_g: 22, fat_g: 7 },
  { name: "Whey protein shake", serving: "1 scoop (32 g)", serving_size_g: 32, calories: 120, protein_g: 24, carbs_g: 3, fat_g: 2, keywords: ["protein powder"] },
  { name: "Potato chips", serving: "1 oz (28 g)", serving_size_g: 28, calories: 152, protein_g: 2, carbs_g: 15, fat_g: 10 },
  { name: "Tortilla chips", serving: "1 oz (28 g)", serving_size_g: 28, calories: 138, protein_g: 2, carbs_g: 19, fat_g: 7 },
  { name: "Dark chocolate", serving: "1 oz (28 g)", serving_size_g: 28, calories: 155, protein_g: 2, carbs_g: 13, fat_g: 12 },
  { name: "Ice cream, vanilla", serving: "1/2 cup (66 g)", serving_size_g: 66, calories: 137, protein_g: 2, carbs_g: 16, fat_g: 7 },
  { name: "Granola", serving: "1/2 cup (61 g)", serving_size_g: 61, calories: 280, protein_g: 7, carbs_g: 38, fat_g: 12 },
  { name: "Popcorn, air-popped", serving: "3 cups (24 g)", serving_size_g: 24, calories: 93, protein_g: 3, carbs_g: 19, fat_g: 1 },
  { name: "Hummus", serving: "2 tbsp (30 g)", serving_size_g: 30, calories: 70, protein_g: 2, carbs_g: 6, fat_g: 5 },

  // ── Beverages ────────────────────────────────────────────────────────────────
  { name: "Orange juice", serving: "1 cup (248 g)", serving_size_g: 248, calories: 112, protein_g: 2, carbs_g: 26, fat_g: 0 },
  { name: "Coffee, black", serving: "1 cup (240 g)", serving_size_g: 240, calories: 2, protein_g: 0, carbs_g: 0, fat_g: 0 },
  { name: "Cola", serving: "12 oz can (368 g)", serving_size_g: 368, calories: 140, protein_g: 0, carbs_g: 39, fat_g: 0, keywords: ["soda"] },
  { name: "Beer", serving: "12 oz (355 g)", serving_size_g: 355, calories: 153, protein_g: 2, carbs_g: 13, fat_g: 0 },
  { name: "Red wine", serving: "5 oz (147 g)", serving_size_g: 147, calories: 125, protein_g: 0, carbs_g: 4, fat_g: 0 },

  // ── Popular restaurant / fast-food staples ───────────────────────────────────
  { name: "Cheeseburger", brand: "fast food", serving: "1 burger (113 g)", serving_size_g: 113, calories: 303, protein_g: 15, carbs_g: 33, fat_g: 13 },
  { name: "French fries, medium", brand: "fast food", serving: "1 medium (117 g)", serving_size_g: 117, calories: 365, protein_g: 4, carbs_g: 48, fat_g: 17 },
  { name: "Cheese pizza", serving: "1 slice (107 g)", serving_size_g: 107, calories: 285, protein_g: 12, carbs_g: 36, fat_g: 10 },
  { name: "Chicken burrito", brand: "fast food", serving: "1 burrito (300 g)", serving_size_g: 300, calories: 590, protein_g: 32, carbs_g: 70, fat_g: 21 },
  { name: "Caesar salad with chicken", serving: "1 bowl (300 g)", serving_size_g: 300, calories: 470, protein_g: 32, carbs_g: 12, fat_g: 33 },
  { name: "Turkey sandwich", serving: "1 sandwich (200 g)", serving_size_g: 200, calories: 350, protein_g: 24, carbs_g: 42, fat_g: 9 },
  { name: "Chicken nuggets", brand: "fast food", serving: "6 pieces (96 g)", serving_size_g: 96, calories: 270, protein_g: 15, carbs_g: 16, fat_g: 17 },
  { name: "Sushi roll, California", serving: "6 pieces (170 g)", serving_size_g: 170, calories: 255, protein_g: 9, carbs_g: 38, fat_g: 7 },
];

function toResult(f: LocalFood, i: number): FoodResult {
  return {
    id: `local-${i}`,
    name: f.name,
    brand: f.brand,
    serving_size_g: f.serving_size_g,
    calories_per_serving: f.calories,
    protein_g: f.protein_g,
    carbs_g: f.carbs_g,
    fat_g: f.fat_g,
  };
}

/**
 * Fast substring search over the curated US food library. Ranks names that
 * start with the query first, then any name/keyword substring match.
 */
export function searchLocalFoods(query: string, limit = 8): FoodResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const scored: { food: LocalFood; index: number; score: number }[] = [];
  US_FOOD_LIBRARY.forEach((food, index) => {
    const name = food.name.toLowerCase();
    const inName = name.includes(q);
    const inKeyword = food.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false;
    if (!inName && !inKeyword) return;
    const score = name.startsWith(q) ? 0 : inName ? 1 : 2;
    scored.push({ food, index, score });
  });

  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ food, index }) => toResult(food, index));
}
