// Live car rates we can hand off to.
//
// No API we hold sells car rates: SerpApi has flights and hotels engines but no
// cars one, and every real rates feed (CarTrawler, Priceline Partner, Sabre)
// starts with a commercial contract. So the honest version of "shop rates" is
// to carry the search across to the sites that do have them, with the place and
// both dates already filled in — one tap from the results, no retyping.
//
// Only patterns whose URL contract is a stable path or plain query string are
// built here. Sites whose search URLs are session-encoded (Priceline, Costco
// Travel, AutoSlash) are left out rather than shipped as links that land on an
// error page.

export interface RateLink {
  name: string;
  url: string;
}

/** Kayak takes an airport code or a place name in the path; spaces are hyphens. */
function kayakPlace(where: string): string {
  const t = where.trim();
  if (/^[A-Za-z]{3}$/.test(t)) return t.toUpperCase();
  return encodeURIComponent(t.replace(/\s+/g, "-"));
}

/** Expedia's date params are US-ordered, unlike everything else we handle. */
function usDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${m}/${d}/${y}` : iso;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Prefilled car-rate searches for a place and a date range.
 *
 * Returns nothing unless both dates are real ISO dates — a rate link without
 * dates is just a homepage, and offering it would imply we'd done the search.
 */
export function carRateLinks(where: string, pickUp?: string | null, dropOff?: string | null): RateLink[] {
  const place = where.trim();
  if (place.length < 2) return [];
  if (!pickUp || !dropOff || !ISO_DATE.test(pickUp) || !ISO_DATE.test(dropOff)) return [];

  const q = encodeURIComponent(place);
  return [
    { name: "Kayak", url: `https://www.kayak.com/cars/${kayakPlace(place)}/${pickUp}/${dropOff}` },
    { name: "Expedia", url: `https://www.expedia.com/carsearch?locn=${q}&date1=${encodeURIComponent(usDate(pickUp))}&date2=${encodeURIComponent(usDate(dropOff))}` },
    { name: "Google", url: `https://www.google.com/search?q=${encodeURIComponent(`car rental ${place} ${pickUp} to ${dropOff}`)}` },
  ];
}
