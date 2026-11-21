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

// ── The lesson: a worked example, made fresh each time ──────────────────────

export interface Demo {
  /** The problem as asked, with no answer in it. */
  problem: string;
  /** How to think it through, one short step at a time. Shown and spoken in turn. */
  steps: string[];
  /** The finished line, shown only after the last step. */
  result: string;
  dots?: { a: number; b: number; op: "+" | "-" };
}

const countOn = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i + 1).join(", ");
const countBack = (from: number, n: number) => Array.from({ length: n }, (_, i) => from - i - 1).join(", ");

/**
 * A worked example for a skill, with its own numbers. The lesson used to show
 * one fixed sum per skill, so "Teach me" taught the same 5 + 3 every time —
 * and could be the very problem on the page. A different seed gives different
 * numbers; `avoid` keeps it off any problem the child is about to be asked.
 */
export function demoFor(skill: number, seed: number, avoid: string[] = []): Demo {
  const r = rng(seed);
  const M = "\u2212";
  const build = (): Demo => {
    switch (Math.max(1, Math.min(MAX_LEVEL, skill))) {
      case 1: { const a = int(r, 2, 8); return { problem: `${a} + 1 =`, steps: [`Start at ${a}.`, `Adding 1 is the very next number.`, `After ${a} comes ${a + 1}.`], result: `${a} + 1 = ${a + 1}`, dots: { a, b: 1, op: "+" } }; }
      case 2: { const big = int(r, 4, 7), small = int(r, 2, Math.min(3, 10 - big)); return { problem: `${small} + ${big} =`, steps: [`Find the bigger number. It is ${big}.`, `Start at ${big} and count on ${small}: ${countOn(big, small)}.`, `The last number you said is the answer: ${big + small}.`], result: `${small} + ${big} = ${big + small}`, dots: { a: big, b: small, op: "+" } }; }
      case 3: { const a = int(r, 2, 8); return { problem: `${a} + ${BOX} = 10`, steps: [`Here are ${a}. We want 10.`, `Count up from ${a} to 10: ${countOn(a, 10 - a)}.`, `That was ${10 - a} more. ${a} and ${10 - a} are friends of 10.`], result: `${a} + ${10 - a} = 10`, dots: { a, b: 10 - a, op: "+" } }; }
      case 4: { const a = int(r, 3, 9); return { problem: `${a} + ${a} =`, steps: [`A double is the same number two times.`, `Here are ${a}, and ${a} more.`, `${a} and ${a} make ${a * 2}. Doubles are good to know by heart.`], result: `${a} + ${a} = ${a * 2}`, dots: { a, b: a, op: "+" } }; }
      case 5: { const a = int(r, 7, 9), b = int(r, 11 - a + 1, 8), need = 10 - a; return { problem: `${a} + ${b} =`, steps: [`${a} is close to 10. It needs ${need} more.`, `Break ${b} into ${need} and ${b - need}.`, `${a} and ${need} make 10. Then 10 and ${b - need} is ${a + b}.`], result: `${a} + ${b} = ${a + b}`, dots: { a, b, op: "+" } }; }
      case 6: { const a = int(r, 6, 10), b = int(r, 2, 3); return { problem: `${a} ${M} ${b} =`, steps: [`Start at ${a}.`, `Count back ${b}: ${countBack(a, b)}.`, `The last number you said is what is left: ${a - b}.`], result: `${a} ${M} ${b} = ${a - b}`, dots: { a, b, op: "-" } }; }
      case 7: { const total = int(r, 7, 12), b = int(r, 3, total - 3); return { problem: `${BOX} + ${b} = ${total}`, steps: [`The box is hiding a number.`, `Start at ${b} and count up to ${total}: ${countOn(b, total - b)}.`, `That was ${total - b} jumps, so the box is ${total - b}.`], result: `${total - b} + ${b} = ${total}` }; }
      case 8: { const a = int(r, 12, 16), toTen = a - 10, b = int(r, toTen + 1, 9); return { problem: `${a} ${M} ${b} =`, steps: [`First go back to 10. That takes away ${toTen}.`, `${b} is ${toTen} and ${b - toTen}, so take away ${b - toTen} more.`, `10 take away ${b - toTen} is ${a - b}.`], result: `${a} ${M} ${b} = ${a - b}`, dots: { a, b, op: "-" } }; }
      case 9: { const a = int(r, 9, 15), ans = int(r, 3, a - 3); return { problem: `${a} ${M} ${BOX} = ${a - ans}`, steps: [`Adding and taking away are a family.`, `Ask it the adding way: ${a - ans} plus what makes ${a}?`, `${a - ans} plus ${ans} is ${a}. So the box is ${ans}.`], result: `${a} ${M} ${ans} = ${a - ans}` }; }
      case 10: { const a = int(r, 2, 8), c = int(r, 2, 7); return { problem: `${a} + ${c} + ${10 - a} =`, steps: [`Look for two numbers that make 10.`, `${a} and ${10 - a} make 10.`, `Now it is easy: 10 and ${c} is ${10 + c}.`], result: `${a} + ${c} + ${10 - a} = ${10 + c}` }; }
      case 11: { const a = int(r, 2, 5), b = int(r, 1, 4); return { problem: `${a * 10} + ${b * 10} =`, steps: [`${a * 10} is ${a} tens. ${b * 10} is ${b} tens.`, `${a} tens and ${b} tens is ${a + b} tens.`, `${a + b} tens is ${(a + b) * 10}.`], result: `${a * 10} + ${b * 10} = ${(a + b) * 10}` }; }
      case 12: { const t = int(r, 2, 7), o = int(r, 1, 5), b = int(r, 2, 9 - o); return { problem: `${t * 10 + o} + ${b} =`, steps: [`${t * 10 + o} is ${t} tens and ${o} ones.`, `Leave the tens alone. Add the ones: ${o} and ${b} is ${o + b}.`, `${t} tens and ${o + b} ones is ${t * 10 + o + b}.`], result: `${t * 10 + o} + ${b} = ${t * 10 + o + b}` }; }
      case 13: { const t1 = int(r, 1, 4), o1 = int(r, 1, 5), t2 = int(r, 1, 4), o2 = int(r, 1, 9 - o1); const x = t1 * 10 + o1, y = t2 * 10 + o2; return { problem: `${x} + ${y} =`, steps: [`Add the tens: ${t1 * 10} and ${t2 * 10} is ${(t1 + t2) * 10}.`, `Add the ones: ${o1} and ${o2} is ${o1 + o2}.`, `Put them together: ${(t1 + t2) * 10} and ${o1 + o2} is ${x + y}.`], result: `${x} + ${y} = ${x + y}` }; }
      case 14: { const t1 = int(r, 3, 8), o1 = int(r, 4, 9), t2 = int(r, 1, t1 - 1), o2 = int(r, 1, o1 - 1); const x = t1 * 10 + o1, y = t2 * 10 + o2; return { problem: `${x} ${M} ${y} =`, steps: [`Take away the tens: ${t1 * 10} take away ${t2 * 10} is ${(t1 - t2) * 10}.`, `Take away the ones: ${o1} take away ${o2} is ${o1 - o2}.`, `Put them together: ${x - y}.`], result: `${x} ${M} ${y} = ${x - y}` }; }
      case 15: { const a = int(r, 3, 7), b = int(r, 2, 6), c = int(r, 2, a + b - 2); return { problem: `${a} + ${b} = ${BOX} + ${c}`, steps: [`The equals sign means both sides are the same amount.`, `Work out the left side: ${a} plus ${b} is ${a + b}.`, `The right side must be ${a + b} too. What plus ${c} makes ${a + b}? ${a + b - c}.`], result: `${a} + ${b} = ${a + b - c} + ${c}` }; }
      default: { const who = ["Leo", "Ava", "Max", "Ivy"][int(r, 0, 3)], thing = ["marbles", "books", "blocks", "shells"][int(r, 0, 3)];
        if (r() < 0.5) { const a = int(r, 4, 9), b = int(r, 2, 6); return { problem: `${who} has ${a} ${thing} and gets ${b} more.`, steps: [`Listen for the clue word. "More" means add.`, `Write it as a sum: ${a} plus ${b}.`, `${a} plus ${b} is ${a + b}. ${who} has ${a + b} ${thing}.`], result: `${a} + ${b} = ${a + b}`, dots: { a, b, op: "+" } }; }
        const a = int(r, 8, 14), b = int(r, 2, 6); return { problem: `${who} has ${a} ${thing} and gives away ${b}.`, steps: [`Listen for the clue. "Gives away" means take away.`, `Write it: ${a} take away ${b}.`, `${a} take away ${b} is ${a - b}. ${who} has ${a - b} left.`], result: `${a} ${M} ${b} = ${a - b}`, dots: { a, b, op: "-" } }; }
    }
  };
  let d = build();
  for (let i = 0; i < 12 && avoid.some((p) => p.replace(/\s/g, "") === d.problem.replace(/\s/g, "")); i++) d = build();
  return d;
}

/** One problem to do together after the lesson: the skill's own kind, not one already in the set. */
export function guidedFor(skill: number, seed: number, avoid: string[] = []): Extract<WorkItem, { type: "math" }> {
  const r = rng(seed);
  const at = Math.max(1, Math.min(MAX_LEVEL, skill));
  let f = MATH_SKILLS[at - 1].make(r);
  for (let i = 0; i < 20 && avoid.includes(f.display); i++) f = MATH_SKILLS[at - 1].make(r);
  return { id: `g${seed}`, type: "math", skill: at, ...f };
}

/**
 * What the microphone heard, as the number it meant. Speech-to-text writes
 * "ate" for eight and "to" for two; in a math answer those are numbers.
 * `always` is for the math game; elsewhere only a one-word reply is changed.
 */
const HEARD_NUMBERS: Record<string, number> = {
  zero: 0, oh: 0, one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, tree: 3, free: 3, four: 4, for: 4, fore: 4, five: 5, six: 6, sex: 6, sicks: 6,
  seven: 7, eight: 8, ate: 8, nine: 9, nein: 9, ten: 10, tin: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};
export function heardAsNumbers(text: string, always: boolean): string {
  const words = text.trim().split(/\s+/);
  if (!always && words.length > 1) return text;
  const strict = new Set(["to", "too", "for", "fore", "oh", "won", "tree", "free", "sex", "sicks", "nein", "tin", "ate"]);
  return words.map((w) => {
    const bare = w.toLowerCase().replace(/[^a-z]/g, "");
    if (!(bare in HEARD_NUMBERS)) return w;
    // In a sentence, only turn a sound-alike into a number when it stands alone as the answer.
    if (words.length > 3 && strict.has(bare)) return w;
    return String(HEARD_NUMBERS[bare]) + w.replace(/^[A-Za-z]+/, "");
  }).join(" ");
}
