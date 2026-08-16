// Search-input checks that run before a provider is called.
//
// A bad airport code or a return date before the departure used to travel all
// the way to the provider and come back as an opaque 4xx ("search_failed"). It
// is both faster and clearer to catch it here and say what's wrong.

import type { FlightSearchParams, HotelSearchParams } from "./duffel";

const IATA = /^[A-Za-z]{3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today in the user's local terms — dates are day-granular, so compare days. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function badDate(value: string, label: string): string | null {
  if (!ISO_DATE.test(value)) return `${label} needs to be a date (YYYY-MM-DD).`;
  if (Number.isNaN(Date.parse(value))) return `${label} isn't a real date.`;
  return null;
}

/** Returns a human-readable problem, or null when the search can go ahead. */
export function validateFlightSearch(p: FlightSearchParams): string | null {
  if (!p.origin || !p.destination) return "Pick where you're flying from and to.";
  if (!IATA.test(p.origin)) return `"${p.origin}" isn't an airport code — use three letters, like ATL.`;
  if (!IATA.test(p.destination)) return `"${p.destination}" isn't an airport code — use three letters, like LHR.`;
  if (p.origin.toUpperCase() === p.destination.toUpperCase()) return "Origin and destination are the same airport.";

  if (!p.departDate) return "Pick a departure date.";
  const departProblem = badDate(p.departDate, "Departure date");
  if (departProblem) return departProblem;
  if (p.departDate < today()) return "That departure date has already passed.";

  if (p.returnDate) {
    const returnProblem = badDate(p.returnDate, "Return date");
    if (returnProblem) return returnProblem;
    if (p.returnDate < p.departDate) return "The return date is before the departure date.";
  }

  const adults = p.adults ?? 1;
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) return "Passengers must be between 1 and 9.";
  return null;
}

export function validateHotelSearch(p: HotelSearchParams): string | null {
  if (!p.query || p.query.trim().length < 2) return "Enter a city or area to search.";

  if (!p.checkIn) return "Pick a check-in date.";
  const inProblem = badDate(p.checkIn, "Check-in");
  if (inProblem) return inProblem;
  if (p.checkIn < today()) return "That check-in date has already passed.";

  if (!p.checkOut) return "Pick a check-out date.";
  const outProblem = badDate(p.checkOut, "Check-out");
  if (outProblem) return outProblem;
  if (p.checkOut <= p.checkIn) return "Check-out has to be after check-in.";

  const adults = p.adults ?? 1;
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) return "Guests must be between 1 and 9.";
  return null;
}
