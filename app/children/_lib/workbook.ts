// Buddy's workbook: a short daily set of pages, one small problem each,
// written by hand with the pencil.
//
// The shape is Kumon's — little and often, by hand, marked at once, corrected
// until the page is right — with Khan Academy Kids' manners: one obvious next
// thing, spoken aloud, a hint before the answer, levels that follow the child.
// Everything here is pure so the set can be built on the server and tested.

/** What helps on a second miss: something to work it out with, never the answer. */
export type MathHint =
  | { kind: "dots"; a: number; b: number; op: "+" | "-" }
  | { kind: "text"; text: string };

export type WorkItem =
  | { id: string; type: "spell"; word: string }                       // hear it, write it
  | { id: string; type: "copy"; word: string }                        // see it, write it
  | { id: string; type: "math"; skill: number; display: string; say: string; answer: number; hint: MathHint };

export interface WorkResult {
  id: string;
  label: string;        // "cake" or "7 + 8"
  firstTry: boolean;
  tries: number;
}

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

type Fact = Omit<Extract<WorkItem, { type: "math" }>, "id" | "type" | "skill">;
const BOX = "\u25A1";   // □ — the number to find
const plus = (a: number, b: number): Fact => ({ display: `${a} + ${b} =`, say: `${a} plus ${b}`, answer: a + b, hint: a + b <= 20 ? { kind: "dots", a, b, op: "+" } : { kind: "text", text: "Add the tens, then the ones." } });
const minus = (a: number, b: number): Fact => ({ display: `${a} \u2212 ${b} =`, say: `${a} take away ${b}`, answer: a - b, hint: a <= 20 ? { kind: "dots", a, b, op: "-" } : { kind: "text", text: "Take away the tens, then the ones." } });

/**
 * The math ladder. Each rung is one skill with a goal in the child's words
 * ("I can…"), a short lesson Buddy teaches before the practice, and a maker
 * of problems. It runs from counting on, through facts to 20, to finding the
 * missing number in an equation, tens and ones, and word problems. New rungs
 * go on the end; a child's place is a number, so the ladder can grow.
 */
export interface MathSkill {
  title: string;                       // for parents
  goal: string;                        // for the child: "I can make 10"
  /** The lesson: what Buddy says, one idea per line, and one worked example. */
  teach: string[];
  example: { display: string; answer: number; dots?: { a: number; b: number; op: "+" | "-" } };
  make: (r: () => number) => Fact;
}

export const MATH_SKILLS: MathSkill[] = [
  { title: "Counting on 1", goal: "I can add 1",
    teach: ["Adding 1 means the very next number.", "Start at the big number and count one more."],
    example: { display: "6 + 1 = 7", answer: 7, dots: { a: 6, b: 1, op: "+" } },
    make: (r) => plus(int(r, 1, 9), 1) },
  { title: "Adding within 10", goal: "I can add up to 10",
    teach: ["Start with the bigger number.", "Then count on the smaller one.", "For 5 plus 3: say 5, then 6, 7, 8."],
    example: { display: "5 + 3 = 8", answer: 8, dots: { a: 5, b: 3, op: "+" } },
    make: (r) => { const a = int(r, 1, 8); return plus(a, int(r, 1, 10 - a)); } },
  { title: "Making 10", goal: "I can make 10",
    teach: ["Some numbers are friends that make 10.", "7 and 3. 6 and 4. 8 and 2. 9 and 1. 5 and 5.", "Find the friend that fills the ten."],
    example: { display: `7 + ${BOX} = 10   \u2192   3`, answer: 3, dots: { a: 7, b: 3, op: "+" } },
    make: (r) => { const a = int(r, 1, 9); return { display: `${a} + ${BOX} = 10`, say: `${a} plus what makes 10?`, answer: 10 - a, hint: { kind: "dots", a, b: 10 - a, op: "+" } }; } },
  { title: "Doubles", goal: "I can add doubles",
    teach: ["A double is a number plus itself.", "4 plus 4 is 8. 6 plus 6 is 12.", "Doubles are worth knowing by heart."],
    example: { display: "6 + 6 = 12", answer: 12, dots: { a: 6, b: 6, op: "+" } },
    make: (r) => { const a = int(r, 2, 10); return plus(a, a); } },
  { title: "Adding within 20", goal: "I can add up to 20",
    teach: ["When it goes past 10, make a ten first.", "For 8 plus 5: 8 needs 2 to make 10.", "Take 2 from the 5. That leaves 3. 10 and 3 is 13."],
    example: { display: "8 + 5 = 13", answer: 13, dots: { a: 8, b: 5, op: "+" } },
    make: (r) => { const a = int(r, 6, 9); return plus(a, int(r, 11 - a, 9)); } },
  { title: "Taking away within 10", goal: "I can take away up to 10",
    teach: ["Taking away means some go.", "Start with the first number and count back.", "For 9 take away 2: say 9, then 8, 7."],
    example: { display: "9 \u2212 2 = 7", answer: 7, dots: { a: 9, b: 2, op: "-" } },
    make: (r) => { const a = int(r, 3, 10); return minus(a, int(r, 1, a - 1)); } },
  { title: "Missing number: adding", goal: "I can find the missing number",
    teach: ["The box is hiding a number.", "Both sides of the equals sign must be the same.", "For box plus 3 equals 8: what goes with 3 to make 8? 5."],
    example: { display: `${BOX} + 3 = 8   \u2192   5`, answer: 5, dots: { a: 5, b: 3, op: "+" } },
    make: (r) => { const total = int(r, 5, 12); const b = int(r, 1, total - 1); const first = r() < 0.5;
      return { display: first ? `${BOX} + ${b} = ${total}` : `${b} + ${BOX} = ${total}`, say: first ? `What plus ${b} equals ${total}?` : `${b} plus what equals ${total}?`, answer: total - b, hint: { kind: "text", text: `Start at ${b} and count up to ${total}. How many jumps?` } }; } },
  { title: "Taking away within 20", goal: "I can take away up to 20",
    teach: ["For big take-aways, go back to 10 first.", "For 13 take away 5: take 3 to get to 10.", "Then take 2 more. That is 8."],
    example: { display: "13 \u2212 5 = 8", answer: 8, dots: { a: 13, b: 5, op: "-" } },
    make: (r) => { const a = int(r, 11, 18); return minus(a, int(r, a - 9, 9)); } },
  { title: "Missing number: taking away", goal: "I can find the missing number when taking away",
    teach: ["Adding and taking away are a family.", "If 7 plus 5 is 12, then 12 take away 5 is 7.", "Use the adding you know to find the box."],
    example: { display: `12 \u2212 ${BOX} = 7   \u2192   5`, answer: 5 },
    make: (r) => { const a = int(r, 7, 15); const ans = int(r, 2, a - 2);
      return { display: `${a} \u2212 ${BOX} = ${a - ans}`, say: `${a} take away what equals ${a - ans}?`, answer: ans, hint: { kind: "text", text: `Think: ${a - ans} plus what makes ${a}?` } }; } },
  { title: "Adding three numbers", goal: "I can add three numbers",
    teach: ["Look for two that make 10 first.", "For 4 plus 6 plus 3: 4 and 6 make 10.", "10 and 3 is 13."],
    example: { display: "4 + 6 + 3 = 13", answer: 13 },
    make: (r) => { const a = int(r, 1, 9); const c = int(r, 1, 8); const order = r() < 0.5;
      return { display: order ? `${a} + ${10 - a} + ${c} =` : `${a} + ${c} + ${10 - a} =`, say: order ? `${a} plus ${10 - a} plus ${c}` : `${a} plus ${c} plus ${10 - a}`, answer: 10 + c, hint: { kind: "text", text: `Find the two that make 10: ${a} and ${10 - a}.` } }; } },
  { title: "Adding and taking away tens", goal: "I can add tens",
    teach: ["Tens work just like ones.", "3 plus 4 is 7, so 30 plus 40 is 70.", "Count the tens."],
    example: { display: "30 + 40 = 70", answer: 70 },
    make: (r) => { if (r() < 0.6) { const a = int(r, 1, 6); const b = int(r, 1, 9 - a); return { ...plus(a * 10, b * 10), hint: { kind: "text", text: `${a} tens and ${b} tens. How many tens?` } }; }
      const a = int(r, 3, 9); const b = int(r, 1, a - 1); return { ...minus(a * 10, b * 10), hint: { kind: "text", text: `${a} tens take away ${b} tens.` } }; } },
  { title: "Tens and ones: adding", goal: "I can add to a big number",
    teach: ["A number like 34 is 3 tens and 4 ones.", "To add 5, just add to the ones.", "34 plus 5: 4 and 5 is 9. So 39."],
    example: { display: "34 + 5 = 39", answer: 39 },
    make: (r) => { const tens = int(r, 1, 8) * 10; const ones = int(r, 1, 6); return { ...plus(tens + ones, int(r, 1, 9 - ones)), hint: { kind: "text", text: "Keep the tens. Add only the ones." } }; } },
  { title: "Adding two big numbers", goal: "I can add two big numbers",
    teach: ["Add the tens together.", "Add the ones together.", "For 23 plus 14: 2 tens and 1 ten is 30. 3 and 4 is 7. So 37."],
    example: { display: "23 + 14 = 37", answer: 37 },
    make: (r) => { const t1 = int(r, 1, 5), o1 = int(r, 1, 7); const t2 = int(r, 1, 8 - t1), o2 = int(r, 1, 9 - o1); return plus(t1 * 10 + o1, t2 * 10 + o2); } },
  { title: "Taking away from big numbers", goal: "I can take away from a big number",
    teach: ["Take away the tens, then the ones.", "For 47 take away 12: 4 tens take 1 ten is 30.", "7 take away 2 is 5. So 35."],
    example: { display: "47 \u2212 12 = 35", answer: 35 },
    make: (r) => { const t1 = int(r, 2, 9), o1 = int(r, 2, 9); const t2 = int(r, 0, t1 - 1), o2 = int(r, 1, o1); return minus(t1 * 10 + o1, t2 * 10 + o2); } },
  { title: "Balancing equations", goal: "I can make both sides equal",
    teach: ["The equals sign means both sides are the same amount.", "For 5 plus 3 equals box plus 4: the left side is 8.", "What plus 4 makes 8? 4."],
    example: { display: `5 + 3 = ${BOX} + 4   \u2192   4`, answer: 4 },
    make: (r) => { const a = int(r, 2, 8), b = int(r, 2, 8); const c = int(r, 1, a + b - 1);
      return { display: `${a} + ${b} = ${BOX} + ${c}`, say: `${a} plus ${b} equals what plus ${c}?`, answer: a + b - c, hint: { kind: "text", text: `The left side is ${a + b}. What plus ${c} makes ${a + b}?` } }; } },
  { title: "Word problems", goal: "I can solve a story problem",
    teach: ["Listen to the story.", "More means add. Gave away or ate means take away.", "Write just the number."],
    example: { display: "5 apples and 3 more = 8", answer: 8 },
    make: (r) => { const who = ["Sam", "Mia", "Ben", "Zoe"][int(r, 0, 3)]; const thing = ["apples", "stickers", "toy cars", "crayons"][int(r, 0, 3)];
      if (r() < 0.5) { const a = int(r, 3, 12), b = int(r, 2, 8); return { display: `${who} has ${a} ${thing} and gets ${b} more. How many now?`, say: `${who} has ${a} ${thing} and gets ${b} more. How many now?`, answer: a + b, hint: { kind: "dots", a, b, op: "+" } }; }
      const a = int(r, 6, 18), b = int(r, 2, Math.min(9, a - 1)); return { display: `${who} has ${a} ${thing} and gives away ${b}. How many are left?`, say: `${who} has ${a} ${thing} and gives away ${b}. How many are left?`, answer: a - b, hint: { kind: "dots", a, b, op: "-" } }; } },
];
export const MAX_LEVEL = MATH_SKILLS.length;
/** Kept for anything that still asks for a level's name. */
export const MATH_LEVELS = MATH_SKILLS.map((k) => k.title);

function mathItems(level: number, count: number, r: () => number): WorkItem[] {
  const at = Math.max(1, Math.min(MAX_LEVEL, level));
  const out: WorkItem[] = [];
  const seen = new Set<string>();
  // Mostly the skill being learned, with one in four from an earlier rung so
  // what was mastered last month is not forgotten (Kumon's spiral).
  const review = at > 1 ? Math.max(1, Math.round(count / 4)) : 0;
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const skill = out.length >= count - review ? int(r, 1, at - 1) : at;
    const f = MATH_SKILLS[skill - 1].make(r);
    if (seen.has(f.display) || f.answer < 0) continue;
    seen.add(f.display);
    out.push({ id: `m${out.length}`, type: "math", skill, ...f });
  }
  return out;
}

/**
 * Today's pages. "mixed" is a few spelling words, a couple of sight words to
 * copy, and math at the child's level; "math" is a full sitting of math.
 */
export function buildWorkbook(input: { words: string[]; sightWords: string[]; level: number; seed: number; mode?: "mixed" | "math" }): WorkItem[] {
  const r = rng(input.seed);
  if (input.mode === "math") return mathItems(input.level, 10, r);
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
  const math = mathItems(input.level, spell.length + copy.length === 0 ? 8 : 5, r);

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
  return item.type === "math" ? item.display.replace(/\s*=\s*$/, "").slice(0, 24) : item.word;
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
