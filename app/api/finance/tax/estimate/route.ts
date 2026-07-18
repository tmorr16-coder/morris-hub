import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { EstimateInput, EstimateResult } from "@/app/finance/tax/estimate/_lib/estimate";

export const runtime = "nodejs";

interface SavePayload {
  tax_year: number;
  inputs: EstimateInput;
  results: EstimateResult;
}

// GET → list the user's saved estimates (most recent tax years first).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data, error } = await service
    .schema("finance").from("tax_estimates")
    .select("tax_year, inputs, results, updated_at")
    .eq("user_id", user.id) // scoping-ok: user-scoped read
    .order("tax_year", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load estimates" }, { status: 500 });
  return NextResponse.json({ estimates: data ?? [] });
}

// POST → upsert the estimate for a given tax year.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: SavePayload;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body.tax_year || !body.inputs || !body.results) {
    return NextResponse.json({ error: "Missing tax_year, inputs, or results" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("finance").from("tax_estimates")
    .upsert(
      {
        user_id: user.id, // scoping-ok: user-scoped write
        tax_year: body.tax_year,
        inputs: body.inputs,
        results: body.results,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,tax_year" },
    );

  if (error) return NextResponse.json({ error: "Failed to save estimate" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
