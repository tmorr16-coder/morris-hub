import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInvestmentIdeas } from "@/lib/investment-ideas";

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get categories from request body
    const { categories } = await req.json();
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json(
        { error: "Invalid categories" },
        { status: 400 }
      );
    }

    // Generate AI ideas
    const ideas = await generateInvestmentIdeas(categories);

    return NextResponse.json(ideas);
  } catch (error) {
    console.error("[investments/generate]", error);
    return NextResponse.json(
      { error: "Failed to generate ideas" },
      { status: 500 }
    );
  }
}
