import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchVerses } from "@/lib/bible-api";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const bibleId = searchParams.get("bibleId") ?? "de4e12af7f28f599-02";
  const query = searchParams.get("q") ?? "";
  if (!query) return NextResponse.json([]);

  const results = await searchVerses(bibleId, query);
  return NextResponse.json(results);
}
