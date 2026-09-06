// The brand mark, in one place.
//
// The monogram existed as three separate copies — the favicon, the iOS
// home-screen icon, and the in-app BrandMark — each carrying its own literal
// gradient. They drifted: all three stayed on the original blue
// (#4A86C6 → #2F62A0) while the rest of the app moved to teal, so the mark read
// as a duller, different-hued thing next to the tint beside it and next to the
// dot on the front door.
//
// These are the same two values the app already uses for its tint
// (--pf-tint, light and dark), so the badge is now the brand colour rather than
// a colour that merely used to be. When that tint moves, these move with it:
// they were deepened alongside it when the softer verdigris was replaced.

/** Bright at the top, deeper at the bottom — the ink monogram reads on both.
 *  Deepened and saturated with the tint it tracks: the old pair read chalky
 *  next to the accent beside it. The bottom stop stops at #0E8A9B rather than
 *  going all the way to the light tint (#0B6E7C, 3.2:1) so the mark clears
 *  4.5:1 at every point of the ramp — 8.0:1 at the top, 4.7:1 at the bottom. */
export const BRAND_GRADIENT = "linear-gradient(140deg, #1AB8CF 0%, #0E8A9B 100%)";

/** The mark itself, drawn in ink rather than white.
 *  White measured 1.7:1 on the bright end of the gradient; ink measures 8.0:1,
 *  and it matches the module tiles, which moved to an ink glyph for the same
 *  reason when their fills got brighter. */
export const BRAND_INK = "#0A1013";

/** The "M". A single stroked path, so it scales from 20px to 180px unchanged. */
export const BRAND_MARK_PATH = "M4 19V6l8 8 8-8v13";

/** Bright teal — for dark grounds: the front-door dot and the ".family" accent. */
export const BRAND_TEAL = "#1AB8CF";

/** The same teal for light grounds, where the bright one has too little
 *  contrast to carry text. Matches the app's own light-mode tint: 5.9:1 on
 *  white, where the value it replaced (#12A5BC) managed 3.2:1 and read as the
 *  soft, washed-out version of the colour it was meant to be. */
export const BRAND_TEAL_DEEP = "#0B6E7C";
