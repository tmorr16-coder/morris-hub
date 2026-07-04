import { redirect, notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fetchChapter, bookById, BIBLE_BOOKS, KNOWN_VERSIONS, DEFAULT_VERSION_ID } from "@/lib/bible-api";
import ChapterReader from "./ChapterReader";

interface Props {
  params: Promise<{ bookId: string; chapter: string }>;
  searchParams: Promise<{
    v?: string;
    plan?: string;   // planId
    day?: string;    // day number in plan
    ridx?: string;   // reading index within that day
  }>;
}

/** Parse "John 3" or "Genesis 1-2" → { bookId, chapter } */
function parseRef(ref: string): { bookId: string; chapter: number } | null {
  const m = ref.trim().match(/^(.+?)\s+(\d+)(?:-\d+)?$/);
  if (!m) return null;
  const name = m[1].trim().toLowerCase().replace(/\s/g, "");
  const bk = BIBLE_BOOKS.find(b => b.name.toLowerCase().replace(/\s/g, "") === name);
  if (!bk) return null;
  return { bookId: bk.id, chapter: parseInt(m[2]) };
}

export default async function ChapterPage({ params, searchParams }: Props) {
  const { bookId, chapter } = await params;
  const { v, plan: planId, day, ridx } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const book = bookById(bookId.toUpperCase());
  if (!book) notFound();

  const chapterNum = parseInt(chapter);
  if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > book.chapters) notFound();

  const bibleId = v ?? DEFAULT_VERSION_ID;

  let chapterData;
  try {
    chapterData = await fetchChapter(bibleId, book.id, chapterNum);
  } catch {
    chapterData = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const [{ data: highlights }, { data: bookmarks }, { data: notes }] = await Promise.all([
    db.schema("bible").from("highlights").select("*").eq("user_id", user.id).eq("bible_id", bibleId).like("verse_id", `${book.id}.${chapterNum}.%`),
    db.schema("bible").from("bookmarks").select("*").eq("user_id", user.id).eq("bible_id", bibleId).eq("book_id", book.id).eq("chapter_num", chapterNum),
    db.schema("bible").from("notes").select("*").eq("user_id", user.id).eq("book_id", book.id).eq("chapter_num", chapterNum),
  ]);

  // ── Compute next reading in the plan ─────────────────────
  let nextReadingHref: string | null = null;
  let nextReadingLabel: string | null = null;

  // Ordered list of readings AFTER the current one, so read-aloud can chain
  // through a whole plan day (and beyond) hands-free. Capped to keep it bounded.
  const MAX_UPCOMING = 24;
  const upcomingReadings: { bookId: string; chapter: number; label: string }[] = [];

  if (planId && day && ridx !== undefined) {
    try {
      const { data: planData } = await db
        .schema("bible")
        .from("reading_plans")
        .select("readings, title")
        .eq("id", planId)
        .single();

      if (planData?.readings) {
        const dayNum = parseInt(day);
        const ridxNum = parseInt(ridx);
        const dayEntry = (planData.readings as { day: number; readings: string[] }[])
          .find(d => d.day === dayNum);

        if (dayEntry) {
          const dayReadings = dayEntry.readings ?? [];
          const nextRidx = ridxNum + 1;

          if (nextRidx < dayReadings.length) {
            // More readings today
            const nextRef = dayReadings[nextRidx];
            const parsed = parseRef(nextRef);
            if (parsed) {
              nextReadingHref = `/bible/read/${parsed.bookId}/${parsed.chapter}?plan=${planId}&day=${day}&ridx=${nextRidx}`;
              nextReadingLabel = nextRef;
            }
          } else {
            // End of today — link back to plan
            nextReadingHref = `/bible/plans/${planId}`;
            nextReadingLabel = `Day ${day} complete`;
          }

          // Remaining refs in the current day (after the current one)…
          for (let i = ridxNum + 1; i < dayReadings.length && upcomingReadings.length < MAX_UPCOMING; i++) {
            const p = parseRef(dayReadings[i]);
            if (p) upcomingReadings.push({ bookId: p.bookId, chapter: p.chapter, label: dayReadings[i] });
          }
        }

        // …then the following days' refs, in day order.
        const laterDays = (planData.readings as { day: number; readings: string[] }[])
          .filter(d => d.day > dayNum)
          .sort((a, b) => a.day - b.day);
        for (const d of laterDays) {
          if (upcomingReadings.length >= MAX_UPCOMING) break;
          for (const ref of d.readings ?? []) {
            if (upcomingReadings.length >= MAX_UPCOMING) break;
            const p = parseRef(ref);
            if (p) upcomingReadings.push({ bookId: p.bookId, chapter: p.chapter, label: ref });
          }
        }
      }
    } catch {
      // Non-fatal — just won't have next reading link / auto-continue
    }
  } else {
    // No plan: chain through the subsequent chapters of the current book.
    for (let n = chapterNum + 1; n <= book.chapters && upcomingReadings.length < MAX_UPCOMING; n++) {
      upcomingReadings.push({ bookId: book.id, chapter: n, label: `${book.name} ${n}` });
    }
  }

  const prevChapter = chapterNum > 1 ? chapterNum - 1 : null;
  const nextChapter = chapterNum < book.chapters ? chapterNum + 1 : null;
  const version = KNOWN_VERSIONS.find((v2) => v2.id === bibleId) ?? KNOWN_VERSIONS[0];

  return (
    <div className="ios-scroll">
      <ChapterReader
        book={book}
        chapterNum={chapterNum}
        chapterData={chapterData}
        version={version}
        allVersions={KNOWN_VERSIONS}
        prevChapter={prevChapter}
        nextChapter={nextChapter}
        userId={user.id}
        initialHighlights={highlights ?? []}
        initialBookmarks={bookmarks ?? []}
        initialNotes={notes ?? []}
        bibleId={bibleId}
        nextReadingHref={nextReadingHref}
        nextReadingLabel={nextReadingLabel}
        upcomingReadings={upcomingReadings}
      />
    </div>
  );
}
