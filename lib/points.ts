// Pricing in points.
//
// A balance of 84,000 Bonvoy points tells you nothing next to a $210 room until
// the two are in the same unit. This converts using the programme's cents-per-
// point value — a yardstick, not a quote, so everything it produces is prefixed
// with "≈". Award charts are dynamic and property-specific; the honest claim is
// "this is roughly what those points are worth", not "this room costs N points".

import { brandFor, brandByKey, type BrandCategory } from "./brands";

export interface LoyaltyBalance {
  program_name: string;
  category: string;              // air | hotel | car | rail | credit_card
  points_balance: number | null;
  tier?: string | null;
}

export interface PointsQuote {
  program: string;               // "Marriott Bonvoy"
  points: number;                // approximate points for the cash price
  balance: number | null;        // what you hold, when known
  covers: boolean;               // balance is enough
  shortfall: number | null;      // points still needed, when it isn't
  centsPerPoint: number;
}

/** Round to something a human would say: 26,000 rather than 25,847. */
export function roundPoints(points: number): number {
  if (points >= 100_000) return Math.round(points / 5_000) * 5_000;
  if (points >= 10_000) return Math.round(points / 1_000) * 1_000;
  if (points >= 1_000) return Math.round(points / 500) * 500;
  return Math.round(points / 100) * 100;
}

export function formatPoints(points: number): string {
  return new Intl.NumberFormat("en-US").format(roundPoints(points));
}

/** The user's balance in a programme, matched loosely by name. */
function balanceFor(programName: string, balances: LoyaltyBalance[]): number | null {
  const want = programName.toLowerCase();
  const hit = balances.find((b) => {
    const have = (b.program_name ?? "").toLowerCase();
    return have === want || have.includes(want) || want.includes(have.split(" ")[0]);
  });
  return hit?.points_balance ?? null;
}

/**
 * What a cash price is worth in the points of whichever brand the result
 * belongs to. Returns null when we can't recognise the brand, don't have a
 * valuation for it, or there's no price to convert — the UI then just shows
 * cash rather than inventing a number.
 */
export function pointsQuote(
  price: number | null | undefined,
  name: string | null | undefined,
  category: BrandCategory,
  balances: LoyaltyBalance[] = [],
): PointsQuote | null {
  if (typeof price !== "number" || price <= 0) return null;
  const brand = brandFor(name, category);
  if (!brand?.centsPerPoint || !brand.program) return null;

  const points = (price * 100) / brand.centsPerPoint;
  const balance = balanceFor(brand.program, balances);
  const rounded = roundPoints(points);

  return {
    program: brand.program,
    points: rounded,
    balance,
    covers: balance != null && balance >= rounded,
    shortfall: balance != null && balance < rounded ? rounded - balance : null,
    centsPerPoint: brand.centsPerPoint,
  };
}

/** Total points held per category, for the profile summary. */
export function balanceSummary(balances: LoyaltyBalance[]): { category: string; programs: number; points: number }[] {
  const byCategory = new Map<string, { programs: number; points: number }>();
  for (const b of balances) {
    const row = byCategory.get(b.category) ?? { programs: 0, points: 0 };
    row.programs += 1;
    row.points += b.points_balance ?? 0;
    byCategory.set(b.category, row);
  }
  return [...byCategory.entries()].map(([category, v]) => ({ category, ...v }));
}

/** What a balance is worth in dollars, using the programme's own valuation. */
export function balanceValue(balance: LoyaltyBalance): number | null {
  if (!balance.points_balance) return null;
  const brand = brandFor(balance.program_name, undefined) ?? brandByKey(balance.program_name.toLowerCase());
  if (!brand?.centsPerPoint) return null;
  return (balance.points_balance * brand.centsPerPoint) / 100;
}
