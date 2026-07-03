import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchLocalFoods } from "@/lib/health/food-library";
import { searchFdcFoods, fdcApiKey } from "@/lib/health/fdc";

export interface FoodResult {
  id: string;
  name: string;
  brand?: string;
  serving_size_g: number;
  calories_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

// Open Food Facts fallback — free, 3M+ products, no API key needed.
async function searchOpenFoodFacts(q: string): Promise<FoodResult[]> {
  try {
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", q);
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "12");
    url.searchParams.set("fields", "id,product_name,brands,serving_size,nutriments");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "morrisai-health/1.0 (tmorr16@gmail.com)" },
      next: { revalidate: 300 }, // 5-min cache per query
    });

    if (!res.ok) return [];
    const data = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.products ?? []).slice(0, 10).map((p: any) => {
      const n = p.nutriments ?? {};
      // Prefer per-serving values; fall back to per-100g
      const servingG = parseFloat(p.serving_size) || 100;
      const scale = servingG / 100;
      const cal = n["energy-kcal_serving"] ?? (n["energy-kcal_100g"] != null ? Math.round(n["energy-kcal_100g"] * scale) : null);
      const prot = n["proteins_serving"] ?? (n["proteins_100g"] != null ? +(n["proteins_100g"] * scale).toFixed(1) : null);
      const carb = n["carbohydrates_serving"] ?? (n["carbohydrates_100g"] != null ? +(n["carbohydrates_100g"] * scale).toFixed(1) : null);
      const fat = n["fat_serving"] ?? (n["fat_100g"] != null ? +(n["fat_100g"] * scale).toFixed(1) : null);

      return {
        id: p.id ?? p.code ?? Math.random().toString(),
        name: p.product_name?.trim() || "Unknown product",
        brand: p.brands?.split(",")[0]?.trim() || undefined,
        serving_size_g: Math.round(servingG),
        calories_per_serving: cal != null ? Math.round(cal) : null,
        protein_g: prot,
        carbs_g: carb,
        fat_g: fat,
      } as FoodResult;
    }).filter((r: FoodResult) => r.name && r.name !== "Unknown product");
  } catch {
    return [];
  }
}

// Meal-log food search. Priority order:
//   1. Curated US food library (instant, always available — fast fallback).
//   2. USDA FoodData Central when FDC_API_KEY / USDA_API_KEY is set (US-authoritative).
//   3. Open Food Facts when no USDA key is configured.
// Results are merged and de-duped by name + brand.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const local = searchLocalFoods(q);
  const remote = fdcApiKey() ? await searchFdcFoods(q) : await searchOpenFoodFacts(q);

  // Local curated matches lead; de-dupe remote results by name + brand.
  const seen = new Set(local.map((r) => `${r.name.toLowerCase()}|${(r.brand ?? "").toLowerCase()}`));
  const merged: FoodResult[] = [...local];
  for (const r of remote) {
    const key = `${r.name.toLowerCase()}|${(r.brand ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(r);
  }

  return NextResponse.json({ results: merged.slice(0, 15) });
}
