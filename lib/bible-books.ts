// The 66 books, and nothing else.
//
// This was inside lib/bible-api.ts, which also carries the fetchers and the
// api.bible credentials. Every screen that needs to know what a book is called
// had to import that whole module to get it, and lib/bible-reference.ts —
// which resolves what someone typed into one of these — cannot import it at
// all without a cycle. So the table lives on its own now and both sides import
// it. lib/bible-api.ts re-exports BIBLE_BOOKS and bookById, so nothing that
// already imports them from there had to change.

export interface BibleBookMeta {
  id: string;
  name: string;
  chapters: number;
  testament: "OT" | "NT";
}

export const BIBLE_BOOKS: BibleBookMeta[] = [
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

