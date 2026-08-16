// Travel brands and what their points are worth.
//
// Two jobs. First, matching: a hotel called "Courtyard Midtown" belongs to
// Marriott, and "Hertz Local Edition" is Hertz — so a preferred brand can be
// recognised in a result the provider never labelled. Second, valuation: a
// points balance is meaningless until it can be compared with a dollar price,
// so each programme carries a cents-per-point figure.
//
// Valuations are the widely published mid-range figures (roughly what the
// points-and-miles press quotes); they're a yardstick for "is this worth
// paying points for", not a promise of what a given night will price at. The
// UI says "≈" everywhere for that reason, and a user can override a programme's
// own valuation on their loyalty entry.

export type BrandCategory = "hotel" | "car" | "air";

export interface Brand {
  key: string;            // stable id
  name: string;           // display name
  category: BrandCategory;
  program?: string;       // loyalty programme name
  /** Cents per point, for turning a cash price into an approximate points price. */
  centsPerPoint?: number;
  /** Sub-brands and property names that belong to this parent. */
  aliases: string[];
}

export const BRANDS: Brand[] = [
  // ── Hotels ──
  { key: "marriott", name: "Marriott", category: "hotel", program: "Marriott Bonvoy", centsPerPoint: 0.84, aliases: ["marriott", "bonvoy", "courtyard", "residence inn", "fairfield", "springhill", "towneplace", "ac hotel", "aloft", "westin", "sheraton", "st regis", "w hotel", "le meridien", "renaissance", "autograph", "moxy", "delta hotels", "four points", "element", "gaylord", "ritz-carlton", "ritz carlton"] },
  { key: "hilton", name: "Hilton", category: "hotel", program: "Hilton Honors", centsPerPoint: 0.5, aliases: ["hilton", "honors", "hampton", "embassy suites", "doubletree", "homewood", "home2", "tru by", "curio", "canopy", "conrad", "waldorf", "tapestry", "signia", "motto"] },
  { key: "hyatt", name: "Hyatt", category: "hotel", program: "World of Hyatt", centsPerPoint: 1.7, aliases: ["hyatt", "andaz", "thompson hotel", "park hyatt", "grand hyatt", "hyatt place", "hyatt house", "caption by", "alila", "miraval"] },
  { key: "ihg", name: "IHG", category: "hotel", program: "IHG One Rewards", centsPerPoint: 0.5, aliases: ["ihg", "holiday inn", "crowne plaza", "kimpton", "intercontinental", "staybridge", "candlewood", "hotel indigo", "even hotel", "avid", "voco", "regent hotel"] },
  { key: "wyndham", name: "Wyndham", category: "hotel", program: "Wyndham Rewards", centsPerPoint: 1.1, aliases: ["wyndham", "days inn", "super 8", "ramada", "la quinta", "baymont", "microtel", "howard johnson", "travelodge", "tryp"] },
  { key: "choice", name: "Choice", category: "hotel", program: "Choice Privileges", centsPerPoint: 0.6, aliases: ["choice hotel", "comfort inn", "comfort suites", "quality inn", "sleep inn", "clarion", "econo lodge", "rodeway", "cambria", "ascend"] },
  { key: "best-western", name: "Best Western", category: "hotel", program: "Best Western Rewards", centsPerPoint: 0.6, aliases: ["best western", "surestay", "aiden by", "glo by"] },
  { key: "accor", name: "Accor", category: "hotel", program: "ALL Accor", centsPerPoint: 2.2, aliases: ["accor", "sofitel", "novotel", "pullman", "mercure", "ibis", "raffles", "fairmont", "swissotel", "mgallery", "mondrian", "sls hotel"] },

  // ── Car rental ──
  { key: "hertz", name: "Hertz", category: "car", program: "Hertz Gold Plus", centsPerPoint: 0.7, aliases: ["hertz", "dollar rent", "thrifty"] },
  { key: "avis", name: "Avis", category: "car", program: "Avis Preferred", centsPerPoint: 1.0, aliases: ["avis", "budget rent", "payless car"] },
  { key: "enterprise", name: "Enterprise", category: "car", program: "Enterprise Plus", centsPerPoint: 1.0, aliases: ["enterprise", "national car", "alamo"] },
  { key: "sixt", name: "Sixt", category: "car", program: "Sixt Express", aliases: ["sixt"] },
  { key: "turo", name: "Turo", category: "car", aliases: ["turo"] },

  // ── Airlines ──
  { key: "delta", name: "Delta", category: "air", program: "SkyMiles", centsPerPoint: 1.2, aliases: ["delta", "skymiles", "dl"] },
  { key: "united", name: "United", category: "air", program: "MileagePlus", centsPerPoint: 1.3, aliases: ["united", "mileageplus", "ua"] },
  { key: "american", name: "American", category: "air", program: "AAdvantage", centsPerPoint: 1.4, aliases: ["american airlines", "aadvantage", "aa"] },
  { key: "southwest", name: "Southwest", category: "air", program: "Rapid Rewards", centsPerPoint: 1.3, aliases: ["southwest", "rapid rewards", "wn"] },
  { key: "alaska", name: "Alaska", category: "air", program: "Mileage Plan", centsPerPoint: 1.4, aliases: ["alaska airlines", "mileage plan", "as"] },
  { key: "jetblue", name: "JetBlue", category: "air", program: "TrueBlue", centsPerPoint: 1.3, aliases: ["jetblue", "trueblue", "b6"] },
];

export function brandsIn(category: BrandCategory): Brand[] {
  return BRANDS.filter((b) => b.category === category);
}

/** The brand a property, agency or carrier name belongs to, if we recognise it. */
export function brandFor(text: string | null | undefined, category?: BrandCategory): Brand | null {
  if (!text) return null;
  const hay = text.toLowerCase();
  const pool = category ? brandsIn(category) : BRANDS;
  // Longest alias first, so "hyatt place" beats "hyatt" and stays on the same
  // parent either way — but a two-word match is the more specific signal.
  const matches = pool
    .flatMap((b) => b.aliases.map((a) => ({ b, a })))
    .filter(({ a }) => hay.includes(a))
    .sort((x, y) => y.a.length - x.a.length);
  return matches[0]?.b ?? null;
}

export function brandByKey(key: string): Brand | null {
  return BRANDS.find((b) => b.key === key) ?? null;
}

/** Does this result belong to one of the user's preferred brands? */
export function isPreferredBrand(name: string | null | undefined, preferred: string[], category?: BrandCategory): boolean {
  if (!name || !preferred.length) return false;
  const brand = brandFor(name, category);
  const wanted = preferred.map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (brand && wanted.some((w) => w === brand.key || w === brand.name.toLowerCase())) return true;
  // Fall back to a literal match, so a chain we don't know still works if it's
  // typed into preferences verbatim.
  const hay = name.toLowerCase();
  return wanted.some((w) => w.length > 2 && hay.includes(w));
}
