import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchChapter } from "@/lib/bible-api";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const bibleId = searchParams.get("bibleId") ?? "de4e12af7f28f599-02";
  const bookId = searchParams.get("bookId");
  const chapter = parseInt(searchParams.get("chapter") ?? "1");

  if (!bookId) return new NextResponse("bookId required", { status: 400 });

  try {
    const data = await fetchChapter(bibleId, bookId, chapter);
    return NextResponse.json(data);
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Fetch failed", { status: 500 });
  }
}
