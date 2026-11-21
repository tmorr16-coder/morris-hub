// Buddy's workbook: a short daily set of pages, one small problem each,
// written by hand with the pencil.
//
// The shape is Kumon's — little and often, by hand, marked at once, corrected
// until the page is right — with Khan Academy Kids' manners: one obvious next
// thing, spoken aloud, a hint before the answer, levels that follow the child.
// Everything here is pure so the set can be built on the server and tested.

export type WorkItem =
  | { id: string; type: "spell"; word: string }                       // hear it, write it
  | { id: string; type: "copy"; word: string }                        // see it, write it
  | { id: string; type: "math"; a: number; b: number; op: "+" | "-"; answer: number };

export interface WorkResult {
  id: string;
  label: string;        // "cake" or "7 + 8"
  firstTry: boolean;
  tries: number;
}

export const MATH_LEVELS = [
  "Adding 1",
  "Adding within 10",
  "Doubles",
  "Adding within 20",
  "Taking away within 10",
  "Taking away within 20",
  "Tens and ones",
  "Mixed practice",
] as const;
export const MAX_LEVEL = MATH_LEVELS.length;

/** Small seeded generator, so one day's set is the same if reopened. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

function mathFact(level: number, r: () => number): { a: number; b: number; op: "+" | "-" } {
  switch (Math.max(1, Math.min(MAX_LEVEL, level))) {
    case 1: return { a: int(r, 1, 9), b: 1, op: "+" };
    case 2: { const a = int(r, 1, 8); return { a, b: int(r, 1, 10 - a), op: "+" }; }
    case 3: { const a = int(r, 1, 10); return { a, b: a, op: "+" }; }
    case 4: { const a = int(r, 3, 12); return { a, b: int(r, 2, Math.min(9, 20 - a)), op: "+" }; }
    case 5: { const a = int(r, 3, 10); return { a, b: int(r, 1, a - 1), op: "-" }; }
    case 6: { const a = int(r, 11, 20); return { a, b: int(r, 2, 9), op: "-" }; }
    case 7: { const tens = int(r, 1, 8) * 10; const ones = int(r, 1, 5); return { a: tens + ones, b: int(r, 1, 9 - ones), op: "+" }; }
    default: return r() < 0.5 ? mathFact(4, r) : r() < 0.5 ? mathFact(6, r) : mathFact(7, r);
  }
}

/** Today's pages: a few spelling words, a couple of sight words to copy, and math at the child's level. */
export function buildWorkbook(input: { words: string[]; sightWords: string[]; level: number; seed: number }): WorkItem[] {
  const r = rng(input.seed);
  const pick = <T,>(list: T[], n: number): T[] => {
    const pool = [...list];
    const out: T[] = [];
    while (pool.length && out.length < n) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  };
  const clean = (w: string) => w.trim().toLowerCase();
  const ok = (w: string) => /^[a-z]{2,12}$/.test(w);
  const spell = pick([...new Set(input.words.map(clean).filter(ok))], 4);
  const copy = pick([...new Set(input.sightWords.map(clean).filter(ok))].filter((w) => !spell.includes(w)), 2);

  const math: WorkItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (math.length < (spell.length + copy.length === 0 ? 8 : 5) && guard++ < 60) {
    const f = mathFact(input.level, r);
    const key = `${f.a}${f.op}${f.b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    math.push({ id: `m${math.length}`, type: "math", ...f, answer: f.op === "+" ? f.a + f.b : f.a - f.b });
  }

  // Warm up on something to copy, then alternate so no kind runs long.
  const words: WorkItem[] = [
    ...copy.map((w, i): WorkItem => ({ id: `c${i}`, type: "copy", word: w })),
    ...spell.map((w, i): WorkItem => ({ id: `s${i}`, type: "spell", word: w })),
  ];
  const out: WorkItem[] = [];
  while (words.length || math.length) {
    if (words.length) out.push(words.shift()!);
    if (math.length) out.push(math.shift()!);
  }
  return out;
}

export function labelOf(item: WorkItem): string {
  return item.type === "math" ? `${item.a} ${item.op === "-" ? "−" : "+"} ${item.b}` : item.word;
}
export function answerOf(item: WorkItem): string {
  return item.type === "math" ? String(item.answer) : item.word;
}

/** Does what was read off the page match? Case, spaces and stray marks are forgiven; the letters are not. */
export function matches(item: WorkItem, read: string): boolean {
  if (item.type === "math") {
    const digits = read.replace(/[^0-9]/g, "");
    return digits !== "" && Number(digits) === item.answer;
  }
  return read.toLowerCase().replace(/[^a-z]/g, "") === item.word;
}

/** Next math level from how the last set went: up after a strong one, down after a hard one. */
export function nextLevel(level: number, mathFirstTry: number, mathTotal: number): number {
  if (mathTotal < 3) return level;
  const rate = mathFirstTry / mathTotal;
  if (rate >= 0.9) return Math.min(MAX_LEVEL, level + 1);
  if (rate < 0.6) return Math.max(1, level - 1);
  return level;
}

export function starsFor(firstTry: number, total: number): number {
  if (total === 0) return 1;
  const rate = firstTry / total;
  return rate >= 0.9 ? 3 : rate >= 0.6 ? 2 : 1;
}
