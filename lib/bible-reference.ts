// One place that turns what somebody typed into a book, chapter and verse.
//
// There were four of these, and they disagreed with each other:
//
//   lib/bible-api.ts          full names + a good abbreviation table
//   BookPickerClient          name.startsWith(), no abbreviations
//   SearchAndAsk              its own hand-written table of 18 of the 66 books
//   read/[bookId]/[chapter]   exact full names only, spaces stripped
//
// So "Jn 3:16" worked on one screen and not the next, "1 Cor 13" worked on two
// of the four, and anything outside SearchAndAsk's eighteen — Nahum, Obadiah,
// Zephaniah — simply could not be reached from the search box at all. The plan
// reader used the strictest of the four, which is why a plan whose readings say
// "Ps 23" rather than "Psalms 23" would silently drop them from auto-continue.
//
// None of the four tolerated a typo. Every one of them required the name spelt
// exactly, which is a hard thing to ask of "Ecclesiastes", "Zephaniah" or
// "Philippians" on a phone keyboard.
//
// This module is the only resolver now, it is client-safe (no fetchers, no
// credentials), and it tries progressively looser matches so that the common
// near-misses land:
//
//   exact        "philippians"        the name, or a known alias
//   abbreviation "php", "phil", "jn"  the standard short forms
//   prefix       "philip", "zeph"     as much of the name as you bothered to type
//   fuzzy        "phillipians"        one or two letters wrong, or two swapped
//
// Anything genuinely ambiguous ("jo", "corinthians") resolves to nothing and
// comes back as a list of candidates instead, so the UI can ask rather than
// guess.

import { BIBLE_BOOKS, type BibleBookMeta } from "./bible-books";

export type MatchKind = "exact" | "abbreviation" | "prefix" | "fuzzy";

export interface BookMatch {
  book: BibleBookMeta;
  kind: MatchKind;
  /** Lower is better. Only meaningful for ordering candidates. */
  distance: number;
}

// ─── Normalisation ───────────────────────────────────────────────────────────

/**
 * Ordinals, in every form a person might type them.
 *
 * "1 John", "1st John", "First John" and "I John" are all the same book, and
 * the roman numerals matter more than they look: they are what a lot of printed
 * Bibles use on the page someone is copying from.
 */
const ORDINALS: Record<string, string> = {
  first: "1", "1st": "1", i: "1", one: "1",
  second: "2", "2nd": "2", ii: "2", two: "2",
  third: "3", "3rd": "3", iii: "3", three: "3",
};

/** Lowercase, drop punctuation, fold ordinals, collapse spaces. */
export function normalizeBookQuery(raw: string): string {
  let s = raw
    .toLowerCase()
    .replace(/[.,'’"()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Fold a leading ordinal word/numeral onto the name: "first john" → "1 john".
  const parts = s.split(" ");
  if (parts.length > 1 && ORDINALS[parts[0]]) {
    parts[0] = ORDINALS[parts[0]];
    s = parts.join(" ");
  }
  // "1st" / "2nd" written tight against the name: "1stjohn" → "1 john".
  s = s.replace(/^([123])(?:st|nd|rd)\s*/, "$1 ");
  // A digit run straight into letters is a numbered book: "1john" → "1 john".
  s = s.replace(/^([123])\s*([a-z])/, "$1 $2");
  return s;
}

/** Spaces removed too — "1 john" and "1john" compare equal. */
function compact(s: string): string {
  return s.replace(/\s+/g, "");
}

// ─── Lookup tables ───────────────────────────────────────────────────────────

/** Standard abbreviations, compacted. Sourced from the table this replaces. */
const ABBREVIATIONS: Record<string, string> = {
  gen: "GEN", ge: "GEN", gn: "GEN",
  exo: "EXO", ex: "EXO", exod: "EXO",
  lev: "LEV", lv: "LEV",
  num: "NUM", nm: "NUM", nu: "NUM",
  deu: "DEU", dt: "DEU", deut: "DEU",
  jos: "JOS", jsh: "JOS", josh: "JOS",
  jdg: "JDG", judg: "JDG",
  rut: "RUT", rth: "RUT", ru: "RUT",
  "1sa": "1SA", "1sam": "1SA", "1sm": "1SA",
  "2sa": "2SA", "2sam": "2SA", "2sm": "2SA",
  "1ki": "1KI", "1kgs": "1KI", "1kin": "1KI",
  "2ki": "2KI", "2kgs": "2KI", "2kin": "2KI",
  "1ch": "1CH", "1chr": "1CH", "1chron": "1CH",
  "2ch": "2CH", "2chr": "2CH", "2chron": "2CH",
  ezr: "EZR", neh: "NEH", est: "EST", esth: "EST",
  job: "JOB",
  ps: "PSA", psa: "PSA", psalm: "PSA", psalms: "PSA", pss: "PSA", psm: "PSA",
  pro: "PRO", prov: "PRO", prv: "PRO", pr: "PRO",
  ecc: "ECC", eccl: "ECC", eccles: "ECC", qoh: "ECC",
  sng: "SNG", song: "SNG", sos: "SNG", canticles: "SNG",
  isa: "ISA", is: "ISA",
  jer: "JER", lam: "LAM",
  ezk: "EZK", eze: "EZK", ezek: "EZK",
  dan: "DAN", dn: "DAN",
  hos: "HOS", joe: "JOL", jol: "JOL", amo: "AMO", am: "AMO",
  oba: "OBA", obad: "OBA", ob: "OBA",
  jon: "JON", jnh: "JON",
  mic: "MIC", mc: "MIC",
  nam: "NAM", nah: "NAM",
  hab: "HAB", zep: "ZEP", zeph: "ZEP", hag: "HAG",
  zec: "ZEC", zech: "ZEC", mal: "MAL",
  mat: "MAT", matt: "MAT", mt: "MAT",
  mrk: "MRK", mk: "MRK", mar: "MRK", mark: "MRK",
  luk: "LUK", lk: "LUK",
  jhn: "JHN", jn: "JHN", joh: "JHN",
  act: "ACT", acts: "ACT",
  rom: "ROM", rm: "ROM",
  "1co": "1CO", "1cor": "1CO",
  "2co": "2CO", "2cor": "2CO",
  gal: "GAL", ga: "GAL",
  eph: "EPH", ephes: "EPH",
  php: "PHP", phil: "PHP", philip: "PHP", pp: "PHP",
  col: "COL",
  "1th": "1TH", "1thess": "1TH", "1thes": "1TH",
  "2th": "2TH", "2thess": "2TH", "2thes": "2TH",
  "1ti": "1TI", "1tim": "1TI",
  "2ti": "2TI", "2tim": "2TI",
  tit: "TIT", ti: "TIT",
  phm: "PHM", phlm: "PHM", philem: "PHM",
  heb: "HEB",
  jas: "JAS", jam: "JAS", jms: "JAS",
  "1pe": "1PE", "1pet": "1PE", "1pt": "1PE",
  "2pe": "2PE", "2pet": "2PE", "2pt": "2PE",
  "1jn": "1JN", "1joh": "1JN", "1john": "1JN",
  "2jn": "2JN", "2joh": "2JN", "2john": "2JN",
  "3jn": "3JN", "3joh": "3JN", "3john": "3JN",
  jud: "JUD", jude: "JUD",
  rev: "REV", rv: "REV", apocalypse: "REV",
};

/** Full names and the names people actually use, compacted. */
const NAMES: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const b of BIBLE_BOOKS) m[compact(normalizeBookQuery(b.name))] = b.id;
  const aliases: Record<string, string> = {
    psalm: "PSA",
    songofsongs: "SNG",
    songsofsolomon: "SNG",
    songofsolomon: "SNG",
    revelations: "REV",           // the plural is what most people type
    theacts: "ACT",
    actsoftheapostles: "ACT",
    ecclesiastes: "ECC",
    lamentations: "LAM",
  };
  for (const [k, v] of Object.entries(aliases)) m[compact(k)] = v;
  return m;
})();

const BY_ID = new Map(BIBLE_BOOKS.map((b) => [b.id, b]));

/**
 * The numbered books, indexed by their name without the number.
 *
 * "Thessalonians", "Corinthians", "Samuel", "Kings", "Peter" — people type
 * these without the volume all the time, and matching only the full name meant
 * "thess" hit nothing at all rather than offering the two books it obviously
 * means. Registered separately from the full names so a base-name hit always
 * ranks below a real one: "john" is the Gospel, not a tie between four books.
 */
const BASE_NAMES: { id: string; base: string }[] = BIBLE_BOOKS
  .filter((b) => /^[123] /.test(b.name))
  .map((b) => ({ id: b.id, base: compact(normalizeBookQuery(b.name.slice(2))) }));

// ─── Fuzzy matching ──────────────────────────────────────────────────────────

/**
 * Damerau-Levenshtein (optimal string alignment), capped.
 *
 * Plain Levenshtein counts a transposition as two edits, which is the wrong
 * price for the single most common typing mistake there is — "Ezekile",
 * "Zecharaih". Counting it as one is what lets those match at a threshold tight
 * enough to stay safe.
 */
function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  const prev2 = new Array<number>(b.length + 1);
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  let prevPrev = prev2;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prevPrev[j - 2] + 1);
      }
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    // Every remaining row can only grow, so a row already over budget is done.
    if (rowMin > max) return max + 1;
    const spare = prevPrev;
    prevPrev = prev;
    prev = curr;
    curr = spare;
  }
  return prev[b.length];
}

/** How wrong a word is allowed to be before we stop guessing. */
function fuzzyBudget(len: number): number {
  if (len <= 3) return 0;   // "jn", "mt" — the abbreviation table owns these
  if (len <= 5) return 1;
  if (len <= 8) return 2;
  return 3;
}

// ─── Resolving a book ────────────────────────────────────────────────────────

/**
 * Every book the input could plausibly mean, best first.
 *
 * Used for the type-ahead, and to explain an ambiguous input back to the user
 * rather than picking one of the candidates on their behalf.
 */
export function suggestBooks(raw: string, limit = 6): BookMatch[] {
  const q = normalizeBookQuery(raw);
  if (!q) return [];
  const c = compact(q);

  const out: BookMatch[] = [];
  const seen = new Set<string>();
  const add = (id: string | undefined, kind: MatchKind, distance: number) => {
    if (!id || seen.has(id)) return;
    const book = BY_ID.get(id);
    if (!book) return;
    seen.add(id);
    out.push({ book, kind, distance });
  };

  add(NAMES[c], "exact", 0);
  add(ABBREVIATIONS[c], "abbreviation", 0);

  // Prefix — "philip", "zeph", "1 thes". Shorter names first, so "jo" offers
  // Job before Joshua rather than in table order.
  const prefixed = BIBLE_BOOKS
    .filter((b) => compact(normalizeBookQuery(b.name)).startsWith(c))
    .sort((a, b) => a.name.length - b.name.length);
  for (const b of prefixed) add(b.id, "prefix", 0);

  // A numbered book named without its number — "thess", "corinthians". Ranked
  // one behind the full-name prefixes so these never outrank a real match.
  for (const { id, base } of BASE_NAMES) {
    if (base.startsWith(c)) add(id, "prefix", 1);
  }

  // Fuzzy — a typo, or two letters swapped. Base names are in here too, so
  // "corinthans" offers both letters rather than nothing.
  const budget = fuzzyBudget(c.length);
  if (budget > 0) {
    const scored: { id: string; d: number }[] = [];
    for (const b of BIBLE_BOOKS) {
      if (seen.has(b.id)) continue;
      const name = compact(normalizeBookQuery(b.name));
      const d = editDistance(c, name, budget);
      if (d <= budget) scored.push({ id: b.id, d });
    }
    for (const { id, base } of BASE_NAMES) {
      if (seen.has(id) || scored.some((s) => s.id === id)) continue;
      const d = editDistance(c, base, budget);
      if (d <= budget) scored.push({ id, d: d + 1 });
    }
    scored.sort((x, y) => x.d - y.d);
    for (const s of scored) add(s.id, "fuzzy", s.d);
  }

  return out.slice(0, limit);
}

/**
 * The one book the input means, or null when that is genuinely a guess.
 *
 * A name or an abbreviation always wins outright. A prefix or a fuzzy match
 * only wins if it is alone at its distance — "jo" and "corinthians" match
 * several books equally well, and answering one of them would be worse than
 * showing the choice.
 */
export function resolveBook(raw: string): BookMatch | null {
  const matches = suggestBooks(raw, 8);
  if (matches.length === 0) return null;
  const best = matches[0];
  if (best.kind === "exact" || best.kind === "abbreviation") return best;
  const tied = matches.filter((m) => m.kind === best.kind && m.distance === best.distance);
  return tied.length === 1 ? best : null;
}

// ─── Resolving a reference ───────────────────────────────────────────────────

export interface ParsedReference {
  book: BibleBookMeta;
  /** Null when only a book was given ("Philippians"). */
  chapter: number | null;
  verseStart?: number;
  verseEnd?: number;
  /** How the book name was matched — "fuzzy" means we corrected a misspelling. */
  kind: MatchKind;
  /** "Philippians 4:6-7" — what we understood, to echo back to the user. */
  label: string;
}

/**
 * Parse anything that looks like a reference.
 *
 * Accepts the separators people actually use — "John 3:16", "John 3.16",
 * "John 3 16", "jn3:16", "1cor13", "Romans 8:28-39", "Psalm 23" — and a bare
 * book name, which comes back with a null chapter so the caller can open the
 * book rather than assume chapter 1.
 *
 * Returns null for anything that isn't a reference at all, which is how a
 * caller tells a reference from a topic ("forgiveness") without a second parse.
 */
export function parseReference(raw: string): ParsedReference | null {
  const input = raw.trim();
  if (!input) return null;

  // Book, chapter, then optionally a verse and a range end. The book group is
  // lazy so that a leading digit ("1 Samuel") stays with the name.
  //
  // The tight form is tried first and requires the book to end on a letter, so
  // "john3:16" splits at the letter/digit boundary. Matching the loose form
  // first read that as "john3" chapter 16 — and then, gallingly, the fuzzy
  // matcher was good enough to accept "john3" as John, so it opened the wrong
  // chapter with no sign anything had gone wrong.
  const m =
    input.match(/^(.+?[a-z])\s*(\d+)(?:\s*[:.]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?\s*$/i) ??
    input.match(/^(.+?)\s*[\s.:]\s*(\d+)(?:\s*[:.\s]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?\s*$/);

  if (m) {
    const match = resolveBook(m[1]);
    if (match) {
      const chapter = Math.min(Math.max(parseInt(m[2], 10), 1), match.book.chapters);
      const verseStart = m[3] ? parseInt(m[3], 10) : undefined;
      const verseEnd = m[4] ? parseInt(m[4], 10) : undefined;
      return {
        book: match.book,
        chapter,
        verseStart,
        verseEnd,
        kind: match.kind,
        label: formatLabel(match.book.name, chapter, verseStart, verseEnd),
      };
    }
    return null;
  }

  // No chapter — a bare book name.
  const bookOnly = resolveBook(input);
  if (bookOnly) {
    return {
      book: bookOnly.book,
      chapter: null,
      kind: bookOnly.kind,
      label: bookOnly.book.name,
    };
  }
  return null;
}

function formatLabel(name: string, chapter: number, vStart?: number, vEnd?: number): string {
  if (vStart == null) return `${name} ${chapter}`;
  return vEnd != null && vEnd !== vStart
    ? `${name} ${chapter}:${vStart}-${vEnd}`
    : `${name} ${chapter}:${vStart}`;
}

/**
 * The reader URL for a parsed reference.
 *
 * `?v=` is the version parameter everywhere now. Two of the four call sites
 * used to write `?bibleId=`, which the reader happened to also accept — so it
 * worked, but nothing agreed on what the link to a chapter looks like.
 */
export function referenceHref(ref: ParsedReference, bibleId?: string): string {
  const chapter = ref.chapter ?? 1;
  const query = bibleId ? `?v=${encodeURIComponent(bibleId)}` : "";
  const hash = ref.verseStart != null ? `#v${ref.verseStart}` : "";
  return `/bible/read/${ref.book.id}/${chapter}${query}${hash}`;
}

/** Convenience for callers that hold a raw string and just want the URL. */
export function hrefForQuery(raw: string, bibleId?: string): string | null {
  const ref = parseReference(raw);
  return ref ? referenceHref(ref, bibleId) : null;
}
