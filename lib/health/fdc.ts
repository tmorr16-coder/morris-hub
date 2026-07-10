// USDA FoodData Central (FDC) integration — the US-authoritative food source.
//
// Reads an API key from FDC_API_KEY (preferred) or USDA_API_KEY. When neither is
// set, `searchFdcFoods` resolves to an empty array so the caller degrades
// gracefully to the curated local library / Open Food Facts. Get a free key at
// https://fdc.nal.usda.gov/api-key-signup.html

import type { FoodResult } from "@/app/api/health/food-search/route";

const FDC_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";

export function fdcApiKey(): string | undefined {
  return process.env.FDC_API_KEY || process.env.USDA_API_KEY || undefined;
}

// Nutrient numbers as reported by FDC (per 100 g in search results).
const N_ENERGY_KCAL = ["208", "957", "958"];
const N_PROTEIN = ["203"];
const N_CARBS = ["205"];
const N_FAT = ["204"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nutrientValue(nutrients: any[], numbers: string[]): number | null {
  for (const n of nutrients ?? []) {
    const num = String(n.nutrientNumber ?? n.number ?? "");
    if (numbers.includes(num) && typeof n.value === "number") return n.value;
  }
  return null;
}

/**
 * Search USDA FoodData Central. Returns [] when no API key is configured or on
 * any network/parse error — the caller is expected to fall back locally.
 */
export async function searchFdcFoods(query: string, limit = 12): Promise<FoodResult[]> {
  const key = fdcApiKey();
  const q = query.trim();
  if (!key || q.length < 2) return [];

  try {
    const url = new URL(FDC_SEARCH_URL);
    url.searchParams.set("api_key", key);
    url.searchParams.set("query", q);
    url.searchParams.set("pageSize", String(limit));
    // US-authoritative datasets first, then branded label data.
    url.searchParams.set("dataType", "Foundation,SR Legacy,Branded");
    url.searchParams.set("sortBy", "dataType.keyword");

    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const foods: any[] = data.foods ?? [];
    return foods
      .map((f, i): FoodResult => {
        const nutrients = f.foodNutrients ?? [];
        // Search-result nutrient values are per 100 g. If a serving size in
        // grams/ml is provided (branded foods), scale to that serving.
        const unit = String(f.servingSizeUnit ?? "").toLowerCase();
        const servingG =
          typeof f.servingSize === "number" && (unit === "g" || unit === "ml")
            ? f.servingSize
            : 100;
        const scale = servingG / 100;

        const cal = nutrientValue(nutrients, N_ENERGY_KCAL);
        const protein = nutrientValue(nutrients, N_PROTEIN);
        const carbs = nutrientValue(nutrients, N_CARBS);
        const fat = nutrientValue(nutrients, N_FAT);

        return {
          id: `fdc-${f.fdcId ?? i}`,
          name: (f.description ?? "Unknown food").trim(),
          brand: f.brandOwner || f.brandName || undefined,
          serving_size_g: Math.round(servingG),
          calories_per_serving: cal != null ? Math.round(cal * scale) : null,
          protein_g: protein != null ? +(protein * scale).toFixed(1) : null,
          carbs_g: carbs != null ? +(carbs * scale).toFixed(1) : null,
          fat_g: fat != null ? +(fat * scale).toFixed(1) : null,
        };
      })
      .filter((r) => r.name && r.name !== "Unknown food");
  } catch {
    return [];
  }
}
