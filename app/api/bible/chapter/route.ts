import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BIBLE_BOOKS, fetchChapter } from "@/lib/bible-api";

const DEFAULT_BIBLE_ID = "de4e12af7f28f599-02";
const ALLOWED_BIBLE_IDS = new Set([
  "de4e12af7f28f599-02",
  "685d1470fe4d5c3b-01",
  "9879dbb7cfe39e4d-01",
  "01b29f4b342acc35-01",
]);
const ALLOWED_BOOK_IDS = new Set(BIBLE_BOOKS.map((b) => b.id));

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const requestedBibleId = searchParams.get("bibleId");
  const bibleId = requestedBibleId && ALLOWED_BIBLE_IDS.has(requestedBibleId)
    ? requestedBibleId
    : DEFAULT_BIBLE_ID;
  const bookId = searchParams.get("bookId");
  const chapter = parseInt(searchParams.get("chapter") ?? "1");

  if (!bookId) return new NextResponse("bookId required", { status: 400 });
  if (!ALLOWED_BOOK_IDS.has(bookId)) {
    return new NextResponse("Invalid bookId", { status: 400 });
  }

  try {
    const data = await fetchChapter(bibleId, bookId, chapter);
    return NextResponse.json(data);
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Fetch failed", { status: 500 });
  }
}
