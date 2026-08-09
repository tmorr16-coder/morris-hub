export interface TravelPreferences {
  home_airport: string | null;
  cabin_class: string;
  max_stops: number;
  preferred_airlines: string[];
  preferred_hotel_chains: string[];
  hotel_min_rating: number;
  currency: string;
  notify_email: boolean;
  notify_sms: boolean;
}

export interface LoyaltyProgram {
  id: string;
  category: string;       // air | hotel | car | rail | credit_card
  program_name: string;
  member_number: string | null;
  tier: string | null;
  points_balance: number | null;
  notes: string | null;
}

export interface PriceWatch {
  id: string;
  kind: string;           // flight | hotel
  origin: string | null;
  destination: string | null;
  depart_date: string | null;
  return_date: string | null;
  cabin: string | null;
  adults: number;
  target_price: number | null;
  last_price: number | null;
  last_checked: string | null;
  active: boolean;
  notify: boolean;
}

export const DEFAULT_PREFS: TravelPreferences = {
  home_airport: null,
  cabin_class: "ECONOMY",
  max_stops: 2,
  preferred_airlines: [],
  preferred_hotel_chains: [],
  hotel_min_rating: 3,
  currency: "USD",
  notify_email: true,
  notify_sms: false,
};

export const LOYALTY_CATEGORIES = [
  { key: "air", label: "Airline" },
  { key: "hotel", label: "Hotel" },
  { key: "car", label: "Car rental" },
  { key: "rail", label: "Rail" },
  { key: "credit_card", label: "Travel card" },
] as const;

export interface Traveler {
  id: string;
  family_member_id: string | null;
  is_self: boolean;
  given_name: string | null;
  family_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  passport_country: string | null;
  known_traveler_number: string | null;
  seat_pref: string | null;
  meal_pref: string | null;
  email: string | null;
  phone: string | null;
}

export const GENDERS = [
  { key: "f", label: "Female" },
  { key: "m", label: "Male" },
  { key: "x", label: "Unspecified" },
] as const;

export const SEAT_PREFS = [
  { key: "no_pref", label: "No preference" },
  { key: "window", label: "Window" },
  { key: "aisle", label: "Aisle" },
] as const;

export const CABINS = [
  { key: "ECONOMY", label: "Economy" },
  { key: "PREMIUM_ECONOMY", label: "Premium" },
  { key: "BUSINESS", label: "Business" },
  { key: "FIRST", label: "First" },
] as const;
