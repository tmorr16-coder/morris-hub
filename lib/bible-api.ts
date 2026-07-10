// Wrapper around the api.bible (American Bible Society) REST API.
// Free tier: 5,000 requests/day — sign up at https://scripture.api.bible/
// Set BIBLE_API_KEY in your environment variables.
//
// Falls back to bible-api.com for KJV/ASV/WEB when BIBLE_API_KEY is not set.

const ABS_BASE = "https://api.scripture.api.bible/v1";
const FALLBACK_BASE = "https://bible-api.com";
// wldeh/bible-api — a free, keyless CDN of Bible text (github.com/wldeh/bible-api).
const WLDEH_BASE = "https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles";

function absHeaders() {
  return { "api-key": process.env.BIBLE_API_KEY ?? "" };
}

// bible-api.com only serves public-domain translations. Map our version IDs to
// its translation slugs; anything else falls back to KJV.
const FALLBACK_TRANSLATIONS: Record<string, string> = {
  "de4e12af7f28f599-02": "kjv",
  "685d1470fe4d5c3b-01": "asv",
  "9879dbb7cfe39e4d-01": "web",
  "01b29f4b342acc35-01": "ylt",
};

// wldeh version slugs for the public-domain versions we expose. Others require
// the api.bible key (no free API distributes NIV/ESV/NLT/etc.).
const WLDEH_VERSIONS: Record<string, string> = {
  "de4e12af7f28f599-02": "en-kjv",
  "685d1470fe4d5c3b-01": "en-asv",
  "9879dbb7cfe39e4d-01": "en-web",
};

/** Book id → wldeh path slug, e.g. "1SA" → "1samuel", "SNG" → "songofsolomon". */
function wldehSlug(bookId: string): string | null {
  const b = bookById(bookId);
  return b ? b.name.toLowerCase().replace(/[^a-z0-9]/g, "") : null;
}

function cleanVerseText(t: string): string {
  return (t ?? "").replace(/¶/g, "").replace(/\s+/g, " ").trim();
}

export interface BibleVersion {
  id: string;
  name: string;
  abbreviation: string;
  description?: string;
  language: string;
}

export interface BibleBook {
  id: string;       // e.g. "JHN"
  name: string;     // e.g. "John"
  nameLong?: string;
  chapters: number;
}

export interface BibleVerse {
  id: string;       // e.g. "JHN.3.16"
  reference: string;
  number: number;
  text: string;
}

export interface BibleChapter {
  id: string;       // e.g. "JHN.3"
  bookId: string;
  number: string;
  reference: string;
  verses: BibleVerse[];
}

// ─── English Bible IDs (api.bible) ───────────────────────────────────────────
// These are the most common public and widely-licensed English translations.
export const KNOWN_VERSIONS: BibleVersion[] = [
  { id: "de4e12af7f28f599-02", name: "King James Version",             abbreviation: "KJV",  language: "English" },
  { id: "685d1470fe4d5c3b-01", name: "American Standard Version",      abbreviation: "ASV",  language: "English" },
  { id: "9879dbb7cfe39e4d-01", name: "World English Bible",            abbreviation: "WEB",  language: "English" },
  { id: "01b29f4b342acc35-01", name: "Young's Literal Translation",    abbreviation: "YLT",  language: "English" },
  { id: "7142879509583d59-04", name: "New King James Version",         abbreviation: "NKJV", language: "English" },
  { id: "06125adad2d5898a-01", name: "New International Version",      abbreviation: "NIV",  language: "English" },
  { id: "f421fe261da7624f-01", name: "New Living Translation",         abbreviation: "NLT",  language: "English" },
  { id: "65eec8e0b60e656b-01", name: "English Standard Version",       abbreviation: "ESV",  language: "English" },
  { id: "40072c4a5aba4022-01", name: "New American Standard Bible",    abbreviation: "NASB", language: "English" },
  { id: "c315fa9f71d4af3d-02", name: "New Revised Standard Version",   abbreviation: "NRSV", language: "English" },
  { id: "1f72e8f30b5d9c9a-01", name: "The Message",                    abbreviation: "MSG",  language: "English" },
  { id: "9f5b7e4b0e8d3a2c-01", name: "Amplified Bible",                abbreviation: "AMP",  language: "English" },
  { id: "55212e3cf5d04d49-01", name: "Christian Standard Bible",       abbreviation: "CSB",  language: "English" },
];

export const DEFAULT_VERSION_ID = "de4e12af7f28f599-02"; // KJV — always available

// ─── Book metadata ────────────────────────────────────────────────────────────
export const BIBLE_BOOKS: { id: string; name: string; chapters: number; testament: "OT" | "NT" }[] = [
  { id: "GEN", name: "Genesis",        chapters: 50,  testament: "OT" },
  { id: "EXO", name: "Exodus",         chapters: 40,  testament: "OT" },
  { id: "LEV", name: "Leviticus",      chapters: 27,  testament: "OT" },
  { id: "NUM", name: "Numbers",        chapters: 36,  testament: "OT" },
  { id: "DEU", name: "Deuteronomy",    chapters: 34,  testament: "OT" },
  { id: "JOS", name: "Joshua",         chapters: 24,  testament: "OT" },
  { id: "JDG", name: "Judges",         chapters: 21,  testament: "OT" },
  { id: "RUT", name: "Ruth",           chapters: 4,   testament: "OT" },
  { id: "1SA", name: "1 Samuel",       chapters: 31,  testament: "OT" },
  { id: "2SA", name: "2 Samuel",       chapters: 24,  testament: "OT" },
  { id: "1KI", name: "1 Kings",        chapters: 22,  testament: "OT" },
  { id: "2KI", name: "2 Kings",        chapters: 25,  testament: "OT" },
  { id: "1CH", name: "1 Chronicles",   chapters: 29,  testament: "OT" },
  { id: "2CH", name: "2 Chronicles",   chapters: 36,  testament: "OT" },
  { id: "EZR", name: "Ezra",           chapters: 10,  testament: "OT" },
  { id: "NEH", name: "Nehemiah",       chapters: 13,  testament: "OT" },
  { id: "EST", name: "Esther",         chapters: 10,  testament: "OT" },
  { id: "JOB", name: "Job",            chapters: 42,  testament: "OT" },
  { id: "PSA", name: "Psalms",         chapters: 150, testament: "OT" },
  { id: "PRO", name: "Proverbs",       chapters: 31,  testament: "OT" },
  { id: "ECC", name: "Ecclesiastes",   chapters: 12,  testament: "OT" },
  { id: "SNG", name: "Song of Solomon",chapters: 8,   testament: "OT" },
  { id: "ISA", name: "Isaiah",         chapters: 66,  testament: "OT" },
  { id: "JER", name: "Jeremiah",       chapters: 52,  testament: "OT" },
  { id: "LAM", name: "Lamentations",   chapters: 5,   testament: "OT" },
  { id: "EZK", name: "Ezekiel",        chapters: 48,  testament: "OT" },
  { id: "DAN", name: "Daniel",         chapters: 12,  testament: "OT" },
  { id: "HOS", name: "Hosea",          chapters: 14,  testament: "OT" },
  { id: "JOL", name: "Joel",           chapters: 3,   testament: "OT" },
  { id: "AMO", name: "Amos",           chapters: 9,   testament: "OT" },
  { id: "OBA", name: "Obadiah",        chapters: 1,   testament: "OT" },
  { id: "JON", name: "Jonah",          chapters: 4,   testament: "OT" },
  { id: "MIC", name: "Micah",          chapters: 7,   testament: "OT" },
  { id: "NAM", name: "Nahum",          chapters: 3,   testament: "OT" },
  { id: "HAB", name: "Habakkuk",       chapters: 3,   testament: "OT" },
  { id: "ZEP", name: "Zephaniah",      chapters: 3,   testament: "OT" },
  { id: "HAG", name: "Haggai",         chapters: 2,   testament: "OT" },
  { id: "ZEC", name: "Zechariah",      chapters: 14,  testament: "OT" },
  { id: "MAL", name: "Malachi",        chapters: 4,   testament: "OT" },
  { id: "MAT", name: "Matthew",        chapters: 28,  testament: "NT" },
  { id: "MRK", name: "Mark",           chapters: 16,  testament: "NT" },
  { id: "LUK", name: "Luke",           chapters: 24,  testament: "NT" },
  { id: "JHN", name: "John",           chapters: 21,  testament: "NT" },
  { id: "ACT", name: "Acts",           chapters: 28,  testament: "NT" },
  { id: "ROM", name: "Romans",         chapters: 16,  testament: "NT" },
  { id: "1CO", name: "1 Corinthians",  chapters: 16,  testament: "NT" },
  { id: "2CO", name: "2 Corinthians",  chapters: 13,  testament: "NT" },
  { id: "GAL", name: "Galatians",      chapters: 6,   testament: "NT" },
  { id: "EPH", name: "Ephesians",      chapters: 6,   testament: "NT" },
  { id: "PHP", name: "Philippians",    chapters: 4,   testament: "NT" },
  { id: "COL", name: "Colossians",     chapters: 4,   testament: "NT" },
  { id: "1TH", name: "1 Thessalonians",chapters: 5,  testament: "NT" },
  { id: "2TH", name: "2 Thessalonians",chapters: 3,  testament: "NT" },
  { id: "1TI", name: "1 Timothy",      chapters: 6,   testament: "NT" },
  { id: "2TI", name: "2 Timothy",      chapters: 4,   testament: "NT" },
  { id: "TIT", name: "Titus",          chapters: 3,   testament: "NT" },
  { id: "PHM", name: "Philemon",       chapters: 1,   testament: "NT" },
  { id: "HEB", name: "Hebrews",        chapters: 13,  testament: "NT" },
  { id: "JAS", name: "James",          chapters: 5,   testament: "NT" },
  { id: "1PE", name: "1 Peter",        chapters: 5,   testament: "NT" },
  { id: "2PE", name: "2 Peter",        chapters: 3,   testament: "NT" },
  { id: "1JN", name: "1 John",         chapters: 5,   testament: "NT" },
  { id: "2JN", name: "2 John",         chapters: 1,   testament: "NT" },
  { id: "3JN", name: "3 John",         chapters: 1,   testament: "NT" },
  { id: "JUD", name: "Jude",           chapters: 1,   testament: "NT" },
  { id: "REV", name: "Revelation",     chapters: 22,  testament: "NT" },
];

export function bookById(id: string) {
  return BIBLE_BOOKS.find((b) => b.id === id);
}

// ─── API fetchers ─────────────────────────────────────────────────────────────

/** Fetch a full chapter with individual verses from api.bible */
export async function fetchChapter(
  bibleId: string,
  bookId: string,
  chapterNum: number
): Promise<BibleChapter> {
  const apiKey = process.env.BIBLE_API_KEY;
  const chapterId = `${bookId}.${chapterNum}`;

  if (apiKey) {
    const url = `${ABS_BASE}/bibles/${bibleId}/chapters/${chapterId}?content-type=json&include-notes=false&include-titles=true&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false`;
    try {
      const res = await fetch(url, { headers: absHeaders(), next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const json = await res.json();
        const data = json.data;
        // ABS returns content as HTML/JSON — parse verses from items array
        const verses: BibleVerse[] = (data.content ?? [])
          .filter((item: any) => item.type === "verse" || item.verseId)
          .map((item: any, idx: number) => ({
            id: item.id ?? `${chapterId}.${idx + 1}`,
            reference: item.reference ?? `${bookId} ${chapterNum}:${idx + 1}`,
            number: parseInt(item.number ?? String(idx + 1)),
            text: extractText(item),
          }));
        return {
          id: chapterId,
          bookId,
          number: String(chapterNum),
          reference: data.reference ?? `${bookId} ${chapterNum}`,
          verses,
        };
      }
    } catch { /* timeout or network error — fall through to keyless source */ }
  }

  // Keyless primary source: wldeh CDN (KJV/ASV/WEB).
  const wldehVersion = WLDEH_VERSIONS[bibleId];
  if (wldehVersion) {
    const verses = await fetchChapterWldeh(wldehVersion, bookId, chapterNum);
    if (verses && verses.length) {
      const book = bookById(bookId);
      return {
        id: chapterId,
        bookId,
        number: String(chapterNum),
        reference: `${book?.name ?? bookId} ${chapterNum}`,
        verses,
      };
    }
  }

  // Last resort: bible-api.com (also covers YLT).
  return fetchChapterFallback(bookId, chapterNum, bibleId);
}

/** Fetch a chapter's verses from the keyless wldeh CDN. Returns null on miss. */
async function fetchChapterWldeh(
  version: string,
  bookId: string,
  chapterNum: number
): Promise<BibleVerse[] | null> {
  const slug = wldehSlug(bookId);
  if (!slug) return null;
  const url = `${WLDEH_BASE}/${version}/books/${slug}/chapters/${chapterNum}.json`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    const rows: { verse: string; text: string }[] = Array.isArray(json?.data) ? json.data : [];
    if (!rows.length) return null;
    const book = bookById(bookId);
    // wldeh chapter files can repeat the whole chapter — keep the first of each verse.
    const byNumber = new Map<number, BibleVerse>();
    for (const v of rows) {
      const number = parseInt(v.verse);
      if (!Number.isFinite(number) || byNumber.has(number)) continue;
      byNumber.set(number, {
        id: `${bookId}.${chapterNum}.${number}`,
        reference: `${book?.name ?? bookId} ${chapterNum}:${number}`,
        number,
        text: cleanVerseText(v.text),
      });
    }
    return [...byNumber.values()].sort((a, b) => a.number - b.number);
  } catch {
    return null;
  }
}

/** Fallback fetcher using bible-api.com (public domain versions) */
async function fetchChapterFallback(
  bookId: string,
  chapterNum: number,
  bibleId: string
): Promise<BibleChapter> {
  const book = bookById(bookId);
  const bookName = book?.name ?? bookId;
  const translation = FALLBACK_TRANSLATIONS[bibleId] ?? "kjv";
  const ref = encodeURIComponent(`${bookName} ${chapterNum}`);
  const url = `${FALLBACK_BASE}/${ref}?translation=${translation}&verse_numbers=true`;
  const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Bible fetch failed: ${res.status}`);
  const json = await res.json();
  const verses: BibleVerse[] = (json.verses ?? []).map((v: any) => ({
    id: `${bookId}.${chapterNum}.${v.verse}`,
    reference: `${bookName} ${chapterNum}:${v.verse}`,
    number: v.verse,
    text: v.text?.trim() ?? "",
  }));
  return {
    id: `${bookId}.${chapterNum}`,
    bookId,
    number: String(chapterNum),
    reference: `${bookName} ${chapterNum}`,
    verses,
  };
}

function extractText(item: any): string {
  if (typeof item.text === "string") return item.text.trim();
  if (Array.isArray(item.content)) {
    return item.content.map((c: any) => (typeof c === "string" ? c : c.text ?? "")).join("").trim();
  }
  return "";
}

export interface VerseResult {
  reference: string;
  text: string;
  verseId: string;
}

// Common book abbreviations → book id (in addition to full names).
const BOOK_ABBREV: Record<string, string> = {
  gen: "GEN", ge: "GEN", exo: "EXO", ex: "EXO", lev: "LEV", lv: "LEV",
  num: "NUM", nm: "NUM", deu: "DEU", dt: "DEU", jos: "JOS", jsh: "JOS",
  jdg: "JDG", rut: "RUT", rth: "RUT", "1sa": "1SA", "1sam": "1SA",
  "2sa": "2SA", "2sam": "2SA", "1ki": "1KI", "1kgs": "1KI", "2ki": "2KI",
  "2kgs": "2KI", "1ch": "1CH", "1chr": "1CH", "2ch": "2CH", "2chr": "2CH",
  ezr: "EZR", neh: "NEH", est: "EST", job: "JOB", ps: "PSA", psa: "PSA",
  psalm: "PSA", pss: "PSA", pro: "PRO", prov: "PRO", prv: "PRO", ecc: "ECC",
  eccl: "ECC", sng: "SNG", song: "SNG", isa: "ISA", jer: "JER", lam: "LAM",
  ezk: "EZK", eze: "EZK", ezek: "EZK", dan: "DAN", hos: "HOS", joe: "JOL",
  jol: "JOL", amo: "AMO", oba: "OBA", jon: "JON", mic: "MIC", nam: "NAM",
  nah: "NAM", hab: "HAB", zep: "ZEP", zeph: "ZEP", hag: "HAG", zec: "ZEC",
  zech: "ZEC", mal: "MAL", mat: "MAT", matt: "MAT", mt: "MAT", mrk: "MRK",
  mk: "MRK", mar: "MRK", luk: "LUK", lk: "LUK", jhn: "JHN", jn: "JHN",
  joh: "JHN", act: "ACT", rom: "ROM", "1co": "1CO", "1cor": "1CO",
  "2co": "2CO", "2cor": "2CO", gal: "GAL", eph: "EPH", php: "PHP",
  phil: "PHP", col: "COL", "1th": "1TH", "1thess": "1TH", "2th": "2TH",
  "2thess": "2TH", "1ti": "1TI", "1tim": "1TI", "2ti": "2TI", "2tim": "2TI",
  tit: "TIT", phm: "PHM", phlm: "PHM", heb: "HEB", jas: "JAS", jam: "JAS",
  "1pe": "1PE", "1pet": "1PE", "2pe": "2PE", "2pet": "2PE", "1jn": "1JN",
  "2jn": "2JN", "3jn": "3JN", jud: "JUD", jude: "JUD", rev: "REV",
};

// Full-name lookup (lowercased, punctuation-stripped) → book id, plus aliases.
const BOOK_NAMES: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const b of BIBLE_BOOKS) m[b.name.toLowerCase().replace(/[^a-z0-9 ]/g, "")] = b.id;
  m["psalm"] = "PSA";
  m["song of songs"] = "SNG";
  m["songs of solomon"] = "SNG";
  m["revelations"] = "REV";
  return m;
})();

function resolveBookId(raw: string): string | null {
  const n = raw.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
  if (BOOK_NAMES[n]) return BOOK_NAMES[n];
  const compact = n.replace(/\s+/g, "");
  return BOOK_ABBREV[compact] ?? null;
}

/**
 * Parse a scripture reference like "John 3:16", "Genesis 1:1-5", "1 Cor 13",
 * "Psalm 23". Returns null for anything that isn't a reference (e.g. a topic).
 */
export function parseReference(
  query: string
): { bookId: string; chapter: number; vStart?: number; vEnd?: number } | null {
  const m = query.trim().match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/);
  if (!m) return null;
  const bookId = resolveBookId(m[1]);
  if (!bookId) return null;
  return {
    bookId,
    chapter: parseInt(m[2]),
    vStart: m[3] ? parseInt(m[3]) : undefined,
    vEnd: m[4] ? parseInt(m[4]) : undefined,
  };
}

/**
 * Resolve a reference string to verse text via the active source chain
 * (api.bible when keyed, otherwise the keyless wldeh CDN). Returns [] for a
 * non-reference query or a fetch miss.
 */
export async function lookupReference(
  bibleId: string,
  refString: string,
  limit = 50
): Promise<VerseResult[]> {
  const ref = parseReference(refString);
  if (!ref) return [];
  const chapter = await fetchChapter(bibleId, ref.bookId, ref.chapter).catch(() => null);
  if (!chapter) return [];
  let verses = chapter.verses;
  if (ref.vStart != null) {
    const end = ref.vEnd ?? ref.vStart;
    verses = verses.filter((v) => v.number >= ref.vStart! && v.number <= end);
  }
  return verses.slice(0, limit).map((v) => ({
    verseId: v.id,
    reference: v.reference,
    text: v.text,
  }));
}

/**
 * Search verses across a Bible version.
 * With BIBLE_API_KEY set, uses api.bible's full-text search. Without a key,
 * resolves the query as a scripture reference via the keyless wldeh CDN —
 * topic/keyword searches (no reference) are handled by the search route's AI
 * fallback, which turns a topic into references this function can resolve.
 */
export async function searchVerses(
  bibleId: string,
  query: string,
  limit = 20
): Promise<VerseResult[]> {
  const apiKey = process.env.BIBLE_API_KEY;
  if (!apiKey) return lookupReference(bibleId, query, limit);

  const url = `${ABS_BASE}/bibles/${bibleId}/search?query=${encodeURIComponent(query)}&limit=${limit}&sort=relevance`;
  try {
    const res = await fetch(url, { headers: absHeaders(), next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data?.verses ?? []).map((v: any) => ({
      verseId: v.id,
      reference: v.reference,
      text: v.text?.trim() ?? "",
    }));
  } catch {
    return [];
  }
}
