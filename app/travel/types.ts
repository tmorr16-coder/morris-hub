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

export const CABINS = [
  { key: "ECONOMY", label: "Economy" },
  { key: "PREMIUM_ECONOMY", label: "Premium" },
  { key: "BUSINESS", label: "Business" },
  { key: "FIRST", label: "First" },
] as const;
