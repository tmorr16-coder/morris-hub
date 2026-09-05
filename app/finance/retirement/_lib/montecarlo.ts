// Monte-Carlo simulation over the projection engine — shared by the Projection
// tab and the printed plan document, so the success rate a person reads on
// screen is the one that appears on the page they hand to someone else.
//
// Lived inside ProjectionTab until the plan document needed it. A second copy
// would have drifted the first time either was tuned.

import { runProjection, returnForAge, type StepCtx } from "./projection";

export const MC_SIMS = 400;
export const MC_STDEV = 0.12;
/**
 * Real returns are not normal: the left tail is fatter than a bell curve, and
 * the deep, sustained drawdowns are what actually break a plan. A plain normal
 * draw understates exactly the risk this exists to show.
 *
 * A two-component mixture is the cheapest honest improvement — most years are
 * ordinary, and roughly one in ten is drawn from a wider, lower distribution.
 * It is still an approximation: it has no serial correlation, so a genuine
 * multi-year bear market is under-represented. A historical block bootstrap
 * would be the real answer and needs a return series we do not hold.
 */
export const MC_CRASH_PROB = 0.10;
export const MC_CRASH_SHIFT = 2.0;   // in standard deviations, downward
export const MC_CRASH_WIDEN = 1.5;
/** Inflation is a forecast, not a constant. Drawn per simulation. */
export const MC_INFLATION_STDEV = 0.01;
export const MC_SEED = 0x9e3779b9;

// Seeded PRNG (mulberry32) + Box–Muller normal draw — keeps the band stable
// across re-renders and identical between screen and document (must never rely
// on Math.random()/Date.now()).
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function nextNormal(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export interface MonteCarloBandPoint { age: number; p10: number; p50: number; p90: number }

export interface MonteCarloResult {
  band: MonteCarloBandPoint[];
  successRate: number;
  failures: number;
  /** The typical failure, and the early-failure case worth planning against. */
  medianDepletionAge: number | null;
  earlyDepletionAge: number | null;
  /** What the plan leaves behind in the bad-but-not-broke tenth percentile. */
  p10Final: number;
  medianFinal: number;
}

/**
 * Run the simulation across `ages` (ascending, contiguous). `ages` is the
 * window being drawn; the underlying path always runs the full plan, so the
 * success rate does not change when the chart is zoomed.
 */
export function runMonteCarlo(ctx: StepCtx, ages: number[]): MonteCarloResult {
  const rng = mulberry32(MC_SEED);
  const perAge: number[][] = Array.from({ length: ages.length }, () => [] as number[]);
  let successes = 0;
  const depletionAges: number[] = [];

  for (let s = 0; s < MC_SIMS; s++) {
    // Each simulation gets its own inflation path, so a plan carrying a
    // non-COLA pension is tested against inflation risk rather than assuming
    // the forecast is exact.
    const simCtx: StepCtx = {
      ...ctx,
      profile: {
        ...ctx.profile,
        inflation_rate: Math.max(0, ctx.profile.inflation_rate + nextNormal(rng) * MC_INFLATION_STDEV),
      },
    };
    const draw = (age: number) => {
      const base = returnForAge(simCtx, age);
      const crash = rng() < MC_CRASH_PROB;
      return crash
        ? base - MC_CRASH_SHIFT * MC_STDEV + nextNormal(rng) * MC_STDEV * MC_CRASH_WIDEN
        : base + nextNormal(rng) * MC_STDEV;
    };
    const { byAge, final, depletionAge } = runProjection(simCtx, draw);
    ages.forEach((a, i) => perAge[i].push(byAge.get(a) ?? 0));
    if (final > 0) successes++;
    else if (depletionAge != null) depletionAges.push(depletionAge);
  }

  const band = ages.map((a, i) => {
    const sorted = perAge[i].slice().sort((x, y) => x - y);
    return { age: a, p10: percentile(sorted, 0.1), p50: percentile(sorted, 0.5), p90: percentile(sorted, 0.9) };
  });

  // "Success" as a single percentage hides everything that matters about a
  // failure. A plan that runs dry at 71 and one that runs dry at 89 counted
  // the same; so did one ending with a dollar and one ending with millions.
  const sortedDepletion = depletionAges.slice().sort((a, b) => a - b);
  const finalsSorted = perAge.length ? perAge[perAge.length - 1].slice().sort((a, b) => a - b) : [];
  return {
    band,
    successRate: successes / MC_SIMS,
    failures: depletionAges.length,
    medianDepletionAge: sortedDepletion.length ? percentile(sortedDepletion, 0.5) : null,
    earlyDepletionAge: sortedDepletion.length ? percentile(sortedDepletion, 0.1) : null,
    p10Final: percentile(finalsSorted, 0.1),
    medianFinal: percentile(finalsSorted, 0.5),
  };
}
