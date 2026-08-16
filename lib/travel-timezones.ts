// Time zones for itineraries.
//
// A flight leaving Atlanta at 8:15pm and landing in Madrid at 10:05am should
// read exactly that on both ends — the local time where you'll be standing,
// which is what the boarding pass says. Everything is stored as an absolute
// instant; this module decides what wall clock to show it on.

/**
 * IANA zone per airport, for the airports this app is likely to see. Unknown
 * codes fall back to the viewer's own zone, which is still more useful than UTC.
 */
const AIRPORT_TZ: Record<string, string> = {
  // ── United States ──
  ATL: "America/New_York", JFK: "America/New_York", LGA: "America/New_York", EWR: "America/New_York",
  BOS: "America/New_York", PHL: "America/New_York", DCA: "America/New_York", IAD: "America/New_York",
  BWI: "America/New_York", CLT: "America/New_York", MIA: "America/New_York", FLL: "America/New_York",
  MCO: "America/New_York", TPA: "America/New_York", RSW: "America/New_York", JAX: "America/New_York",
  RDU: "America/New_York", RIC: "America/New_York", PIT: "America/New_York", CLE: "America/New_York",
  CMH: "America/New_York", CVG: "America/New_York", DTW: "America/New_York", BUF: "America/New_York",
  ROC: "America/New_York", SYR: "America/New_York", ALB: "America/New_York", PVD: "America/New_York",
  BDL: "America/New_York", PWM: "America/New_York", BNA: "America/Chicago", IND: "America/Indiana/Indianapolis",
  SDF: "America/New_York", LEX: "America/New_York", GSP: "America/New_York", CHS: "America/New_York",
  SAV: "America/New_York", MYR: "America/New_York", PBI: "America/New_York",
  ORD: "America/Chicago", MDW: "America/Chicago", DFW: "America/Chicago", DAL: "America/Chicago",
  IAH: "America/Chicago", HOU: "America/Chicago", MSP: "America/Chicago", STL: "America/Chicago",
  MCI: "America/Chicago", MSY: "America/Chicago", MEM: "America/Chicago", AUS: "America/Chicago",
  SAT: "America/Chicago", OKC: "America/Chicago", TUL: "America/Chicago", OMA: "America/Chicago",
  DSM: "America/Chicago", MKE: "America/Chicago", LIT: "America/Chicago", JAN: "America/Chicago",
  BHM: "America/Chicago", HSV: "America/Chicago", ELP: "America/Denver",
  DEN: "America/Denver", SLC: "America/Denver", ABQ: "America/Denver", BOI: "America/Boise",
  BZN: "America/Denver", COS: "America/Denver", PHX: "America/Phoenix", TUS: "America/Phoenix",
  LAS: "America/Los_Angeles", LAX: "America/Los_Angeles", SFO: "America/Los_Angeles",
  SJC: "America/Los_Angeles", OAK: "America/Los_Angeles", SAN: "America/Los_Angeles",
  SMF: "America/Los_Angeles", BUR: "America/Los_Angeles", SNA: "America/Los_Angeles",
  ONT: "America/Los_Angeles", PSP: "America/Los_Angeles", RNO: "America/Los_Angeles",
  SEA: "America/Los_Angeles", PDX: "America/Los_Angeles", GEG: "America/Los_Angeles",
  ANC: "America/Anchorage", FAI: "America/Anchorage",
  HNL: "Pacific/Honolulu", OGG: "Pacific/Honolulu", KOA: "Pacific/Honolulu", LIH: "Pacific/Honolulu",

  // ── Canada ──
  YYZ: "America/Toronto", YUL: "America/Toronto", YOW: "America/Toronto", YHM: "America/Toronto",
  YVR: "America/Vancouver", YYC: "America/Edmonton", YEG: "America/Edmonton", YWG: "America/Winnipeg",
  YHZ: "America/Halifax", YQB: "America/Toronto", YXE: "America/Regina", YYJ: "America/Vancouver",

  // ── Mexico, Central & South America, Caribbean ──
  MEX: "America/Mexico_City", GDL: "America/Mexico_City", MTY: "America/Monterrey",
  CUN: "America/Cancun", SJD: "America/Mazatlan", PVR: "America/Mexico_City", TIJ: "America/Tijuana",
  GRU: "America/Sao_Paulo", CGH: "America/Sao_Paulo", GIG: "America/Sao_Paulo", BSB: "America/Sao_Paulo",
  EZE: "America/Argentina/Buenos_Aires", AEP: "America/Argentina/Buenos_Aires",
  SCL: "America/Santiago", LIM: "America/Lima", BOG: "America/Bogota", MDE: "America/Bogota",
  UIO: "America/Guayaquil", GYE: "America/Guayaquil", PTY: "America/Panama", SJO: "America/Costa_Rica",
  GUA: "America/Guatemala", SAL: "America/El_Salvador", HAV: "America/Havana",
  SJU: "America/Puerto_Rico", STT: "America/St_Thomas", STX: "America/St_Thomas",
  PUJ: "America/Santo_Domingo", SDQ: "America/Santo_Domingo", MBJ: "America/Jamaica", KIN: "America/Jamaica",
  NAS: "America/Nassau", AUA: "America/Aruba", CUR: "America/Curacao", BGI: "America/Barbados",
  SXM: "America/Lower_Princes", ANU: "America/Antigua", GCM: "America/Cayman", PLS: "America/Grand_Turk",

  // ── Europe ──
  LHR: "Europe/London", LGW: "Europe/London", STN: "Europe/London", LTN: "Europe/London",
  LCY: "Europe/London", MAN: "Europe/London", EDI: "Europe/London", GLA: "Europe/London",
  BHX: "Europe/London", BRS: "Europe/London", NCL: "Europe/London", BFS: "Europe/London",
  DUB: "Europe/Dublin", SNN: "Europe/Dublin", ORK: "Europe/Dublin",
  CDG: "Europe/Paris", ORY: "Europe/Paris", NCE: "Europe/Paris", LYS: "Europe/Paris",
  MRS: "Europe/Paris", TLS: "Europe/Paris", BOD: "Europe/Paris",
  AMS: "Europe/Amsterdam", EIN: "Europe/Amsterdam", BRU: "Europe/Brussels", LUX: "Europe/Luxembourg",
  FRA: "Europe/Berlin", MUC: "Europe/Berlin", BER: "Europe/Berlin", DUS: "Europe/Berlin",
  HAM: "Europe/Berlin", STR: "Europe/Berlin", CGN: "Europe/Berlin", NUE: "Europe/Berlin",
  ZRH: "Europe/Zurich", GVA: "Europe/Zurich", BSL: "Europe/Zurich", VIE: "Europe/Vienna",
  CPH: "Europe/Copenhagen", ARN: "Europe/Stockholm", GOT: "Europe/Stockholm", OSL: "Europe/Oslo",
  BGO: "Europe/Oslo", HEL: "Europe/Helsinki", KEF: "Atlantic/Reykjavik",
  MAD: "Europe/Madrid", BCN: "Europe/Madrid", AGP: "Europe/Madrid", PMI: "Europe/Madrid",
  VLC: "Europe/Madrid", SVQ: "Europe/Madrid", BIO: "Europe/Madrid", ALC: "Europe/Madrid",
  IBZ: "Europe/Madrid", LPA: "Atlantic/Canary", TFS: "Atlantic/Canary", ACE: "Atlantic/Canary",
  LIS: "Europe/Lisbon", OPO: "Europe/Lisbon", FAO: "Europe/Lisbon", FNC: "Atlantic/Madeira",
  FCO: "Europe/Rome", CIA: "Europe/Rome", MXP: "Europe/Rome", LIN: "Europe/Rome",
  BGY: "Europe/Rome", VCE: "Europe/Rome", NAP: "Europe/Rome", BLQ: "Europe/Rome",
  FLR: "Europe/Rome", PSA: "Europe/Rome", CTA: "Europe/Rome", PMO: "Europe/Rome",
  ATH: "Europe/Athens", SKG: "Europe/Athens", JTR: "Europe/Athens", JMK: "Europe/Athens",
  HER: "Europe/Athens", RHO: "Europe/Athens", IST: "Europe/Istanbul", SAW: "Europe/Istanbul",
  AYT: "Europe/Istanbul", WAW: "Europe/Warsaw", KRK: "Europe/Warsaw", PRG: "Europe/Prague",
  BUD: "Europe/Budapest", OTP: "Europe/Bucharest", SOF: "Europe/Sofia", ZAG: "Europe/Zagreb",
  SPU: "Europe/Zagreb", DBV: "Europe/Zagreb", BEG: "Europe/Belgrade", LJU: "Europe/Ljubljana",
  RIX: "Europe/Riga", TLL: "Europe/Tallinn", VNO: "Europe/Vilnius", SVO: "Europe/Moscow",
  DME: "Europe/Moscow", LED: "Europe/Moscow", MLA: "Europe/Malta", LCA: "Asia/Nicosia",

  // ── Middle East & Africa ──
  DXB: "Asia/Dubai", DWC: "Asia/Dubai", AUH: "Asia/Dubai", DOH: "Asia/Qatar",
  RUH: "Asia/Riyadh", JED: "Asia/Riyadh", KWI: "Asia/Kuwait", BAH: "Asia/Bahrain",
  MCT: "Asia/Muscat", TLV: "Asia/Jerusalem", AMM: "Asia/Amman", BEY: "Asia/Beirut",
  CAI: "Africa/Cairo", HRG: "Africa/Cairo", SSH: "Africa/Cairo", CMN: "Africa/Casablanca",
  RAK: "Africa/Casablanca", TUN: "Africa/Tunis", ALG: "Africa/Algiers",
  JNB: "Africa/Johannesburg", CPT: "Africa/Johannesburg", DUR: "Africa/Johannesburg",
  NBO: "Africa/Nairobi", MBA: "Africa/Nairobi", ADD: "Africa/Addis_Ababa", LOS: "Africa/Lagos",
  ABV: "Africa/Lagos", ACC: "Africa/Accra", DKR: "Africa/Dakar", MRU: "Indian/Mauritius",
  SEZ: "Indian/Mahe", ZNZ: "Africa/Dar_es_Salaam",

  // ── Asia ──
  NRT: "Asia/Tokyo", HND: "Asia/Tokyo", KIX: "Asia/Tokyo", ITM: "Asia/Tokyo",
  CTS: "Asia/Tokyo", FUK: "Asia/Tokyo", NGO: "Asia/Tokyo", OKA: "Asia/Tokyo",
  ICN: "Asia/Seoul", GMP: "Asia/Seoul", PUS: "Asia/Seoul", CJU: "Asia/Seoul",
  PEK: "Asia/Shanghai", PKX: "Asia/Shanghai", PVG: "Asia/Shanghai", SHA: "Asia/Shanghai",
  CAN: "Asia/Shanghai", SZX: "Asia/Shanghai", CTU: "Asia/Shanghai", HGH: "Asia/Shanghai",
  XIY: "Asia/Shanghai", HKG: "Asia/Hong_Kong", MFM: "Asia/Macau", TPE: "Asia/Taipei",
  TSA: "Asia/Taipei", SIN: "Asia/Singapore", BKK: "Asia/Bangkok", DMK: "Asia/Bangkok",
  HKT: "Asia/Bangkok", CNX: "Asia/Bangkok", USM: "Asia/Bangkok", KUL: "Asia/Kuala_Lumpur",
  PEN: "Asia/Kuala_Lumpur", BKI: "Asia/Kuala_Lumpur", CGK: "Asia/Jakarta", DPS: "Asia/Makassar",
  SUB: "Asia/Jakarta", MNL: "Asia/Manila", CEB: "Asia/Manila", HAN: "Asia/Ho_Chi_Minh",
  SGN: "Asia/Ho_Chi_Minh", DAD: "Asia/Ho_Chi_Minh", PNH: "Asia/Phnom_Penh", REP: "Asia/Phnom_Penh",
  RGN: "Asia/Yangon", VTE: "Asia/Vientiane",
  DEL: "Asia/Kolkata", BOM: "Asia/Kolkata", BLR: "Asia/Kolkata", MAA: "Asia/Kolkata",
  HYD: "Asia/Kolkata", CCU: "Asia/Kolkata", COK: "Asia/Kolkata", GOI: "Asia/Kolkata",
  AMD: "Asia/Kolkata", KTM: "Asia/Kathmandu", CMB: "Asia/Colombo", DAC: "Asia/Dhaka",
  MLE: "Indian/Maldives", KHI: "Asia/Karachi", LHE: "Asia/Karachi", ISB: "Asia/Karachi",
  TAS: "Asia/Tashkent", ALA: "Asia/Almaty", BAK: "Asia/Baku", TBS: "Asia/Tbilisi", EVN: "Asia/Yerevan",

  // ── Oceania ──
  SYD: "Australia/Sydney", MEL: "Australia/Melbourne", BNE: "Australia/Brisbane",
  OOL: "Australia/Brisbane", CNS: "Australia/Brisbane", CBR: "Australia/Sydney",
  ADL: "Australia/Adelaide", PER: "Australia/Perth", DRW: "Australia/Darwin", HBA: "Australia/Hobart",
  AKL: "Pacific/Auckland", CHC: "Pacific/Auckland", WLG: "Pacific/Auckland", ZQN: "Pacific/Auckland",
  NAN: "Pacific/Fiji", PPT: "Pacific/Tahiti", GUM: "Pacific/Guam", HIR: "Pacific/Guadalcanal",
  NOU: "Pacific/Noumea", APW: "Pacific/Apia", TBU: "Pacific/Tongatapu",
};

/** IANA zone for an airport code, or null when we don't know it. */
export function zoneForAirport(code: string | null | undefined): string | null {
  if (!code) return null;
  return AIRPORT_TZ[code.trim().toUpperCase()] ?? null;
}

/** True if the string names a zone this runtime can actually format in. */
export function isValidZone(tz: string | null | undefined): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The wall-clock reading of an instant in a zone, as ISO-ish parts. */
function wallPartsIn(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  // Intl renders midnight as hour 24 in some runtimes.
  const hour = get("hour") % 24;
  return Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
}

/**
 * Convert a wall-clock time in a zone ("2026-09-01T20:15") to the UTC instant.
 * Two passes, because the offset used to make the first guess may itself change
 * across a DST boundary.
 */
export function zonedTimeToUtc(wall: string, tz: string): string {
  const naive = Date.parse(wall.length === 16 ? `${wall}:00Z` : `${wall}Z`);
  if (Number.isNaN(naive) || !isValidZone(tz)) return new Date(naive || Date.now()).toISOString();

  let guess = naive;
  for (let i = 0; i < 2; i++) {
    const offset = wallPartsIn(new Date(guess), tz) - guess;
    guess = naive - offset;
  }
  return new Date(guess).toISOString();
}

/** The viewer's own zone (browser), or UTC on the server. */
export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

interface FormatOptions {
  /** Include the weekday and date, not just the time. */
  withDate?: boolean;
  /** Show the zone abbreviation (EDT, CEST). On by default. */
  withZone?: boolean;
}

/**
 * Render an instant on the clock of `tz`. With no zone we fall back to the
 * viewer's own, which beats showing everyone UTC.
 */
export function formatInZone(iso: string | null | undefined, tz?: string | null, opts: FormatOptions = {}): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const zone = isValidZone(tz) ? (tz as string) : localZone();
  const { withDate = false, withZone = true } = opts;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    ...(withDate ? { weekday: "short", month: "short", day: "numeric" } : {}),
    hour: "numeric", minute: "2-digit",
    ...(withZone ? { timeZoneName: "short" } : {}),
  }).format(at);
}

/** The calendar day an instant falls on in a zone — for grouping an itinerary. */
export function dayInZone(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const zone = isValidZone(tz) ? (tz as string) : localZone();
  // en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}
