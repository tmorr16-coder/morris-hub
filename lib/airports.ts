// Airport directory for the search form's autocomplete.
//
// You shouldn't have to know that Madrid is MAD. Typing "madrid", "barajas" or
// "MAD" should all get you there. This is the busiest ~150 airports rather than
// the full 40,000-row OpenFlights dump — enough to cover realistic searches
// without shipping a megabyte to the client, and the field still accepts a raw
// code for anything not listed.
//
// Time zones live in lib/timezones.ts, which covers a wider set of codes; this
// list is about naming, that one is about clocks.

export interface Airport {
  code: string;   // IATA
  city: string;
  name: string;   // the airport's own name, for "barajas"-style searches
  country: string;
}

export const AIRPORTS: Airport[] = [
  // United States
  { code: "ATL", city: "Atlanta", name: "Hartsfield–Jackson", country: "US" },
  { code: "JFK", city: "New York", name: "John F. Kennedy", country: "US" },
  { code: "LGA", city: "New York", name: "LaGuardia", country: "US" },
  { code: "EWR", city: "Newark", name: "Newark Liberty", country: "US" },
  { code: "BOS", city: "Boston", name: "Logan", country: "US" },
  { code: "PHL", city: "Philadelphia", name: "Philadelphia Intl", country: "US" },
  { code: "DCA", city: "Washington", name: "Reagan National", country: "US" },
  { code: "IAD", city: "Washington", name: "Dulles", country: "US" },
  { code: "BWI", city: "Baltimore", name: "Baltimore/Washington", country: "US" },
  { code: "CLT", city: "Charlotte", name: "Douglas Intl", country: "US" },
  { code: "MIA", city: "Miami", name: "Miami Intl", country: "US" },
  { code: "FLL", city: "Fort Lauderdale", name: "Hollywood Intl", country: "US" },
  { code: "MCO", city: "Orlando", name: "Orlando Intl", country: "US" },
  { code: "TPA", city: "Tampa", name: "Tampa Intl", country: "US" },
  { code: "RSW", city: "Fort Myers", name: "Southwest Florida", country: "US" },
  { code: "PBI", city: "West Palm Beach", name: "Palm Beach Intl", country: "US" },
  { code: "JAX", city: "Jacksonville", name: "Jacksonville Intl", country: "US" },
  { code: "RDU", city: "Raleigh", name: "Raleigh–Durham", country: "US" },
  { code: "CHS", city: "Charleston", name: "Charleston Intl", country: "US" },
  { code: "SAV", city: "Savannah", name: "Savannah/Hilton Head", country: "US" },
  { code: "PIT", city: "Pittsburgh", name: "Pittsburgh Intl", country: "US" },
  { code: "CLE", city: "Cleveland", name: "Hopkins Intl", country: "US" },
  { code: "CMH", city: "Columbus", name: "John Glenn", country: "US" },
  { code: "CVG", city: "Cincinnati", name: "Cincinnati/N. Kentucky", country: "US" },
  { code: "DTW", city: "Detroit", name: "Detroit Metro", country: "US" },
  { code: "IND", city: "Indianapolis", name: "Indianapolis Intl", country: "US" },
  { code: "SDF", city: "Louisville", name: "Muhammad Ali Intl", country: "US" },
  { code: "BNA", city: "Nashville", name: "Nashville Intl", country: "US" },
  { code: "MEM", city: "Memphis", name: "Memphis Intl", country: "US" },
  { code: "BHM", city: "Birmingham", name: "Shuttlesworth Intl", country: "US" },
  { code: "MSY", city: "New Orleans", name: "Louis Armstrong", country: "US" },
  { code: "ORD", city: "Chicago", name: "O'Hare", country: "US" },
  { code: "MDW", city: "Chicago", name: "Midway", country: "US" },
  { code: "MKE", city: "Milwaukee", name: "Mitchell Intl", country: "US" },
  { code: "MSP", city: "Minneapolis", name: "Minneapolis–St Paul", country: "US" },
  { code: "STL", city: "St Louis", name: "Lambert Intl", country: "US" },
  { code: "MCI", city: "Kansas City", name: "Kansas City Intl", country: "US" },
  { code: "OMA", city: "Omaha", name: "Eppley Airfield", country: "US" },
  { code: "DSM", city: "Des Moines", name: "Des Moines Intl", country: "US" },
  { code: "DFW", city: "Dallas", name: "Dallas/Fort Worth", country: "US" },
  { code: "DAL", city: "Dallas", name: "Love Field", country: "US" },
  { code: "IAH", city: "Houston", name: "George Bush Intercontinental", country: "US" },
  { code: "HOU", city: "Houston", name: "Hobby", country: "US" },
  { code: "AUS", city: "Austin", name: "Bergstrom Intl", country: "US" },
  { code: "SAT", city: "San Antonio", name: "San Antonio Intl", country: "US" },
  { code: "OKC", city: "Oklahoma City", name: "Will Rogers World", country: "US" },
  { code: "TUL", city: "Tulsa", name: "Tulsa Intl", country: "US" },
  { code: "LIT", city: "Little Rock", name: "Clinton National", country: "US" },
  { code: "ELP", city: "El Paso", name: "El Paso Intl", country: "US" },
  { code: "DEN", city: "Denver", name: "Denver Intl", country: "US" },
  { code: "SLC", city: "Salt Lake City", name: "Salt Lake City Intl", country: "US" },
  { code: "ABQ", city: "Albuquerque", name: "Sunport", country: "US" },
  { code: "BOI", city: "Boise", name: "Boise Airport", country: "US" },
  { code: "COS", city: "Colorado Springs", name: "Colorado Springs", country: "US" },
  { code: "BZN", city: "Bozeman", name: "Yellowstone Intl", country: "US" },
  { code: "PHX", city: "Phoenix", name: "Sky Harbor", country: "US" },
  { code: "TUS", city: "Tucson", name: "Tucson Intl", country: "US" },
  { code: "LAS", city: "Las Vegas", name: "Harry Reid Intl", country: "US" },
  { code: "LAX", city: "Los Angeles", name: "Los Angeles Intl", country: "US" },
  { code: "BUR", city: "Burbank", name: "Hollywood Burbank", country: "US" },
  { code: "SNA", city: "Santa Ana", name: "John Wayne", country: "US" },
  { code: "ONT", city: "Ontario", name: "Ontario Intl", country: "US" },
  { code: "SAN", city: "San Diego", name: "San Diego Intl", country: "US" },
  { code: "PSP", city: "Palm Springs", name: "Palm Springs Intl", country: "US" },
  { code: "SFO", city: "San Francisco", name: "San Francisco Intl", country: "US" },
  { code: "SJC", city: "San Jose", name: "Mineta San Jose", country: "US" },
  { code: "OAK", city: "Oakland", name: "Oakland Intl", country: "US" },
  { code: "SMF", city: "Sacramento", name: "Sacramento Intl", country: "US" },
  { code: "RNO", city: "Reno", name: "Reno–Tahoe", country: "US" },
  { code: "SEA", city: "Seattle", name: "Seattle–Tacoma", country: "US" },
  { code: "PDX", city: "Portland", name: "Portland Intl", country: "US" },
  { code: "GEG", city: "Spokane", name: "Spokane Intl", country: "US" },
  { code: "ANC", city: "Anchorage", name: "Ted Stevens", country: "US" },
  { code: "HNL", city: "Honolulu", name: "Daniel K. Inouye", country: "US" },
  { code: "OGG", city: "Maui", name: "Kahului", country: "US" },
  { code: "KOA", city: "Kona", name: "Ellison Onizuka", country: "US" },
  { code: "LIH", city: "Kauai", name: "Lihue", country: "US" },
  { code: "SJU", city: "San Juan", name: "Luis Muñoz Marín", country: "PR" },

  // Canada
  { code: "YYZ", city: "Toronto", name: "Pearson", country: "CA" },
  { code: "YUL", city: "Montreal", name: "Trudeau", country: "CA" },
  { code: "YVR", city: "Vancouver", name: "Vancouver Intl", country: "CA" },
  { code: "YYC", city: "Calgary", name: "Calgary Intl", country: "CA" },
  { code: "YOW", city: "Ottawa", name: "Macdonald–Cartier", country: "CA" },
  { code: "YEG", city: "Edmonton", name: "Edmonton Intl", country: "CA" },
  { code: "YHZ", city: "Halifax", name: "Stanfield Intl", country: "CA" },

  // Mexico, Caribbean, Latin America
  { code: "MEX", city: "Mexico City", name: "Benito Juárez", country: "MX" },
  { code: "CUN", city: "Cancún", name: "Cancún Intl", country: "MX" },
  { code: "GDL", city: "Guadalajara", name: "Miguel Hidalgo", country: "MX" },
  { code: "SJD", city: "Los Cabos", name: "Los Cabos Intl", country: "MX" },
  { code: "PVR", city: "Puerto Vallarta", name: "Ordaz Intl", country: "MX" },
  { code: "MTY", city: "Monterrey", name: "Monterrey Intl", country: "MX" },
  { code: "NAS", city: "Nassau", name: "Lynden Pindling", country: "BS" },
  { code: "MBJ", city: "Montego Bay", name: "Sangster Intl", country: "JM" },
  { code: "PUJ", city: "Punta Cana", name: "Punta Cana Intl", country: "DO" },
  { code: "AUA", city: "Aruba", name: "Reina Beatrix", country: "AW" },
  { code: "BGI", city: "Barbados", name: "Grantley Adams", country: "BB" },
  { code: "SXM", city: "St Maarten", name: "Princess Juliana", country: "SX" },
  { code: "GCM", city: "Grand Cayman", name: "Owen Roberts", country: "KY" },
  { code: "PTY", city: "Panama City", name: "Tocumen", country: "PA" },
  { code: "SJO", city: "San José", name: "Juan Santamaría", country: "CR" },
  { code: "BOG", city: "Bogotá", name: "El Dorado", country: "CO" },
  { code: "LIM", city: "Lima", name: "Jorge Chávez", country: "PE" },
  { code: "SCL", city: "Santiago", name: "Arturo Merino Benítez", country: "CL" },
  { code: "EZE", city: "Buenos Aires", name: "Ezeiza", country: "AR" },
  { code: "GRU", city: "São Paulo", name: "Guarulhos", country: "BR" },
  { code: "GIG", city: "Rio de Janeiro", name: "Galeão", country: "BR" },

  // Europe
  { code: "LHR", city: "London", name: "Heathrow", country: "GB" },
  { code: "LGW", city: "London", name: "Gatwick", country: "GB" },
  { code: "STN", city: "London", name: "Stansted", country: "GB" },
  { code: "LCY", city: "London", name: "City", country: "GB" },
  { code: "MAN", city: "Manchester", name: "Manchester", country: "GB" },
  { code: "EDI", city: "Edinburgh", name: "Edinburgh", country: "GB" },
  { code: "GLA", city: "Glasgow", name: "Glasgow", country: "GB" },
  { code: "DUB", city: "Dublin", name: "Dublin", country: "IE" },
  { code: "CDG", city: "Paris", name: "Charles de Gaulle", country: "FR" },
  { code: "ORY", city: "Paris", name: "Orly", country: "FR" },
  { code: "NCE", city: "Nice", name: "Côte d'Azur", country: "FR" },
  { code: "LYS", city: "Lyon", name: "Saint-Exupéry", country: "FR" },
  { code: "AMS", city: "Amsterdam", name: "Schiphol", country: "NL" },
  { code: "BRU", city: "Brussels", name: "Brussels", country: "BE" },
  { code: "FRA", city: "Frankfurt", name: "Frankfurt", country: "DE" },
  { code: "MUC", city: "Munich", name: "Munich", country: "DE" },
  { code: "BER", city: "Berlin", name: "Brandenburg", country: "DE" },
  { code: "DUS", city: "Düsseldorf", name: "Düsseldorf", country: "DE" },
  { code: "HAM", city: "Hamburg", name: "Hamburg", country: "DE" },
  { code: "ZRH", city: "Zurich", name: "Zurich", country: "CH" },
  { code: "GVA", city: "Geneva", name: "Geneva", country: "CH" },
  { code: "VIE", city: "Vienna", name: "Schwechat", country: "AT" },
  { code: "CPH", city: "Copenhagen", name: "Kastrup", country: "DK" },
  { code: "ARN", city: "Stockholm", name: "Arlanda", country: "SE" },
  { code: "OSL", city: "Oslo", name: "Gardermoen", country: "NO" },
  { code: "HEL", city: "Helsinki", name: "Vantaa", country: "FI" },
  { code: "KEF", city: "Reykjavik", name: "Keflavík", country: "IS" },
  { code: "MAD", city: "Madrid", name: "Barajas", country: "ES" },
  { code: "BCN", city: "Barcelona", name: "El Prat", country: "ES" },
  { code: "AGP", city: "Málaga", name: "Costa del Sol", country: "ES" },
  { code: "PMI", city: "Palma", name: "Son Sant Joan", country: "ES" },
  { code: "LIS", city: "Lisbon", name: "Humberto Delgado", country: "PT" },
  { code: "OPO", city: "Porto", name: "Francisco Sá Carneiro", country: "PT" },
  { code: "FCO", city: "Rome", name: "Fiumicino", country: "IT" },
  { code: "MXP", city: "Milan", name: "Malpensa", country: "IT" },
  { code: "VCE", city: "Venice", name: "Marco Polo", country: "IT" },
  { code: "NAP", city: "Naples", name: "Capodichino", country: "IT" },
  { code: "FLR", city: "Florence", name: "Peretola", country: "IT" },
  { code: "ATH", city: "Athens", name: "Eleftherios Venizelos", country: "GR" },
  { code: "IST", city: "Istanbul", name: "Istanbul", country: "TR" },
  { code: "PRG", city: "Prague", name: "Václav Havel", country: "CZ" },
  { code: "WAW", city: "Warsaw", name: "Chopin", country: "PL" },
  { code: "BUD", city: "Budapest", name: "Ferenc Liszt", country: "HU" },

  // Middle East & Africa
  { code: "DXB", city: "Dubai", name: "Dubai Intl", country: "AE" },
  { code: "AUH", city: "Abu Dhabi", name: "Zayed Intl", country: "AE" },
  { code: "DOH", city: "Doha", name: "Hamad Intl", country: "QA" },
  { code: "TLV", city: "Tel Aviv", name: "Ben Gurion", country: "IL" },
  { code: "CAI", city: "Cairo", name: "Cairo Intl", country: "EG" },
  { code: "CMN", city: "Casablanca", name: "Mohammed V", country: "MA" },
  { code: "RAK", city: "Marrakesh", name: "Menara", country: "MA" },
  { code: "JNB", city: "Johannesburg", name: "O. R. Tambo", country: "ZA" },
  { code: "CPT", city: "Cape Town", name: "Cape Town Intl", country: "ZA" },
  { code: "NBO", city: "Nairobi", name: "Jomo Kenyatta", country: "KE" },
  { code: "ADD", city: "Addis Ababa", name: "Bole", country: "ET" },
  { code: "LOS", city: "Lagos", name: "Murtala Muhammed", country: "NG" },
  { code: "ACC", city: "Accra", name: "Kotoka", country: "GH" },

  // Asia & Oceania
  { code: "NRT", city: "Tokyo", name: "Narita", country: "JP" },
  { code: "HND", city: "Tokyo", name: "Haneda", country: "JP" },
  { code: "KIX", city: "Osaka", name: "Kansai", country: "JP" },
  { code: "ICN", city: "Seoul", name: "Incheon", country: "KR" },
  { code: "PEK", city: "Beijing", name: "Capital", country: "CN" },
  { code: "PVG", city: "Shanghai", name: "Pudong", country: "CN" },
  { code: "HKG", city: "Hong Kong", name: "Hong Kong Intl", country: "HK" },
  { code: "TPE", city: "Taipei", name: "Taoyuan", country: "TW" },
  { code: "SIN", city: "Singapore", name: "Changi", country: "SG" },
  { code: "BKK", city: "Bangkok", name: "Suvarnabhumi", country: "TH" },
  { code: "HKT", city: "Phuket", name: "Phuket Intl", country: "TH" },
  { code: "KUL", city: "Kuala Lumpur", name: "KLIA", country: "MY" },
  { code: "CGK", city: "Jakarta", name: "Soekarno–Hatta", country: "ID" },
  { code: "DPS", city: "Bali", name: "Ngurah Rai", country: "ID" },
  { code: "MNL", city: "Manila", name: "Ninoy Aquino", country: "PH" },
  { code: "SGN", city: "Ho Chi Minh City", name: "Tan Son Nhat", country: "VN" },
  { code: "HAN", city: "Hanoi", name: "Noi Bai", country: "VN" },
  { code: "DEL", city: "Delhi", name: "Indira Gandhi", country: "IN" },
  { code: "BOM", city: "Mumbai", name: "Chhatrapati Shivaji", country: "IN" },
  { code: "BLR", city: "Bengaluru", name: "Kempegowda", country: "IN" },
  { code: "MLE", city: "Maldives", name: "Velana", country: "MV" },
  { code: "SYD", city: "Sydney", name: "Kingsford Smith", country: "AU" },
  { code: "MEL", city: "Melbourne", name: "Tullamarine", country: "AU" },
  { code: "BNE", city: "Brisbane", name: "Brisbane", country: "AU" },
  { code: "PER", city: "Perth", name: "Perth", country: "AU" },
  { code: "AKL", city: "Auckland", name: "Auckland", country: "NZ" },
  { code: "NAN", city: "Fiji", name: "Nadi", country: "FJ" },
  { code: "PPT", city: "Tahiti", name: "Faa'a", country: "PF" },
];

const BY_CODE = new Map(AIRPORTS.map((a) => [a.code, a]));

export function airportByCode(code: string | null | undefined): Airport | null {
  if (!code) return null;
  return BY_CODE.get(code.trim().toUpperCase()) ?? null;
}

/** "Madrid (MAD)" for a code we know, else the bare code. */
export function airportLabel(code: string | null | undefined): string {
  const a = airportByCode(code);
  return a ? `${a.city} (${a.code})` : (code ?? "").toUpperCase();
}

/**
 * Type-ahead over code, city and airport name. An exact code wins, then a city
 * that starts with the query, then anything containing it — so "LON" surfaces
 * London's airports and "MAD" puts Madrid first rather than "Madrid"-containing
 * names elsewhere.
 */
export function searchAirports(query: string, limit = 6): Airport[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const scored: { a: Airport; score: number }[] = [];
  for (const a of AIRPORTS) {
    const code = a.code.toLowerCase();
    const city = a.city.toLowerCase();
    const name = a.name.toLowerCase();
    let score = 0;
    if (code === q) score = 100;
    else if (city === q) score = 90;
    else if (city.startsWith(q)) score = 70;
    else if (name.toLowerCase().startsWith(q)) score = 60;
    else if (code.startsWith(q)) score = 50;
    else if (city.includes(q) || name.includes(q)) score = 30;
    if (score) scored.push({ a, score });
  }

  return scored
    .sort((x, y) => y.score - x.score || x.a.city.localeCompare(y.a.city))
    .slice(0, limit)
    .map(({ a }) => a);
}
