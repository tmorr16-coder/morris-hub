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
// a colour that merely used to be.

/** Bright at the top, deeper at the bottom — the white monogram reads on both. */
export const BRAND_GRADIENT = "linear-gradient(140deg, #3AD8EC 0%, #12A5BC 100%)";

/** The mark itself, drawn in ink rather than white.
 *  White measured 1.7:1 on the bright end of the gradient; ink measures 11:1,
 *  and it matches the module tiles, which moved to an ink glyph for the same
 *  reason when their fills got brighter. */
export const BRAND_INK = "#0A1013";

/** The "M". A single stroked path, so it scales from 20px to 180px unchanged. */
export const BRAND_MARK_PATH = "M4 19V6l8 8 8-8v13";

/** Bright teal — for dark grounds: the front-door dot and the ".family" accent. */
export const BRAND_TEAL = "#3AD8EC";

/** The same teal for light grounds, where the bright one has too little
 *  contrast to carry text. Matches the app's own light-mode tint. */
export const BRAND_TEAL_DEEP = "#12A5BC";
