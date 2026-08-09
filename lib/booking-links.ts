// Assisted-booking deep links — one-tap handoff to a provider's own secure
// checkout. No payment or PII touches the app (Phase 1 of booking; Phase 2 is
// real in-app booking via Duffel). Links pre-fill the route/dates so the
// traveler lands ready to complete the purchase.

export interface FlightBookingLinks {
  google_flights: string;
  kayak: string;
}
export interface HotelBookingLinks {
  booking_com: string;
  kayak: string;
  google_hotels: string;
}

const enc = encodeURIComponent;

export function flightBookingLinks(p: {
  origin: string; destination: string; departDate: string; returnDate?: string;
}): FlightBookingLinks {
  const o = p.origin.toUpperCase(), d = p.destination.toUpperCase();
  const kayakPath = p.returnDate
    ? `${o}-${d}/${p.departDate}/${p.returnDate}`
    : `${o}-${d}/${p.departDate}`;
  const gfq = p.returnDate
    ? `Flights from ${o} to ${d} on ${p.departDate} returning ${p.returnDate}`
    : `One way flights from ${o} to ${d} on ${p.departDate}`;
  return {
    google_flights: `https://www.google.com/travel/flights?q=${enc(gfq)}`,
    kayak: `https://www.kayak.com/flights/${kayakPath}?sort=price_a`,
  };
}

export function hotelBookingLinks(p: {
  city: string; checkIn: string; checkOut: string; adults?: number;
}): HotelBookingLinks {
  const adults = p.adults ?? 2;
  return {
    booking_com: `https://www.booking.com/searchresults.html?ss=${enc(p.city)}&checkin=${p.checkIn}&checkout=${p.checkOut}&group_adults=${adults}`,
    kayak: `https://www.kayak.com/hotels/${enc(p.city)}/${p.checkIn}/${p.checkOut}/${adults}adults`,
    google_hotels: `https://www.google.com/travel/search?q=${enc(`hotels in ${p.city}`)}`,
  };
}
